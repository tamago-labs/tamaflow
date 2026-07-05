// Build the `TransferFactory_Transfer` ExerciseCommand + disclosed
// contracts, bypassing the SDK's `sdk.token.transfer.create(...)`.
//
// Why bypass: the SDK's high-level path POSTs to
// `${registryUrl}/registry/transfer-instruction/v1/transfer-factory`
// (CIP-0056). On FiveNorth's hosted DevNet, that path 404s. The SAME
// endpoint at
// `${validatorUrl}/v0/scan-proxy/registry/transfer-instruction/v1/transfer-factory`
// DOES work — the scan-proxy relays to a synchronizer validator that
// hosts the registry. We POST there, parse the response, merge
// `choiceContextData` into `extraArgs.context` per the SDK's
// `createTransferFromContext`, and return the same
// `[WrappedCommand, DisclosedContract[]]` tuple shape that
// `sdk.token.transfer.create()` would have.
//
// Other primitives we still resolve ourselves since the SDK would hit
// FiveNorth-broken paths too:
//   - DSO party       ← `/v0/scan-proxy/amulet-rules` payload `dso`
//   - input UTXOs     ← `/v2/state/active-contracts` filtered by
//                       party=sender + interface=Holding
//
// Returns the same `[WrappedCommand, DisclosedContract[]]` tuple
// shape that `sdk.token.transfer.create()` would have.

const { DEVNET } = require('./devnet')

// ============================================
// Constants
// ============================================

/** TransferFactory interface id (CIP-0056 Splice). The Canton ledger
 *  API accepts interface ids with the leading `#` in the
 *  `templateId` slot. */
const TRANSFER_FACTORY_INTERFACE_ID =
  '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory'

/** Holding interface id — used to query the sender's UTXOs. */
const HOLDING_INTERFACE_ID =
  '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'

/** Stable tail of the Holding interface id (no `#` prefix, no
 *  package hash). The RESPONSE resolves to the package-qualified form
 *  (`<packageId>:Splice.Api.Token.HoldingV1:Holding`) but the trailing
 *  module path is identical. */
const HOLDING_INTERFACE_TAIL = ':Splice.Api.Token.HoldingV1:Holding'

/** Canton Coin's instrument id on this DevNet. */
const AMULET_INSTRUMENT_ID = 'Amulet'

/** Recipient window to accept the two-step transfer (Splice default). */
const TRANSFER_EXECUTE_BEFORE_MS = 24 * 60 * 60 * 1000

// ============================================
// Wire types
// ============================================

/** Scan-proxy contract shape (snake_case). */
function toDisclosed(c) {
  return {
    templateId: c.template_id,
    contractId: c.contract_id,
    createdEventBlob: c.created_event_blob,
    ...(c.domain_id ? { synchronizerId: c.domain_id } : {})
  }
}

/** Canton ledger API v2 active-contracts wire shape. */
function flattenActiveContracts(raw) {
  return (raw ?? [])
    .filter((a) => a.contractEntry?.JsActiveContract?.createdEvent)
    .map((a) => {
      const js = a.contractEntry.JsActiveContract
      return {
        contractId: js.createdEvent.contractId,
        templateId: js.createdEvent.templateId,
        createdEventBlob: js.createdEvent.createdEventBlob,
        synchronizerId: js.synchronizerId,
        interfaceViews: js.createdEvent.interfaceViews
      }
    })
}

// ============================================
// HTTP helpers
// ============================================

async function fetchScanProxy(token, path) {
  const res = await fetch(`${DEVNET.validatorUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Scan-proxy GET ${path} returned ${res.status} ${res.statusText}: ${text}`
    )
  }
  return await res.json()
}

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
// DSO party
// ============================================

/** Resolve the DSO party (which acts as the Canton Coin admin on this
 *  DevNet) from the AmuletRules singleton's `dso` field. */
async function fetchDsoParty(token) {
  const resp = await fetchScanProxy(token, '/v0/scan-proxy/amulet-rules')
  const dso = (resp.amulet_rules?.contract?.payload ?? {}).dso
  if (typeof dso !== 'string' || dso.length === 0) {
    throw new Error('AmuletRules payload missing `dso` party field')
  }
  return dso
}

// ============================================
// Registry fetch (CIP-0056 via scan-proxy)
// ============================================

/**
 * POST to the scan-proxy transfer-factory endpoint to get the
 * factoryId + choiceContext (Map values for `extraArgs.context`) +
 * DSO's disclosed contracts.
 */
async function fetchTransferFactoryChoiceContext(token, choiceArgs) {
  const res = await fetch(
    `${DEVNET.validatorUrl}/v0/scan-proxy/registry/transfer-instruction/v1/transfer-factory`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        choiceArguments: choiceArgs,
        excludeDebugFields: true
      })
    }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Scan-proxy POST transfer-factory returned ${res.status} ${res.statusText}: ${text}`
    )
  }
  const json = await res.json()
  if (!json.factoryId) {
    throw new Error('Scan-proxy transfer-factory response missing `factoryId`')
  }
  const disclosed = json.choiceContext?.disclosedContracts ?? []
  return {
    factoryId: json.factoryId,
    transferKind: json.transferKind,
    choiceContextData: json.choiceContext?.choiceContextData,
    disclosedContracts: disclosed
  }
}

// ============================================
// Sender Canton Coin UTXOs
// ============================================

/** Canton Coin UTXOs (Holdings) currently in the sender's active
 *  contract set, filtered to the requested instrument. */
async function fetchSenderCantonCoinHoldings(token, sender) {
  const ledgerEnd = await fetchLedgerApi(token, 'GET', '/v2/state/ledger-end')

  const filter = {
    filtersByParty: {
      [sender]: {
        cumulative: [
          {
            identifierFilter: {
              InterfaceFilter: {
                value: {
                  includeInterfaceView: true,
                  includeCreatedEventBlob: true,
                  interfaceId: HOLDING_INTERFACE_ID
                }
              }
            }
          }
        ]
      }
    }
  }

  const raw = await fetchLedgerApi(token, 'POST', '/v2/state/active-contracts', {
    verbose: true,
    activeAtOffset: ledgerEnd.offset,
    filter
  })

  const contracts = flattenActiveContracts(raw)
  const out = []
  for (const c of contracts) {
    const view = c.interfaceViews?.find((v) =>
      v.interfaceId.endsWith(HOLDING_INTERFACE_TAIL)
    )?.viewValue
    const iid =
      (typeof view?.instrumentId === 'object'
        ? view?.instrumentId?.id
        : view?.instrumentId) ?? null
    if (iid !== AMULET_INSTRUMENT_ID) continue
    out.push(c)
  }
  return out
}

// ============================================
// UTXO selection
// ============================================

/** Greedy coin selection — pick the smallest sufficient set. */
function pickInputUtxos(holdings, targetAmount) {
  const sorted = [...holdings].sort((a, b) => a.amount - b.amount)
  const picked = []
  let sum = 0
  for (const h of sorted) {
    picked.push(h)
    sum += h.amount
    if (sum >= targetAmount) return picked.map((p) => p.contractId)
  }
  throw new Error(
    `Insufficient Canton Coin balance: have ${sum}, need ${targetAmount}`
  )
}

// ============================================
// ISO-8601 timestamp
// ============================================

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString()
}

// ============================================
// Public: build the ExerciseCommand + disclosures
// ============================================

/**
 * Build the transfer ExerciseCommand and its disclosed contracts.
 * Returns `[exercise, disclosedContracts]` ready to feed into
 * `sdk.ledger.prepare({ partyId, commands, disclosedContracts })`.
 *
 * @param {string} token Bearer JWT.
 * @param {{ sender: string, recipient: string, amount: string, dsoParty: string }} opts
 */
async function buildTransferCommand(token, opts) {
  const targetAmount = parseFloat(opts.amount)
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    throw new Error(`Invalid transfer amount: ${opts.amount}`)
  }

  // 1. Discover sender's CC UTXOs and pick a sufficient set.
  const holdings = await fetchSenderCantonCoinHoldings(token, opts.sender)
  if (holdings.length === 0) {
    throw new Error(`No Canton Coin holdings found for sender ${opts.sender}`)
  }
  const withAmounts = holdings.map((h) => {
    const view = h.interfaceViews?.find((v) =>
      v.interfaceId.endsWith(HOLDING_INTERFACE_TAIL)
    )?.viewValue
    const rawAmount =
      typeof view?.amount === 'object' && view?.amount !== null
        ? view.amount.initialAmount
        : view?.amount
    return {
      contract: h,
      contractId: h.contractId,
      amount: parseFloat(String(rawAmount ?? '0'))
    }
  })
  const inputHoldingCids = pickInputUtxos(withAmounts, targetAmount)

  // 2. Assemble the TransferFactory_Transfer choice argument.
  const choiceArgs = {
    expectedAdmin: opts.dsoParty,
    transfer: {
      sender: opts.sender,
      receiver: opts.recipient,
      amount: opts.amount,
      instrumentId: {
        admin: opts.dsoParty,
        id: AMULET_INSTRUMENT_ID
      },
      requestedAt: isoNow(),
      executeBefore: isoNow(TRANSFER_EXECUTE_BEFORE_MS),
      inputHoldingCids,
      meta: { values: {} }
    },
    extraArgs: {
      context: { values: {} },
      meta: { values: {} }
    }
  }

  // 3. Ask the registry for the factoryId + choice context.
  const ctx = await fetchTransferFactoryChoiceContext(token, choiceArgs)

  // 4. Merge `choiceContextData` into `extraArgs.context` per the SDK.
  const contextValues = ctx.choiceContextData?.values ?? {}
  const choiceArgument = {
    ...choiceArgs,
    extraArgs: {
      ...choiceArgs.extraArgs,
      context: {
        ...(ctx.choiceContextData ?? {}),
        values: contextValues
      }
    }
  }

  // 5. Build the ExerciseCommand.
  const transferCmd = {
    ExerciseCommand: {
      templateId: TRANSFER_FACTORY_INTERFACE_ID,
      contractId: ctx.factoryId,
      choice: 'TransferFactory_Transfer',
      choiceArgument
    }
  }

  console.log('[transfer] transfer command built', {
    factoryId: ctx.factoryId,
    transferKind: ctx.transferKind,
    sender: opts.sender,
    recipient: opts.recipient,
    amount: opts.amount,
    inputCount: inputHoldingCids.length,
    contextKeys: Object.keys(contextValues)
  })

  return [transferCmd, ctx.disclosedContracts]
}

/** Fetch the DSO party for the Amulet instrument. Exposed so the
 *  caller can cache it to avoid re-fetching AmuletRules on every
 *  transfer. */
async function getAmuletDsoParty(token) {
  return fetchDsoParty(token)
}

module.exports = { buildTransferCommand, getAmuletDsoParty, toDisclosed }
