/**
 * Wallet lifecycle for the TamaFlow desktop app.
 *
 *  Owns:
 *    - Encrypted-at-rest persistence (safeStorage) of the user's Canton
 *      Ed25519 keypair + partyId at `<userData>/wallet.json`.
 *    - Canton Wallet SDK calls for keypair generation, party allocation,
 *      holdings queries, and faucet taps.
 *    - An in-memory OAuth access-token cache so repeated holdings /
 *      faucet calls don't hit the FiveNorth authentik endpoint on every
 *      invocation.
 *
 *  This module is consumed by `main/index.ts` which wires the public
 *  functions onto `ipcMain.handle('wallet:*')`. Nothing in here is
 *  exposed to the renderer directly.
 */
import { app, ipcMain, BrowserWindow, safeStorage } from 'electron'
import { join } from 'path'
import { writeFile, readFile, unlink, rename } from 'fs/promises'
import { SDK } from '@canton-network/wallet-sdk'
import type {
  AmuletConfig,
  TokenConfig,
  SDKInterface,
} from '@canton-network/wallet-sdk'
import { DEVNET, DEFAULT_AMULET_AMOUNT, DEFAULT_PARTY_HINT } from './devnet'
import { buildTapCommand } from './tap'

// ============================================
// Hardcoded DevNet OAuth credentials.
//
// Stored as base64-encoded blobs and decoded at runtime — keeps the raw
// secret out of plaintext in source control while still hardcoded for
// the DevNet-only prototype.
//
// TODO before production: move these to a `safeStorage`-backed settings
// page so the user can rotate without rebuilding.
// ============================================
const DEVNET_CLIENT_ID_B64 = 'dmFsaWRhdG9yLWRldm5ldC1tMm0='
const DEVNET_CLIENT_SECRET_B64 =
  'cjY5RlFtZXZMUndFZ01COE5uS2FTREhQZXdUT1N4N1l5NWp1Y3NxQWxtc0FhSmMzRGxnZ2VkQ3o0dHl5b25sNFcyV29PVnprVUlqeThkSFRsYzE2QU9KUXp4MDJRekp5bEFVRzU2b0xUQ29WQ0pVVUs0MHZSdjlDcVFFWTNmam4='

function decodeB64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8')
}

const DEVNET_CLIENT_ID = decodeB64(DEVNET_CLIENT_ID_B64)
const DEVNET_CLIENT_SECRET = decodeB64(DEVNET_CLIENT_SECRET_B64)

const TOKEN_REFRESH_SKEW_MS = 60_000

// ============================================
// Wallet file schema (decrypted plaintext)
// ============================================
export interface WalletFile {
  v: 1
  partyId: string
  partyHint: string
  publicKey: string
  privateKey: string
  fingerprint: string
  createdAt: string
}

// ============================================
// On-disk schema (encrypted blob)
// ============================================
interface EncryptedWalletFile {
  v: 1
  encrypted: string // base64 of safeStorage.encryptString(...)
}

// ============================================
// IPC return types
// ============================================
export interface WalletStatus {
  exists: boolean
  encryptionAvailable: boolean
  partyId?: string
  partyHint?: string
  fingerprint?: string
  publicKey?: string
  createdAt?: string
  filePath: string
}

export interface WalletCreateResult {
  success: boolean
  partyId?: string
  fingerprint?: string
  error?: string
  errorCode?: 'OS_KEYCHAIN_UNAVAILABLE' | 'SDK_ERROR' | 'AUTH_ERROR'
}

export interface FaucetResult {
  success: boolean
  txHash?: string
  amount?: string
  error?: string
}

export interface Holding {
  contractId: string
  instrumentId: string
  symbol: string
  amount: string
  lockedAmount?: string
}

// ============================================
// Internal: paths + token cache
// ============================================
let cachedWalletFilePath = ''

function walletFilePath(): string {
  if (cachedWalletFilePath) return cachedWalletFilePath
  cachedWalletFilePath = join(app.getPath('userData'), 'wallet.json')
  return cachedWalletFilePath
}

let cachedToken: { token: string; expiresAt: number } | null = null

function isTokenValid(): boolean {
  return cachedToken !== null && Date.now() < cachedToken.expiresAt - TOKEN_REFRESH_SKEW_MS
}

/**
 * Exchange OAuth2 client_credentials for a short-lived JWT against
 * FiveNorth's authentik. Mirrors scripts/lib/auth.ts.
 *
 * Per RFC 6749 §2.3.1, client credentials go in an HTTP Basic auth
 * header. The Canton SDK does not expose this directly, so we fetch
 * the token ourselves and feed it to the SDK via `method: 'static'`.
 */
async function fetchToken(): Promise<string> {
  const basicAuth = Buffer.from(
    `${DEVNET_CLIENT_ID}:${DEVNET_CLIENT_SECRET}`,
  ).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    audience: DEVNET_CLIENT_ID,
    scope: DEVNET.authScope,
  })

  const res = await fetch(DEVNET.authTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Token endpoint returned ${res.status} ${res.statusText}: ${text}`,
    )
  }

  const json = (await res.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!json.access_token) {
    throw new Error('Token endpoint response did not include access_token')
  }
  return json.access_token
}

async function getToken(): Promise<string> {
  if (isTokenValid()) return cachedToken!.token
  const token = await fetchToken()
  // FiveNorth tokens are valid for 8 hours; default to that if the
  // endpoint omits `expires_in`.
  const expiresInSec = 8 * 60 * 60
  cachedToken = {
    token,
    expiresAt: Date.now() + expiresInSec * 1000,
  }
  return token
}

function amuletConfig(token: string): AmuletConfig {
  return {
    validatorUrl: DEVNET.validatorUrl,
    scanApiUrl: DEVNET.scanApiUrl,
    auth: { method: 'static', token },
    registryUrl: new URL(DEVNET.registryUrl),
  }
}

function tokenConfig(token: string): TokenConfig {
  return {
    validatorUrl: DEVNET.validatorUrl,
    auth: { method: 'static', token },
    registries: [DEVNET.registryUrl],
  }
}

async function buildExtendedSdk(): Promise<SDKInterface<'amulet' | 'token'>> {
  const token = await getToken()
  const baseSdk = await SDK.create({
    auth: { method: 'static', token },
    ledgerClientUrl: DEVNET.ledgerClientUrl,
  })
  const extended = await baseSdk.extend({
    amulet: amuletConfig(token),
    token: tokenConfig(token),
  })
  return extended as unknown as SDKInterface<'amulet' | 'token'>
}

/**
 * Build just the base Canton Wallet SDK — no `amulet` / `token`
 * extensions attached. Used by code paths that only need the standard
 * `ledger`, `keys`, `party`, `user`, `utils` namespaces (wallet
 * creation, the manual faucet flow). Skipping the extensions avoids
 * initialising registry listeners that 404 on FiveNorth DevNet.
 */
async function buildBaseSdk(token: string): Promise<SDKInterface> {
  return await SDK.create({
    auth: { method: 'static', token },
    ledgerClientUrl: DEVNET.ledgerClientUrl,
  })
}

// ============================================
// safeStorage layer
// ============================================
export function ensureEncryption(): { available: boolean; reason?: string } {
  if (safeStorage.isEncryptionAvailable()) return { available: true }
  return {
    available: false,
    reason:
      'OS keychain is unavailable. On Linux, install libsecret-1 + a keyring provider (gnome-keyring or kwallet) and restart the app.',
  }
}

// ============================================
// Read / write helpers (encrypted-at-rest)
// ============================================
export async function loadWallet(): Promise<WalletFile | null> {
  const path = walletFilePath()
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }

  const parsed = JSON.parse(raw) as EncryptedWalletFile
  if (parsed.v !== 1 || typeof parsed.encrypted !== 'string') {
    throw new Error('wallet.json: unsupported version or shape')
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS keychain is unavailable — cannot decrypt stored wallet.',
    )
  }
  const plaintext = safeStorage.decryptString(Buffer.from(parsed.encrypted, 'base64'))
  return JSON.parse(plaintext) as WalletFile
}

async function saveWallet(wallet: WalletFile): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain is unavailable — cannot encrypt new wallet.')
  }
  const json = JSON.stringify(wallet)
  const encrypted = safeStorage.encryptString(json).toString('base64')
  const onDisk: EncryptedWalletFile = { v: 1, encrypted }
  const path = walletFilePath()
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(onDisk, null, 2), 'utf8')
  await rename(tmp, path) // atomic on POSIX; on Windows best-effort
}

export async function destroyWallet(): Promise<void> {
  const path = walletFilePath()
  try {
    await unlink(path)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

// ============================================
// Public status (does NOT include privateKey)
// ============================================
export async function getWalletStatus(): Promise<WalletStatus> {
  const encryption = ensureEncryption()
  const base: WalletStatus = {
    exists: false,
    encryptionAvailable: encryption.available,
    filePath: walletFilePath(),
  }
  if (!encryption.available) return base
  try {
    const w = await loadWallet()
    if (!w) return base
    return {
      ...base,
      exists: true,
      partyId: w.partyId,
      partyHint: w.partyHint,
      fingerprint: w.fingerprint,
      publicKey: w.publicKey,
      createdAt: w.createdAt,
    }
  } catch (err) {
    console.error('[wallet] loadWallet failed:', err)
    return base
  }
}

// ============================================
// Create wallet — generate keypair, allocate party, persist.
// ============================================
export async function createWallet(): Promise<WalletCreateResult> {
  const encryption = ensureEncryption()
  if (!encryption.available) {
    return {
      success: false,
      error: encryption.reason ?? 'OS keychain unavailable',
      errorCode: 'OS_KEYCHAIN_UNAVAILABLE',
    }
  }

  // Reject if a wallet already exists to avoid overwriting silently.
  const existing = await loadWallet()
  if (existing) {
    return {
      success: false,
      error: `Wallet already exists (party ${existing.partyId}). Destroy it first.`,
    }
  }

  try {
    const sdk = await buildExtendedSdk()

    // 1. Generate Ed25519 keypair via the SDK (base64-encoded).
    const keyPair = sdk.keys.generate()

    // 2. Derive the fingerprint.
    const fingerprint = await sdk.keys.fingerprint(keyPair.publicKey)

    // 3. Allocate the external party on the ledger.
    const created = await sdk.party.external
      .create(keyPair.publicKey, { partyHint: DEFAULT_PARTY_HINT })
      .sign(keyPair.privateKey)
      .execute()

    // 4. Persist (encrypted-at-rest).
    const wallet: WalletFile = {
      v: 1,
      partyId: created.partyId,
      partyHint: DEFAULT_PARTY_HINT,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      fingerprint: created.publicKeyFingerprint ?? fingerprint,
      createdAt: new Date().toISOString(),
    }
    await saveWallet(wallet)

    notifyChange()
    return {
      success: true,
      partyId: wallet.partyId,
      fingerprint: wallet.fingerprint,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[wallet] createWallet failed:', err)
    return {
      success: false,
      error: message,
      errorCode: message.toLowerCase().includes('auth')
        ? 'AUTH_ERROR'
        : 'SDK_ERROR',
    }
  }
}

// ============================================
// Export private key — only via this explicit IPC.
// ============================================
export async function exportPrivateKey(): Promise<{
  success: boolean
  privateKey?: string
  error?: string
}> {
  try {
    const w = await loadWallet()
    if (!w) return { success: false, error: 'No wallet to export' }
    return { success: true, privateKey: w.privateKey }
  } catch (err) {
    return { success: false, error: errMsg(err) }
  }
}

// ============================================
// Holdings — list token UTXOs for the wallet.
// ============================================
export async function getHoldings(): Promise<Holding[]> {
  const w = await loadWallet()
  if (!w) return []
  const sdk = await buildExtendedSdk()
  const utxos = await sdk.token.utxos.list({ partyId: w.partyId })
  // Aggregate by instrumentId so the UI gets one row per token.
  const byInstrument = new Map<string, Holding>()
  for (const u of utxos) {
    const instrumentId: string =
      (u as { instrumentId?: string }).instrumentId ??
      ((u as { instrument?: { id?: string } }).instrument?.id ?? 'unknown')
    const symbol: string =
      (u as { symbol?: string }).symbol ??
      ((u as { instrument?: { symbol?: string } }).instrument?.symbol ??
        instrumentId.split(':').pop() ??
        'CC')
    const amount: string =
      (u as { amount?: string | number }).amount?.toString() ?? '0'
    const locked: string | undefined = (
      u as { lockedAmount?: string | number }
    ).lockedAmount?.toString()
    const key = `${u.contractId}:${instrumentId}`
    byInstrument.set(key, {
      contractId: u.contractId,
      instrumentId,
      symbol,
      amount,
      lockedAmount: locked,
    })
  }
  return Array.from(byInstrument.values())
}

// ============================================
// Faucet — mint CC to the wallet's party.
//
// Note: we do NOT use `sdk.amulet.tap()` here. FiveNorth's hosted DevNet
// validator does not expose the CIP-0056 token-metadata-v1 registry
// endpoints (`GET /registry/metadata/v1/instruments`) that the SDK's
// high-level tap calls into — it 404s with "The requested resource
// could not be found". Instead we build the `AmuletRules_DevNet_Tap`
// ExerciseCommand ourselves by fetching AmuletRules + the active
// OpenMiningRound from the scan-proxy endpoints (which DO work), then
// pipe through `sdk.ledger.prepare().sign().execute()`. See tap.ts.
// ============================================
export async function runFaucet(
  amount: string = DEFAULT_AMULET_AMOUNT,
): Promise<FaucetResult> {
  const w = await loadWallet()
  if (!w) return { success: false, error: 'No wallet loaded' }
  try {
    const token = await getToken()
    const sdk = await buildBaseSdk(token)
    // buildTapCommand returns a [WrappedCommand, DisclosedContract[]]
    // tuple. We pipe the command through sdk.ledger.prepare() so we can
    // sign it with the wallet's own key.
    const [command, disclosedContracts] = await buildTapCommand(
      token,
      w.partyId,
      amount,
    )
    const preparedTx = sdk.ledger.prepare({
      commands: [command],
      disclosedContracts,
      partyId: w.partyId,
    })
    const result = await preparedTx.sign(w.privateKey).execute({
      partyId: w.partyId,
    })
    return {
      success: true,
      txHash:
        (result as { updateId?: string }).updateId ??
        (result as { transactionHash?: string }).transactionHash,
      amount,
    }
  } catch (err) {
    console.error('[wallet] runFaucet failed:', err)
    return { success: false, error: errMsg(err) }
  }
}

// ============================================
// Change notifications
// ============================================
function notifyChange(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('wallet:onChange')
  }
}

export function registerWalletIpcHandlers(): void {
  ipcMain.handle('wallet:status', () => getWalletStatus())
  ipcMain.handle('wallet:create', () => createWallet())
  ipcMain.handle('wallet:destroy', async () => {
    await destroyWallet()
    notifyChange()
    return { success: true }
  })
  ipcMain.handle('wallet:exportKey', () => exportPrivateKey())
  ipcMain.handle('wallet:holdings', () => getHoldings())
  ipcMain.handle('wallet:faucet', (_e, amount?: string) => runFaucet(amount))
  console.log('[wallet] IPC handlers registered')
}

// ============================================
// Utils
// ============================================
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
