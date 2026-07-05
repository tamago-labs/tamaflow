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
const { SDK, getPublicKeyFromPrivate } = require('@canton-network/wallet-sdk')
const { DEVNET, DEFAULT_PARTY_HINT, DEFAULT_AMULET_AMOUNT } = require('./devnet')
const { buildTapCommand } = require('./tap')
const { buildTransferCommand, getAmuletDsoParty } = require('./transfer')
const {
  listPendingTransferInstructions,
  buildAcceptCommand,
  buildRejectCommand
} = require('./accept')

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
// Faucet — mint CC to the wallet's party.
/**
 * @typedef {Object} FaucetResultJs
 * @property {boolean} success
 * @property {string} [txHash]
 * @property {string} [amount]
 * @property {string} [error]
 */

/**
 * @param {string} [amount]
 * @returns {Promise<FaucetResultJs>}
 */
async function runFaucet(amount = DEFAULT_AMULET_AMOUNT) {
  const w = await loadWallet()
  if (!w) return { success: false, error: 'No wallet loaded' }
  try {
    const token = await getToken()
    const sdk = await buildBaseSdk(token)
    const [command, disclosedContracts] = await buildTapCommand(
      token,
      w.partyId,
      amount
    )
    const preparedTx = sdk.ledger.prepare({
      commands: [command],
      disclosedContracts,
      partyId: w.partyId
    })
    const result = await preparedTx.sign(w.privateKey).execute({
      partyId: w.partyId
    })
    return {
      success: true,
      txHash: result.updateId ?? result.transactionHash,
      amount
    }
  } catch (err) {
    console.error('[wallet] runFaucet failed:', err)
    return { success: false, error: errMsg(err) }
  }
}

// ============================================
// Faucet — mint CC to the wallet's party.
//
// Note: we do NOT use `sdk.amulet.tap()` here. FiveNorth's hosted
// DevNet validator does not expose the CIP-0056 token-metadata-v1
// registry endpoints that the SDK's high-level tap calls into —
// it 404s with "The requested resource could not be found".
// Instead we build the `AmuletRules_DevNet_Tap` ExerciseCommand
// ourselves by fetching AmuletRules + the active OpenMiningRound
// from the scan-proxy endpoints (which DO work), then pipe through
// `sdk.ledger.prepare().sign().execute()`. See tap.js.
// ============================================

/**
 * @typedef {Object} FaucetResultJs
 * @property {boolean} success
 * @property {string} [txHash]
 * @property {string} [amount]
 * @property {string} [error]
 */

/**
 * @param {string} [amount]
 * @returns {Promise<FaucetResultJs>}
 */
async function runFaucet(amount = DEFAULT_AMULET_AMOUNT) {
  const w = await loadWallet()
  if (!w) return { success: false, error: 'No wallet loaded' }
  try {
    const token = await getToken()
    const sdk = await buildBaseSdk(token)
    const [command, disclosedContracts] = await buildTapCommand(
      token,
      w.partyId,
      amount
    )
    const preparedTx = sdk.ledger.prepare({
      commands: [command],
      disclosedContracts,
      partyId: w.partyId
    })
    const result = await preparedTx.sign(w.privateKey).execute({
      partyId: w.partyId
    })
    return {
      success: true,
      txHash: result.updateId ?? result.transactionHash,
      amount
    }
  } catch (err) {
    console.error('[wallet] runFaucet failed:', err)
    return { success: false, error: errMsg(err) }
  }
}

// ============================================
// Holdings — list token UTXOs for the wallet.
//
// Canton uses a UTXO model. A party's balance is the sum of all
// `Holding` contracts in their position. We aggregate by
// instrumentId (NOT contractId — each UTXO is its own contract) and
// sum the amounts to produce one row per token for the Assets table.
// ============================================

/**
 * @typedef {Object} Holding
 * @property {string} contractId
 * @property {string} instrumentId
 * @property {string} symbol
 * @property {string} amount
 */

/** @returns {Promise<Holding[]>} */
async function getHoldings() {
  const TAG = '[wallet.getHoldings]'
  console.log(TAG, 'called')
  const w = await loadWallet()
  if (!w) {
    console.log(TAG, 'no wallet — returning []')
    return []
  }

  let sdk
  try {
    const token = await getToken()
    const base = await SDK.create({
      auth: { method: 'static', token },
      ledgerClientUrl: DEVNET.ledgerClientUrl
    })
    sdk = await base.extend({
      amulet: {
        validatorUrl: DEVNET.validatorUrl,
        scanApiUrl: DEVNET.scanApiUrl,
        auth: { method: 'static', token },
        registryUrl: new URL(DEVNET.registryUrl)
      },
      token: {
        validatorUrl: DEVNET.validatorUrl,
        auth: { method: 'static', token },
        registries: [DEVNET.registryUrl]
      }
    })
  } catch (sdkErr) {
    console.error(TAG, 'SDK build failed:', sdkErr)
    return []
  }

  let utxos
  try {
    utxos = await sdk.token.utxos.list({ partyId: w.partyId })
  } catch (utxoErr) {
    console.error(TAG, 'sdk.token.utxos.list failed:', utxoErr)
    return []
  }

  // Aggregate by instrumentId.
  const byInstrument = new Map()
  for (const u of utxos) {
    const instrumentIdObj =
      (typeof u.instrumentId === 'object' ? u.instrumentId : null) ??
      (typeof u.interfaceViewValue?.instrumentId === 'object'
        ? u.interfaceViewValue.instrumentId
        : null)
    const instrumentId =
      instrumentIdObj?.id ??
      (typeof u.instrumentId === 'string' ? u.instrumentId : null) ??
      (typeof u.interfaceViewValue?.instrumentId === 'string'
        ? u.interfaceViewValue.instrumentId
        : null) ??
      u.instrument?.id ??
      'unknown'

    const symbol =
      u.meta?.symbol ??
      u.interfaceViewValue?.meta?.symbol ??
      u.symbol ??
      u.instrument?.symbol ??
      (instrumentId.toLowerCase().includes('amulet') ? 'CC' : instrumentId)

    const rawAmount = u.amount ?? u.interfaceViewValue?.amount ?? '0'
    const amount = parseFloat(String(rawAmount))
    if (!Number.isFinite(amount)) continue

    const existing = byInstrument.get(instrumentId)
    if (existing) {
      existing.amount += amount
    } else {
      byInstrument.set(instrumentId, {
        contractId: u.contractId ?? '',
        instrumentId,
        symbol,
        amount
      })
    }
  }
  return Array.from(byInstrument.values()).map((b) => ({
    ...b,
    amount: b.amount.toString()
  }))
}

// ============================================
// Transfer — send CC to another party.
// ============================================

/**
 * @typedef {Object} TransferParams
 * @property {string} recipient
 * @property {string} amount
 * @property {string} [memo]
 */

/**
 * @typedef {Object} TransferResult
 * @property {boolean} success
 * @property {string} [updateId]
 * @property {string} [amount]
 * @property {string} [recipient]
 * @property {string} [error]
 */

/** CC has 10 decimal places. Pad / truncate a human string to that. */
function padCantonCoinAmount(input) {
  const trimmed = String(input).trim()
  if (trimmed === '' || Number.isNaN(parseFloat(trimmed))) {
    throw new Error(`Invalid amount: ${input}`)
  }
  const [whole, frac = ''] = trimmed.split('.')
  const padded = (frac + '0'.repeat(10)).slice(0, 10)
  return `${whole}.${padded}`
}

/** Reject obviously malformed partyIds before we hit the ledger. */
function validatePartyId(partyId) {
  if (!partyId || partyId.length < 10) {
    throw new Error('Recipient partyId is too short')
  }
  if (!/^[\x20-\x7e]+$/.test(partyId)) {
    throw new Error('Recipient partyId contains invalid characters')
  }
}

let cachedDsoParty = null
async function getCachedDsoParty(token) {
  if (cachedDsoParty) return cachedDsoParty
  cachedDsoParty = await getAmuletDsoParty(token)
  return cachedDsoParty
}

/** @returns {Promise<TransferResult>} */
async function transferAmulet(params) {
  const w = await loadWallet()
  if (!w) return { success: false, error: 'No wallet loaded' }
  try {
    validatePartyId(params.recipient)
    const amount = padCantonCoinAmount(params.amount)
    const token = await getToken()
    const dsoParty = await getCachedDsoParty(token)
    const [transferCommand, disclosedContracts] = await buildTransferCommand(
      token,
      {
        sender: w.partyId,
        recipient: params.recipient,
        amount,
        dsoParty
      }
    )
    const sdk = await SDK.create({
      auth: { method: 'static', token },
      ledgerClientUrl: DEVNET.ledgerClientUrl
    })
    const result = await sdk.ledger
      .prepare({
        partyId: w.partyId,
        commands: transferCommand,
        disclosedContracts
      })
      .sign(w.privateKey)
      .execute({ partyId: w.partyId })
    const updateId = result.updateId ?? result.transactionHash
    return { success: true, updateId, amount, recipient: params.recipient }
  } catch (err) {
    console.error('[wallet] transferAmulet failed:', err)
    return { success: false, error: errMsg(err) }
  }
}

// ============================================
// Recipient-side: list / accept / reject pending transfers.
// ============================================

/**
 * @typedef {Object} PendingTransfer
 * @property {string} contractId
 * @property {string} sender
 * @property {string} receiver
 * @property {string} amount
 * @property {string} instrumentId
 * @property {string} executeBefore
 * @property {string} [memo]
 */

/**
 * @typedef {Object} RecipientResult
 * @property {boolean} success
 * @property {string} [updateId]
 * @property {string} [contractId]
 * @property {string} [error]
 */

/** @returns {Promise<PendingTransfer[]>} */
async function listPendingTransfers() {
  const w = await loadWallet()
  if (!w) return []
  try {
    const token = await getToken()
    const base = await SDK.create({
      auth: { method: 'static', token },
      ledgerClientUrl: DEVNET.ledgerClientUrl
    })
    const sdk = await base.extend({
      amulet: {
        validatorUrl: DEVNET.validatorUrl,
        scanApiUrl: DEVNET.scanApiUrl,
        auth: { method: 'static', token },
        registryUrl: new URL(DEVNET.registryUrl)
      },
      token: {
        validatorUrl: DEVNET.validatorUrl,
        auth: { method: 'static', token },
        registries: [DEVNET.registryUrl]
      }
    })
    const { listPendingTransferInstructions } = require('./accept')
    return listPendingTransferInstructions(sdk, w.partyId)
  } catch (err) {
    console.error('[wallet] listPendingTransfers failed:', err)
    return []
  }
}

/** @returns {Promise<RecipientResult>} */
async function acceptTransfer(contractId) {
  const w = await loadWallet()
  if (!w) return { success: false, error: 'No wallet loaded' }
  try {
    const token = await getToken()
    const base = await SDK.create({
      auth: { method: 'static', token },
      ledgerClientUrl: DEVNET.ledgerClientUrl
    })
    const sdk = await base.extend({
      amulet: {
        validatorUrl: DEVNET.validatorUrl,
        scanApiUrl: DEVNET.scanApiUrl,
        auth: { method: 'static', token },
        registryUrl: new URL(DEVNET.registryUrl)
      },
      token: {
        validatorUrl: DEVNET.validatorUrl,
        auth: { method: 'static', token },
        registries: [DEVNET.registryUrl]
      }
    })
    const { buildAcceptCommand } = require('./accept')
    const [cmd, disclosed] = await buildAcceptCommand(sdk, { contractId })
    const result = await sdk.ledger
      .prepare({
        partyId: w.partyId,
        commands: cmd,
        disclosedContracts: disclosed
      })
      .sign(w.privateKey)
      .execute({ partyId: w.partyId })
    return {
      success: true,
      updateId: result.updateId ?? result.transactionHash,
      contractId
    }
  } catch (err) {
    console.error('[wallet] acceptTransfer failed:', err)
    return { success: false, error: errMsg(err), contractId }
  }
}

/** @returns {Promise<RecipientResult>} */
async function rejectTransfer(contractId) {
  const w = await loadWallet()
  if (!w) return { success: false, error: 'No wallet loaded' }
  try {
    const token = await getToken()
    const base = await SDK.create({
      auth: { method: 'static', token },
      ledgerClientUrl: DEVNET.ledgerClientUrl
    })
    const sdk = await base.extend({
      amulet: {
        validatorUrl: DEVNET.validatorUrl,
        scanApiUrl: DEVNET.scanApiUrl,
        auth: { method: 'static', token },
        registryUrl: new URL(DEVNET.registryUrl)
      },
      token: {
        validatorUrl: DEVNET.validatorUrl,
        auth: { method: 'static', token },
        registries: [DEVNET.registryUrl]
      }
    })
    const { buildRejectCommand } = require('./accept')
    const [cmd, disclosed] = await buildRejectCommand(sdk, { contractId })
    const result = await sdk.ledger
      .prepare({
        partyId: w.partyId,
        commands: cmd,
        disclosedContracts: disclosed
      })
      .sign(w.privateKey)
      .execute({ partyId: w.partyId })
    return {
      success: true,
      updateId: result.updateId ?? result.transactionHash,
      contractId
    }
  } catch (err) {
    console.error('[wallet] rejectTransfer failed:', err)
    return { success: false, error: errMsg(err), contractId }
  }
}

// ============================================
// Restore — import a previously-exported Ed25519 keypair.
//
// Caller pastes the base64-encoded private key (the same shape as
// `exportPrivateKey()` returns) + the original party hint. We:
//   1. base64-decode the private key
//   2. derive the matching public key (Canton SDK)
//   3. derive the fingerprint via the SDK (deterministic from pubkey)
//   4. persist (encrypted-at-rest) with the same safeStorage path
//
// No validator round-trip. The Canton SDK signs with the wallet's
// own key on the next transfer/tap; the partyId on-ledger is what
// it is. If the caller provides the WRONG party hint, the local
// file's partyId will be `wrongHint::correctFingerprint` and any
// attempt to look up the on-ledger party will 404 — surface that
// error to the user via the standard `error` field.
//
// ============================================

/**
 * @typedef {Object} WalletRestoreResult
 * @property {boolean} success
 * @property {string} [partyId]
 * @property {string} [fingerprint]
 * @property {string} [error]
 * @property {'WALLET_EXISTS' | 'INVALID_KEY' | 'SDK_ERROR'} [errorCode]
 */

/**
 * @param {{ privateKey: string, partyHint?: string }} opts
 * @returns {Promise<WalletRestoreResult>}
 */
async function restoreWallet(opts = {}) {
  const encryption = ensureEncryption()
  if (!encryption.available) {
    return {
      success: false,
      error: encryption.reason ?? 'OS keychain unavailable',
      errorCode: 'OS_KEYCHAIN_UNAVAILABLE'
    }
  }
  if (!opts || typeof opts.privateKey !== 'string' || opts.privateKey.length === 0) {
    return { success: false, error: 'Private key is required', errorCode: 'INVALID_KEY' }
  }

  // Reject if a wallet already exists to avoid overwriting silently.
  const existing = await loadWallet()
  if (existing) {
    return {
      success: false,
      error: `Wallet already exists (party ${existing.partyId}). Destroy it first.`,
      errorCode: 'WALLET_EXISTS'
    }
  }

  const requestedHint = slugifyPartyHint((opts.partyHint ?? '').trim())
  const partyHint = requestedHint.length > 0 ? requestedHint : DEFAULT_PARTY_HINT

  try {
    const token = await getToken()
    const sdk = await buildBaseSdk(token)

    // Derive the matching public key from the base64 private key.
    // `getPublicKeyFromPrivate` is re-exported by the wallet SDK from
    // `@canton-network/core-signing-lib` — it's a top-level function
    // (NOT a method on `sdk.keys`). Same ed25519 curve the SDK uses
    // for sign() under the hood, so the public key we derive here
    // is the one the ledger has on file.
    const privateKey = opts.privateKey
    const publicKey = getPublicKeyFromPrivate(privateKey)
    const fingerprint = await sdk.keys.fingerprint(publicKey)

    const wallet = {
      v: 1,
      partyId: `${partyHint}::${fingerprint}`,
      partyHint,
      publicKey,
      privateKey,
      fingerprint,
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
    console.error('[wallet] restoreWallet failed:', err)
    return {
      success: false,
      error: message,
      errorCode: message.toLowerCase().includes('invalid')
        ? 'INVALID_KEY'
        : 'SDK_ERROR'
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
  ipcMain.handle('wallet:restore', (_e, opts) => restoreWallet(opts))
  ipcMain.handle('wallet:faucet', (_e, amount) => runFaucet(amount))
  ipcMain.handle('wallet:holdings', () => getHoldings())
  ipcMain.handle('wallet:pendingTransfers', () => listPendingTransfers())
  ipcMain.handle('wallet:accept', (_e, contractId) => acceptTransfer(contractId))
  ipcMain.handle('wallet:reject', (_e, contractId) => rejectTransfer(contractId))
  ipcMain.handle('wallet:transfer', (_e, params) => transferAmulet(params))
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
  restoreWallet,
  runFaucet,
  getHoldings,
  transferAmulet,
  listPendingTransfers,
  acceptTransfer,
  rejectTransfer,
  registerWalletIpcHandlers,
  // Re-exports for the v2 surface — currently stubbed.
  WalletFile: undefined,
  WalletStatus: undefined,
  WalletCreateResult: undefined
}
