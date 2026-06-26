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
export interface CreateWalletOptions {
  /** Optional party hint. Slug-ified in the renderer; this is the
   *  sanitized version. Empty / invalid → falls back to DEFAULT_PARTY_HINT. */
  partyHint?: string
}

/**
 * Convert a free-form organization name into a Canton-safe party hint:
 *   - lowercase
 *   - accents stripped (NFKD → drop combining marks)
 *   - non-alphanumeric runs collapsed into a single hyphen
 *   - leading / trailing hyphens trimmed
 *   - capped at 32 chars (Canton party hint limit on this DevNet)
 * Returns an empty string if the input has no usable characters —
 * callers should fall back to a default in that case.
 */
function slugifyPartyHint(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export async function createWallet(
  opts: CreateWalletOptions = {},
): Promise<WalletCreateResult> {
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

  // Re-validate / slug-ify in main as defence-in-depth — the renderer
  // already slug-ifies, but we don't trust IPC payloads.
  const requestedHint = slugifyPartyHint((opts.partyHint ?? '').trim())
  const partyHint = requestedHint.length > 0 ? requestedHint : DEFAULT_PARTY_HINT

  try {
    const sdk = await buildExtendedSdk()

    // 1. Generate Ed25519 keypair via the SDK (base64-encoded).
    const keyPair = sdk.keys.generate()

    // 2. Derive the fingerprint.
    const fingerprint = await sdk.keys.fingerprint(keyPair.publicKey)

    // 3. Allocate the external party on the ledger.
    const created = await sdk.party.external
      .create(keyPair.publicKey, { partyHint })
      .sign(keyPair.privateKey)
      .execute()

    // 4. Persist (encrypted-at-rest).
    const wallet: WalletFile = {
      v: 1,
      partyId: created.partyId,
      partyHint,
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
//
// Canton uses a UTXO model, so a party's balance is the sum of all
// `Holding` contracts in their position. We aggregate by instrumentId
// (NOT contractId — each UTXO is its own contract) and sum the
// amounts to produce one row per token for the Assets table. See
// https://docs.digitalasset.com/integrations/wallet/wallet-sdk-v1-migration
// for the SDK's recommended pattern.
//
// Tracing: every entry/exit is logged with `[wallet.getHoldings]` so
// it's easy to grep the main-process console when the IPC call isn't
// reaching us.
// ============================================
export async function getHoldings(): Promise<Holding[]> {
  const TAG = '[wallet.getHoldings]'
  console.log(TAG, 'called')

  const w = await loadWallet()
  console.log(TAG, 'wallet loaded:', {
    hasWallet: !!w,
    partyId: w?.partyId,
    partyHint: w?.partyHint,
  })


  if (!w) {
    console.log(TAG, 'no wallet — returning []')
    return []
  }

  let sdk: Awaited<ReturnType<typeof buildExtendedSdk>>
  try {
    sdk = await buildExtendedSdk()
  } catch (sdkErr) {
    const msg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr)
    console.error(TAG, 'buildExtendedSdk failed:', msg)
    return []
  }

  console.log(TAG, 'calling sdk.token.utxos.list for party', w.partyId)
  let utxos: unknown[]
  try {
    utxos = (await sdk.token.utxos.list({ partyId: w.partyId })) as unknown[]
  } catch (utxoErr) {
    const msg = utxoErr instanceof Error ? utxoErr.message : String(utxoErr)
    console.error(TAG, 'sdk.token.utxos.list failed:', msg)
    return []
  }

  console.log(TAG, 'utxos.list returned', utxos.length, 'contracts')

  // Aggregate by instrumentId — sum amounts across all the UTXOs the
  // party holds for the same instrument. Canton doesn't expose a
  // "balance" field; this aggregation IS the balance.
  type Bucket = {
    contractId: string // representative (first) contractId, used as React key
    instrumentId: string
    symbol: string
    amount: number
  }
  const byInstrument = new Map<string, Bucket>()

  for (const u of utxos) {
    const utxo = u as {
      contractId?: string
      // Canton `Holding` shape: instrumentId is a nested { admin, id }
      // object (see core-tx-parser/dist/types.d.ts). We only care about
      // `id` for aggregation. The SDK sometimes nests the view under
      // `interfaceViewValue` instead of flattening — handle both.
      instrumentId?: { admin?: string; id?: string } | string
      interfaceViewValue?: {
        instrumentId?: { admin?: string; id?: string } | string
        amount?: string | number
        meta?: { symbol?: string }
      }
      symbol?: string
      meta?: { symbol?: string }
      amount?: string | number
      instrument?: { id?: string; symbol?: string }
    }

    // Resolve the bare instrument id (e.g. "Amulet") from whichever
    // shape the SDK returned this batch in.
    const instrumentIdObj =
      (typeof utxo.instrumentId === 'object' ? utxo.instrumentId : null) ??
      (typeof utxo.interfaceViewValue?.instrumentId === 'object'
        ? utxo.interfaceViewValue.instrumentId
        : null)
    const instrumentId: string =
      instrumentIdObj?.id ??
      (typeof utxo.instrumentId === 'string' ? utxo.instrumentId : null) ??
      (typeof utxo.interfaceViewValue?.instrumentId === 'string'
        ? utxo.interfaceViewValue.instrumentId
        : null) ??
      utxo.instrument?.id ??
      'unknown'

    // Symbol comes from `meta.symbol` (the CIP-0056 metadata view).
    // The wallet SDK currently doesn't populate this on FiveNorth DevNet
    // for Amulet, so we fall back to "CC" (the well-known Canton Coin
    // ticker) when the id looks like an Amulet instrument.
    const symbol: string =
      utxo.meta?.symbol ??
      utxo.interfaceViewValue?.meta?.symbol ??
      utxo.symbol ??
      utxo.instrument?.symbol ??
      (instrumentId.toLowerCase().includes('amulet') ? 'CC' : instrumentId)

    // Amount lives in either top-level `amount` or nested
    // `interfaceViewValue.amount` (Canton CIP-0056 holding view shape).
    const rawAmount =
      utxo.amount ?? utxo.interfaceViewValue?.amount ?? '0'
    const amount = parseFloat(String(rawAmount))
    if (!Number.isFinite(amount)) {
      console.warn(TAG, 'skipping utxo with non-numeric amount', {
        contractId: utxo.contractId,
        rawAmount,
      })
      continue
    }

    const existing = byInstrument.get(instrumentId)
    if (existing) {
      existing.amount += amount
    } else {
      byInstrument.set(instrumentId, {
        contractId: utxo.contractId ?? '',
        instrumentId,
        symbol,
        amount,
      })
    }
  }

  // Number back to string for the wire shape. We use a fixed-precision
  // representation so the UI's `formatAmount` sees the same value the
  // SDK gave us.
  const result: Holding[] = Array.from(byInstrument.values()).map((b) => ({
    contractId: b.contractId,
    instrumentId: b.instrumentId,
    symbol: b.symbol,
    amount: b.amount.toString(),
  }))

  console.log(
    TAG,
    'aggregated into',
    result.length,
    'instruments:',
    result.map((r) => `${r.symbol}=${r.amount}`).join(', '),
  )
  return result
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
  ipcMain.handle('wallet:create', (_e, opts?: CreateWalletOptions) =>
    createWallet(opts),
  )
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
