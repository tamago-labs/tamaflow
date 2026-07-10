// Contract operations for TamaFlow desktop app.
//
// Provides functions to query smart contracts on the Canton DevNet.
// Uses the same REST API pattern as transfer.js for ledger queries.

const { ipcMain } = require('electron')
const { DEVNET } = require('./devnet')

// ============================================
// Hardcoded DevNet OAuth credentials (same as wallet.js)
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
// Token management (same as wallet.js)
// ============================================
let cachedToken = null

function isTokenValid() {
  return cachedToken !== null && Date.now() < cachedToken.expiresAt - TOKEN_REFRESH_SKEW_MS
}

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

// ============================================
// Ledger REST API helpers (same pattern as transfer.js)
// ============================================

async function fetchLedgerApi(token, method, path, body) {
  const res = await fetch(`${DEVNET.ledgerClientUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Ledger API ${method} ${path} returned ${res.status} ${res.statusText}: ${text}`
    )
  }
  return await res.json()
}

// ============================================
// Contract query functions
// ============================================

/**
 * Fetch a contract by its contract ID using the JSON API.
 */
async function getContractById(contractId) {
  try {
    const token = await getToken()
    const result = await fetchLedgerApi(token, 'GET', `/v2/state/active-contracts?contractId=${contractId}`)
    return result
  } catch (err) {
    console.error('[contracts] Failed to fetch contract:', contractId, err)
    return null
  }
}

/**
 * Fetch JPYC balance for a party.
 * Queries active JPYCAsset contracts and sums balances.
 */
async function getJPYCBalance(partyId) {
  try {
    const token = await getToken()

    const ledgerEnd = await fetchLedgerApi(token, 'GET', '/v2/state/ledger-end')

    const requestBody = {
      eventFormat: {
        filtersByParty: {
          [partyId]: {
            cumulative: []
          }
        },
        verbose: false
      },
      activeAtOffset: ledgerEnd.offset
    }

    const result = await fetchLedgerApi(token, 'POST', '/v2/state/active-contracts', requestBody)

    const contracts = Array.isArray(result) ? result : (result?.activeContracts || [])

    let totalBalance = 0
    for (const contract of contracts) {
      const entry = contract.contractEntry?.JsActiveContract?.createdEvent
      const templateId = entry?.templateId || ''
      if (templateId.includes('a0408b35c53eb7449b5e8eff14d3f0dc4cce9f626c0da2b5f59ef37557cf4bf5:TamaFlow.JPYC.Asset:JPYCAsset')) {
        const payload = entry?.createArgument || {}
        // Only count contracts where THIS party is the owner
        if (payload.owner === partyId) {
          const amount = parseFloat(payload.amount || '0')
          totalBalance += amount
        }
      }
    }

    return totalBalance
  } catch (err) {
    console.error('[contracts] Failed to fetch JPYC balance:', err)
    return 0
  }
}

/**
 * Fetch CompanyProfile contract by ID.
 */
async function getCompanyProfile(contractId) {
  try {
    const token = await getToken()
    const result = await fetchLedgerApi(token, 'GET', `/v2/state/active-contracts?contractId=${contractId}`)
    return result
  } catch (err) {
    console.error('[contracts] Failed to fetch CompanyProfile:', contractId, err)
    return null
  }
}

/**
 * Fetch EmployeeRecord contracts for a party.
 */
async function getEmployees(partyId) {
  try {
    const token = await getToken()
    const ledgerEnd = await fetchLedgerApi(token, 'GET', '/v2/state/ledger-end')

    const requestBody = {
      eventFormat: {
        filtersByParty: {
          [partyId]: {
            cumulative: []
          }
        },
        verbose: false
      },
      activeAtOffset: ledgerEnd.offset
    }

    const result = await fetchLedgerApi(token, 'POST', '/v2/state/active-contracts', requestBody)
    const contracts = Array.isArray(result) ? result : (result?.activeContracts || [])

    const employees = []
    for (const contract of contracts) {
      const entry = contract.contractEntry?.JsActiveContract?.createdEvent
      const templateId = entry?.templateId || ''
      if (templateId.includes('EmployeeRecord')) {
        const payload = entry?.createArgument || {}
        employees.push({
          contractId: entry?.contractId,
          employer: payload.employer,
          employee: payload.employee,
          companyName: payload.companyName,
          displayName: payload.displayName,
          role: payload.role || ''
        })
      }
    }

    return employees
  } catch (err) {
    console.error('[contracts] Failed to fetch employees:', err)
    return []
  }
}

// ============================================
// IPC handler registration
// ============================================

function registerContractIpcHandlers() {
  ipcMain.handle('contracts:getContract', async (_e, contractId) => {
    return await getContractById(contractId)
  })

  ipcMain.handle('contracts:getJPYCBalance', async (_e, partyId) => {
    return await getJPYCBalance(partyId)
  })

  ipcMain.handle('contracts:getCompanyProfile', async (_e, contractId) => {
    return await getCompanyProfile(contractId)
  })

  ipcMain.handle('contracts:getEmployees', async (_e, partyId) => {
    return await getEmployees(partyId)
  })

  console.log('[contracts] IPC handlers registered')
}

module.exports = {
  registerContractIpcHandlers,
  getContractById,
  getJPYCBalance,
  getCompanyProfile,
  getEmployees
}
