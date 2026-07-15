// Contract operations for TamaFlow desktop app.
//
// Provides functions to query smart contracts on the Canton DevNet.
// Uses the same REST API pattern as transfer.js for ledger queries.

const { ipcMain } = require('electron')
const { SDK } = require('@canton-network/wallet-sdk')
const { DEVNET } = require('./devnet')
const { TEMPLATES, CONTRACTS } = require('./contracts-ids')

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

async function buildBaseSdk(token) {
  return await SDK.create({
    auth: { method: 'static', token },
    ledgerClientUrl: DEVNET.ledgerClientUrl
  })
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
      if (templateId.includes(TEMPLATES.JPYC_ASSET)) {
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
        verbose: true
      },
      activeAtOffset: ledgerEnd.offset
    }

    const result = await fetchLedgerApi(token, 'POST', '/v2/state/active-contracts', requestBody)
    const contracts = Array.isArray(result) ? result : (result?.activeContracts || [])

    const employees = []
    for (const contract of contracts) {
      const entry = contract.contractEntry?.JsActiveContract?.createdEvent
      const templateId = entry?.templateId || ''
      if (templateId.includes(TEMPLATES.EMPLOYEE_RECORD)) {
        const payload = entry?.createArgument || {}
        employees.push({
          contractId: entry?.contractId,
          employer: payload.employer,
          employee: payload.employee,
          companyName: payload.companyName,
          displayName: payload.displayName,
          role: payload.role || '',
          blocks: payload.blocks || {},
          offset: entry?.offset || 0
        })
      }
    }

    return employees
  } catch (err) {
    console.error('[contracts] Failed to fetch employees:', err)
    return []
  }
}

/**
 * Exercise AddEmployee choice on a CompanyProfile contract.
 */
async function addEmployee(companyContractId, employeePartyId, displayName, role) {
  try {
    const token = await getToken()
    const sdk = await buildBaseSdk(token)

    // Get wallet info for signing
    const { getWalletStatus } = require('./wallet')
    const wallet = await getWalletStatus()
    if (!wallet.exists) throw new Error('No wallet')

    // Build the exercise command
    const command = {
      ExerciseCommand: {
        templateId: TEMPLATES.COMPANY_PROFILE,
        contractId: companyContractId,
        choice: 'AddEmployee',
        choiceArgument: {
          employee: employeePartyId,
          displayName: displayName,
          role: role || ''
        }
      }
    }

    // Load wallet for signing
    const { loadWallet } = require('./wallet')
    const walletData = await loadWallet()
    if (!walletData) throw new Error('No wallet data')

    const preparedTx = sdk.ledger.prepare({
      commands: [command],
      partyId: wallet.partyId
    })
    const result = await preparedTx.sign(walletData.privateKey).execute({
      partyId: wallet.partyId
    })

    console.log('[contracts] AddEmployee result:', result)
    return { success: true, updateId: result.updateId }
  } catch (err) {
    console.error('[contracts] Failed to add employee:', err)
    throw err
  }
}

/**
 * Exercise CreatePayslip choice on a CompanyProfile contract.
 */
async function createPayslip(companyContractId, employeePartyId, payslipId, period) {
  try {
    const token = await getToken()
    const sdk = await buildBaseSdk(token)

    const { getWalletStatus } = require('./wallet')
    const wallet = await getWalletStatus()
    if (!wallet.exists) throw new Error('No wallet')

    const command = {
      ExerciseCommand: {
        templateId: TEMPLATES.COMPANY_PROFILE,
        contractId: companyContractId,
        choice: 'CreatePayslip',
        choiceArgument: {
          employee: employeePartyId,
          payslipId,
          period
        }
      }
    }

    const { loadWallet } = require('./wallet')
    const walletData = await loadWallet()
    if (!walletData) throw new Error('No wallet data')

    const preparedTx = sdk.ledger.prepare({
      commands: [command],
      partyId: wallet.partyId
    })
    const result = await preparedTx.sign(walletData.privateKey).execute({
      partyId: wallet.partyId
    })

    console.log('[contracts] CreatePayslip result:', result.updateId)
    return { success: true, updateId: result.updateId }
  } catch (err) {
    console.error('[contracts] Failed to create payslip:', err)
    throw err
  }
}

/**
 * Exercise ConfirmBlock or RejectBlock on an EmployeeRecord contract.
 */
async function exerciseBlockChoice(contractId, choice, blockId) {
  try {
    const token = await getToken()
    const sdk = await buildBaseSdk(token)

    const { getWalletStatus } = require('./wallet')
    const wallet = await getWalletStatus()
    if (!wallet.exists) throw new Error('No wallet')

    const command = {
      ExerciseCommand: {
        templateId: TEMPLATES.EMPLOYEE_RECORD,
        contractId,
        choice,
        choiceArgument: { blockId }
      }
    }

    const { loadWallet } = require('./wallet')
    const walletData = await loadWallet()
    if (!walletData) throw new Error('No wallet data')

    const preparedTx = sdk.ledger.prepare({
      commands: [command],
      partyId: wallet.partyId
    })
    const result = await preparedTx.sign(walletData.privateKey).execute({
      partyId: wallet.partyId
    })

    console.log('[contracts]', choice, 'result:', result.updateId)
    return { success: true, updateId: result.updateId }
  } catch (err) {
    console.error('[contracts] Failed to', choice, ':', err)
    throw err
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

  ipcMain.handle('contracts:addEmployee', async (_e, companyContractId, employeePartyId, displayName, role) => {
    return await addEmployee(companyContractId, employeePartyId, displayName, role)
  })

  ipcMain.handle('contracts:exerciseBlockChoice', async (_e, contractId, choice, blockId) => {
    return await exerciseBlockChoice(contractId, choice, blockId)
  })

  ipcMain.handle('contracts:createPayslip', async (_e, companyContractId, employeePartyId, payslipId, period) => {
    return await createPayslip(companyContractId, employeePartyId, payslipId, period)
  })

  console.log('[contracts] IPC handlers registered')
}

module.exports = {
  registerContractIpcHandlers,
  getContractById,
  getJPYCBalance,
  getCompanyProfile,
  getEmployees,
  addEmployee,
  exerciseBlockChoice,
  createPayslip
}
