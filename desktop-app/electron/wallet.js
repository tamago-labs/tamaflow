// Wallet lifecycle for the TamaFlow desktop app.
//
// Tamaflow v1 surface (Settings page + TopBar chip):
//   - status / create / destroy / exportKey
//   - Encrypted-at-rest persistence (safeStorage) of the user's Canton
//     Ed25519 keypair + partyId at `<userData>/wallet.json`.
//   - Canton Wallet SDK calls for keypair generation + party allocation.
//
// The old payroll surface (holdings / faucet / transfer / accept /
// reject) was dropped with the Tamaflow rebrand — the project no
// longer runs the flow-canvas payroll system. Re-wiring those is a
// future effort.
//
// This module is consumed by `main.js` which wires the public
// functions onto `ipcMain.handle('wallet:*')`. Nothing in here is
// exposed to the renderer directly.

const { app, ipcMain, BrowserWindow, safeStorage } = require('electron')
const { join } = require('path')
const { writeFile, readFile, unlink, rename } = require('fs/promises')
const { SDK } = require('@canton-network/wallet-sdk')
const { DEVNET, DEFAULT_PARTY_HINT } = require('./devnet')

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

function decodeB64(value) {
  return Buffer.from(value, 'base64').toString('utf8')
}

const DEVNET_CLIENT_ID = decodeB64(DEVNET_CLIENT_ID_B64)
const DEVNET_CLIENT_SECRET = decodeB64(DEVNET_CLIENT_SECRET_B64)

const TOKEN_REFRESH_SKEW_MS = 60_000

// ============================================
// Wallet file schema (decrypted plaintext)
// ============================================

/**
 * @typedef {Object} WalletFile
 * @property {1} v
 * @property {string} partyId
 * @property {string} partyHint
 * @property {string} publicKey
 * @property {string} privateKey
 * @property {string} fingerprint
 * @property {string} createdAt
 */

/** @typedef {{ v: 1, encrypted: string }} EncryptedWalletFile */

/**
 * @typedef {Object} WalletStatus
 * @property {boolean} exists
 * @property {boolean} encryptionAvailable
 * @property {string} [partyId]
 * @property {string} [partyHint]
 * @property {string} [fingerprint]
 * @property {string} [publicKey]
 * @property {string} [createdAt]
 * @property {string} filePath
 */

/**
 * @typedef {Object} WalletCreateResult
 * @property {boolean} success
 * @property {string} [partyId]
 * @property {string} [fingerprint]
 * @property {string} [error]
 * @property {'OS_KEYCHAIN_UNAVAILABLE' | 'SDK_ERROR' | 'AUTH_ERROR'} [errorCode]
 */

// ============================================
// Internal: paths + token cache
// ============================================

let cachedWalletFilePath = ''

function walletFilePath() {
  if (cachedWalletFilePath) return cachedWalletFilePath
  cachedWalletFilePath = join(app.getPath('userData'), 'wallet.json')
  return cachedWalletFilePath
}

let cachedToken = null

function isTokenValid() {
  return cachedToken !== null && Date.now() < cachedToken.expiresAt - TOKEN_REFRESH_SKEW_MS
}

/**
 * Exchange OAuth2 client_credentials for a short-lived JWT against
 * FiveNorth's authentik.
 */
async function fetchToken() {
  const basicAuth = Buffer.from(
    `${DEVNET_CLIENT_ID}:${DEVNET_CLIENT_SECRET}`
  ).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    audience: DEVNET_CLIENT_ID,
    scope: DEVNET.authScope
  })

  const res = await fetch(DEVNET.authTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`
    },
    body: body.toString()
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Token endpoint returned ${res.status} ${res.statusText}: ${text}`
    )
  }

  const json = await res.json()
  if (!json.access_token) {
    throw new Error('Token endpoint response did not include access_token')
  }
  return json.access_token
}

async function getToken() {
  if (isTokenValid()) return cachedToken.token
  const token = await fetchToken()
  const expiresInSec = 8 * 60 * 60
  cachedToken = {
    token,
    expiresAt: Date.now() + expiresInSec * 1000
  }
  return token
}

async function buildBaseSdk(token) {
  return await SDK.create({
    auth: { method: 'static', token },
    ledgerClientUrl: DEVNET.ledgerClientUrl
  })
}

// ============================================
// safeStorage layer
// ============================================

/**
 * @returns {{ available: boolean, reason?: string }}
 */
function ensureEncryption() {
  if (safeStorage.isEncryptionAvailable()) return { available: true }
  return {
    available: false,
    reason:
      'OS keychain is unavailable. On Linux, install libsecret-1 + a keyring provider (gnome-keyring or kwallet) and restart the app.'
  }
}

/** @returns {Promise<WalletFile | null>} */
async function loadWallet() {
  const path = walletFilePath()
  let raw
  try {
    raw = await readFile(path, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }

  const parsed = JSON.parse(raw)
  if (parsed.v !== 1 || typeof parsed.encrypted !== 'string') {
    throw new Error('wallet.json: unsupported version or shape')
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS keychain is unavailable — cannot decrypt stored wallet.'
    )
  }
  const plaintext = safeStorage.decryptString(Buffer.from(parsed.encrypted, 'base64'))
  return JSON.parse(plaintext)
}

async function saveWallet(wallet) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain is unavailable — cannot encrypt new wallet.')
  }
  const json = JSON.stringify(wallet)
  const encrypted = safeStorage.encryptString(json).toString('base64')
  const onDisk = { v: 1, encrypted }
  const path = walletFilePath()
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(onDisk, null, 2), 'utf8')
  await rename(tmp, path)
}

async function destroyWallet() {
  const path = walletFilePath()
  try {
    await unlink(path)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

// ============================================
// Public status (does NOT include privateKey)
// ============================================

/** @returns {Promise<WalletStatus>} */
async function getWalletStatus() {
  const encryption = ensureEncryption()
  const base = {
    exists: false,
    encryptionAvailable: encryption.available,
    filePath: walletFilePath()
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
      createdAt: w.createdAt
    }
  } catch (err) {
    console.error('[wallet] loadWallet failed:', err)
    return base
  }
}

// ============================================
// Create wallet — generate keypair, allocate party, persist.
// ============================================

/**
 * @typedef {Object} CreateWalletOptions
 * @property {string} [partyHint] - Optional party hint. Slug-ified in the
 *   renderer; this is the sanitized version. Empty / invalid → falls
 *   back to DEFAULT_PARTY_HINT.
 */

/**
 * Convert a free-form organization name into a Canton-safe party hint.
 *   - lowercase
 *   - accents stripped (NFKD → drop combining marks)
 *   - non-alphanumeric runs collapsed into a single hyphen
 *   - leading / trailing hyphens trimmed
 *   - capped at 32 chars
 * @param {string} input
 */
function slugifyPartyHint(input) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

/** @returns {Promise<WalletCreateResult>} */
async function createWallet(opts = {}) {
  const encryption = ensureEncryption()
  if (!encryption.available) {
    return {
      success: false,
      error: encryption.reason ?? 'OS keychain unavailable',
      errorCode: 'OS_KEYCHAIN_UNAVAILABLE'
    }
  }

  const existing = await loadWallet()
  if (existing) {
    return {
      success: false,
      error: `Wallet already exists (party ${existing.partyId}). Destroy it first.`
    }
  }

  const requestedHint = slugifyPartyHint((opts.partyHint ?? '').trim())
  const partyHint = requestedHint.length > 0 ? requestedHint : DEFAULT_PARTY_HINT

  try {
    const token = await getToken()
    const sdk = await buildBaseSdk(token)

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
    const wallet = {
      v: 1,
      partyId: created.partyId,
      partyHint,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      fingerprint: created.publicKeyFingerprint ?? fingerprint,
      createdAt: new Date().toISOString()
    }
    await saveWallet(wallet)

    notifyChange()
    return {
      success: true,
      partyId: wallet.partyId,
      fingerprint: wallet.fingerprint
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[wallet] createWallet failed:', err)
    return {
      success: false,
      error: message,
      errorCode: message.toLowerCase().includes('auth') ? 'AUTH_ERROR' : 'SDK_ERROR'
    }
  }
}

// ============================================
// Export private key — only via this explicit IPC.
// ============================================

/** @returns {Promise<{ success: boolean, privateKey?: string, error?: string }>} */
async function exportPrivateKey() {
  try {
    const w = await loadWallet()
    if (!w) return { success: false, error: 'No wallet to export' }
    return { success: true, privateKey: w.privateKey }
  } catch (err) {
    return { success: false, error: errMsg(err) }
  }
}

// ============================================
// Change notifications
// ============================================

function notifyChange() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('wallet:onChange')
  }
}

/**
 * @param {() => void} [_log] - optional logger (unused, kept for symmetry)
 */
function registerWalletIpcHandlers(_log) {
  ipcMain.handle('wallet:status', () => getWalletStatus())
  ipcMain.handle('wallet:create', (_e, opts) => createWallet(opts))
  ipcMain.handle('wallet:destroy', async () => {
    await destroyWallet()
    notifyChange()
    return { success: true }
  })
  ipcMain.handle('wallet:exportKey', () => exportPrivateKey())
  console.log('[wallet] IPC handlers registered')
}

// ============================================
// Utils
// ============================================

function errMsg(err) {
  if (err === null || err === undefined) return String(err)
  if (err instanceof Error) return err.message

  if (typeof err === 'object') {
    const obj = err
    const nested =
      (typeof obj.error === 'object' && obj.error !== null
        ? obj.error
        : null) ??
      (typeof obj.cause === 'object' && obj.cause !== null ? obj.cause : null)
    if (nested) {
      const nestedMsg = pickString(nested, 'message') ?? nested.description
      if (nestedMsg) return nestedMsg
    }
    const direct =
      pickString(obj, 'message') ??
      pickString(obj, 'errorMessage') ??
      pickString(obj, 'reason') ??
      pickString(obj, 'statusText')
    if (direct) {
      const status =
        typeof obj.status === 'number'
          ? `HTTP ${obj.status}`
          : typeof obj.statusCode === 'number'
            ? `HTTP ${obj.statusCode}`
            : null
      return status ? `${status} ${direct}` : direct
    }
    if (typeof obj.body === 'string') return obj.body
    try {
      const json = JSON.stringify(err)
      if (json && json !== '{}') return json
    } catch {
      // circular ref, etc.
    }
  }
  return String(err)
}

function pickString(obj, key) {
  const v = obj[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

module.exports = {
  ensureEncryption,
  getWalletStatus,
  createWallet,
  destroyWallet,
  exportPrivateKey,
  registerWalletIpcHandlers,
  // Re-exports for the v2 surface (holdings / faucet / transfer /
  // accept / reject) — currently stubbed, will be re-introduced when
  // the payroll flow system comes back.
  WalletFile: undefined,
  WalletStatus: undefined,
  WalletCreateResult: undefined
}
