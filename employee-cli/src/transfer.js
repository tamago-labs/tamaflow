// Build the TransferFactory_Transfer ExerciseCommand + disclosed contracts.
// Ported from desktop-app/electron/transfer.js for the employee-cli.

// ============================================
// Constants
// ============================================

const TRANSFER_FACTORY_INTERFACE_ID =
  '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory'

const HOLDING_INTERFACE_ID =
  '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'

const HOLDING_INTERFACE_TAIL = ':Splice.Api.Token.HoldingV1:Holding'

const AMULET_INSTRUMENT_ID = 'Amulet'

const TRANSFER_EXECUTE_BEFORE_MS = 24 * 60 * 60 * 1000

// ============================================
// Wire types
// ============================================

function toDisclosed(c) {
  return {
    templateId: c.template_id,
    contractId: c.contract_id,
    createdEventBlob: c.created_event_blob,
    ...(c.domain_id ? { synchronizerId: c.domain_id } : {})
  }
}

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

async function fetchScanProxy(token, devnetUrl, path) {
  const res = await fetch(`${devnetUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Scan-proxy GET ${path} returned ${res.status}: ${text}`)
  }
  return await res.json()
}

async function fetchLedgerApi(token, ledgerUrl, method, path, body) {
  const res = await fetch(`${ledgerUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ledger API ${method} ${path} returned ${res.status}: ${text}`)
  }
  return await res.json()
}

// ============================================
// DSO party
// ============================================

async function fetchDsoParty(token, devnetUrl) {
  const resp = await fetchScanProxy(token, devnetUrl, '/v0/scan-proxy/amulet-rules')
  const dso = (resp.amulet_rules?.contract?.payload ?? {}).dso
  if (typeof dso !== 'string' || dso.length === 0) {
    throw new Error('AmuletRules payload missing dso party field')
  }
  return dso
}

// ============================================
// Registry fetch (CIP-0056 via scan-proxy)
// ============================================

async function fetchTransferFactoryChoiceContext(token, devnetUrl, choiceArgs) {
  const res = await fetch(
    `${devnetUrl}/v0/scan-proxy/registry/transfer-instruction/v1/transfer-factory`,
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
    throw new Error(`Scan-proxy POST transfer-factory returned ${res.status}: ${text}`)
  }
  const json = await res.json()
  if (!json.factoryId) {
    throw new Error('Scan-proxy transfer-factory response missing factoryId')
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

async function fetchSenderCantonCoinHoldings(token, ledgerUrl, sender) {
  const ledgerEnd = await fetchLedgerApi(token, ledgerUrl, 'GET', '/v2/state/ledger-end')

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

  const raw = await fetchLedgerApi(token, ledgerUrl, 'POST', '/v2/state/active-contracts', {
    verbose: true,
    activeAtOffset: ledgerEnd.offset,
    filter
  })

  const contracts = flattenActiveContracts(raw)

  const out = []
  for (const c of contracts) {
    const templateId = c.templateId || ''
    if (templateId.toLowerCase().includes('lockedamulet')) continue

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

function pickInputUtxos(holdings, targetAmount) {
  const sorted = [...holdings].sort((a, b) => a.amount - b.amount)
  const picked = []
  let sum = 0
  for (const h of sorted) {
    picked.push(h)
    sum += h.amount
    if (sum >= targetAmount) return picked.map((p) => p.contractId)
  }
  throw new Error(`Insufficient Canton Coin balance: have ${sum}, need ${targetAmount}`)
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

async function buildTransferCommand(token, devnetUrl, ledgerUrl, opts) {
  const targetAmount = parseFloat(opts.amount)
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    throw new Error(`Invalid transfer amount: ${opts.amount}`)
  }

  // 1. Discover sender's CC UTXOs and pick a sufficient set.
  const holdings = await fetchSenderCantonCoinHoldings(token, ledgerUrl, opts.sender)
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
  const ctx = await fetchTransferFactoryChoiceContext(token, devnetUrl, choiceArgs)

  // 4. Merge choiceContextData into extraArgs.context per the SDK.
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

  console.log('[transfer] command built', {
    factoryId: ctx.factoryId,
    sender: opts.sender,
    recipient: opts.recipient,
    amount: opts.amount,
    inputCount: inputHoldingCids.length
  })

  return [transferCmd, ctx.disclosedContracts]
}

async function getAmuletDsoParty(token, devnetUrl) {
  return fetchDsoParty(token, devnetUrl)
}

module.exports = { buildTransferCommand, getAmuletDsoParty, toDisclosed }
