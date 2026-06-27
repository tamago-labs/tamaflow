/**
 * Build the `TransferFactory_Transfer` ExerciseCommand and its disclosed
 * contracts directly, bypassing the Wallet SDK's high-level
 * `sdk.token.transfer.create(...)`.
 *
 * Why bypass:
 *   The SDK's `token.transfer.create()` calls into the CIP-0056 token
 *   registry at the user-supplied `registryUrl` — on FiveNorth that's
 *   `https://.../api/validator` and the SDK POSTs to
 *   `…/registry/transfer-instruction/v1/transfer-factory`. That path
 *   404s on FiveNorth's hosted DevNet validator (CIP-0056-incomplete
 *   Splice build). The SAME endpoint at
 *   `…/v0/scan-proxy/registry/transfer-instruction/v1/transfer-factory`
 *   DOES work — the scan-proxy relays to a validator that hosts the
 *   registry logic and returns the factoryId + choiceContext.
 *
 *   We POST to the scan-proxy with the exact request shape the SDK
 *   uses (`{ choiceArguments, excludeDebugFields: true }`) per
 *   `@canton-network/core-token-standard-service`'s
 *   `fetchTransferFactoryChoiceContext()`. The response carries:
 *     - factoryId            (string)
 *     - transferKind         ("offer" | "direct")
 *     - choiceContextData    (Canton Map values to splice into
 *                             extraArgs.context — open-round, amulet-
 *                             rules, external-party-config-state, …)
 *     - disclosedContracts   (camelCase DisclosedContract[] for
 *                             prepare() — DSO's AmuletRules, OpenMining-
 *                             Round, etc., already in the format the
 *                             ledger JSON API v2 expects)
 *
 *   Two other primitives we still resolve ourselves, since the SDK
 *   would otherwise hit FiveNorth-broken paths too:
 *     - DSO party       ← `/v0/scan-proxy/amulet-rules` payload `dso`
 *     - input UTXOs     ← `/v2/state/active-contracts` filtered by
 *                         party=sender + interface=Holding
 *
 * Returns the same `[WrappedCommand, DisclosedContract[]]` tuple shape
 * that `sdk.token.transfer.create()` would have, so the downstream
 * `sdk.ledger.prepare({ partyId, commands, disclosedContracts })`
 * call in wallet.ts is unchanged.
 *
 * Ported from scripts/lib/tap.ts (which handles the parallel problem
 * for the faucet).
 */
import { DEVNET } from './devnet.js'

// ============================================
// Constants
// ============================================

/**
 * TransferFactory interface id (CIP-0056 Splice). Used as the
 * `InterfaceFilter` value when discovering the contract — the Canton
 * ledger API accepts interface ids with the leading `#` for that filter
 * type. We can't use this directly as a `TemplateFilter` value because
 * template filters require the fully-qualified template id
 * (`<packageId>:Module:Type`), which we only learn from the response.
 */
const TRANSFER_FACTORY_INTERFACE_ID =
  '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory'

/** Holding interface id — used to query the sender's UTXOs. */
const HOLDING_INTERFACE_ID =
  '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'

/**
 * Stable tail of the Holding interface id (no `#` prefix, no package hash).
 * Request filter accepts the `#splice-api-token-...` API form, but the
 * RESPONSE resolves to the package-qualified form
 * (`<packageId>:Splice.Api.Token.HoldingV1:Holding`). We match against
 * the trailing module path which is identical in both forms and stable
 * across Splice deployments.
 */
const HOLDING_INTERFACE_TAIL = ':Splice.Api.Token.HoldingV1:Holding'

/** Canton Coin's instrument id on this DevNet. */
const AMULET_INSTRUMENT_ID = 'Amulet'

/**
 * How long the recipient has to accept the two-step transfer before it
 * expires on-ledger. 24h matches the Splice default.
 */
const TRANSFER_EXECUTE_BEFORE_MS = 24 * 60 * 60 * 1000

// ============================================
// Wire types
// ============================================

/** Scan-proxy contract shape (snake_case). */
type ScanProxyContract = {
  template_id: string
  contract_id: string
  payload: Record<string, unknown>
  created_event_blob: string
  created_at?: string
  domain_id?: string
}

/**
 * Canton ledger API v2 active-contracts wire shape (per
 * `@canton-network/core-acs-reader`):
 *   [
 *     {
 *       workflowId: string,
 *       contractEntry: {
 *         JsActiveContract: {
 *           createdEvent: {
 *             contractId: string,
 *             templateId: string,
 *             createdEventBlob: string,
 *             interfaceViews?: Array<{...}>,
 *           },
 *           synchronizerId: string,
 *           reassignmentCounter: number,
 *         }
 *       }
 *     },
 *     ...
 *   ]
 */
type LedgerActiveContractEntry = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: {
        contractId?: string
        templateId?: string
        createdEventBlob?: string
        interfaceViews?: Array<{
          interfaceId: string
          viewStatus?: 'DISCLOSED' | 'UNDISCLOSED'
          viewValue?: Record<string, unknown>
        }>
      }
      synchronizerId?: string
    }
  }
}

/** Flattened view used downstream (matches what the SDK exposes). */
type LedgerActiveContract = {
  contractId: string
  templateId: string
  createdEventBlob: string
  synchronizerId?: string
  interfaceViews?: Array<{
    interfaceId: string
    viewStatus?: 'DISCLOSED' | 'UNDISCLOSED'
    viewValue?: Record<string, unknown>
  }>
}

/** Canton ledger API v2 `ExerciseCommand`. */
type ExerciseCommand = {
  ExerciseCommand: {
    templateId: string
    contractId: string
    choice: string
    choiceArgument: Record<string, unknown>
  }
}

/** Canton ledger API v2 `DisclosedContract` (camelCase). */
type DisclosedContract = {
  templateId: string
  contractId: string
  createdEventBlob: string
  synchronizerId?: string
}

// ============================================
// HTTP helpers
// ============================================

async function fetchScanProxy<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${DEVNET.validatorUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Scan-proxy GET ${path} returned ${res.status} ${res.statusText}: ${text}`,
    )
  }
  return (await res.json()) as T
}

async function fetchLedgerApi<T>(
  token: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${DEVNET.ledgerClientUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Ledger API ${method} ${path} returned ${res.status} ${res.statusText}: ${text}`,
    )
  }
  return (await res.json()) as T
}

// ============================================
// Discovered-state helpers
// ============================================

/**
 * Resolve the DSO party (which acts as the Canton Coin admin on this
 * DevNet). Pulled from the `dso` field of the AmuletRules singleton.
 *
 * The same endpoint powers the manual faucet flow in `tap.ts` — known
 * to work on FiveNorth's hosted validator.
 */
async function fetchDsoParty(token: string): Promise<string> {
  const resp = await fetchScanProxy<{
    amulet_rules: { contract: ScanProxyContract }
  }>(token, '/v0/scan-proxy/amulet-rules')
  const dso = (resp.amulet_rules.contract.payload as { dso?: string }).dso
  if (typeof dso !== 'string' || dso.length === 0) {
    throw new Error('AmuletRules payload missing `dso` party field')
  }
  return dso
}

/**
 * Find the TransferFactory singleton contract held by the DSO *and* the
 * choice context (Map values) that the registry needs merged into
 * `extraArgs.context` of the exercise.
 *
 * FiveNorth does not serve the registry endpoints at the SDK's expected
 * path (`…/api/validator/registry/transfer-instruction/v1/transfer-factory`
 * 404s), but it DOES serve them via the scan-proxy prefix
 * (`…/api/validator/v0/scan-proxy/registry/transfer-instruction/v1/transfer-factory`).
 * The scan-proxy relays the POST to the synchronizer validator that
 * hosts the registry and returns:
 *   { factoryId, transferKind, choiceContext: { choiceContextData, disclosedContracts } }
 *
 * Request body mirrors `TokenStandardService.fetchTransferFactoryChoiceContext`
 * in `@canton-network/core-token-standard-service`:
 *   { choiceArguments: <choice args>, excludeDebugFields: true }
 *
 * Returns the factoryId (used as the ExerciseCommand's `contractId`),
 * the transferKind (informational — `"offer"` = two-step, `"direct"` =
 * auto-accepted on-ledger), the choiceContextData Map values (spliced
 * into `extraArgs.context` per the SDK's `createTransferFromContext`),
 * and the registry-provided disclosedContracts (DSO's AmuletRules,
 * OpenMiningRound, external-party-config-state, etc. — already in
 * camelCase for the ledger JSON API v2).
 */
async function fetchTransferFactoryChoiceContext(
  token: string,
  choiceArgs: Record<string, unknown>,
): Promise<{
  factoryId: string
  transferKind?: string
  choiceContextData: Record<string, unknown> | undefined
  disclosedContracts: DisclosedContract[]
}> {
  const TAG = '[transfer.fetchTransferFactoryChoiceContext]'
  const res = await fetch(
    `${DEVNET.validatorUrl}/v0/scan-proxy/registry/transfer-instruction/v1/transfer-factory`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        choiceArguments: choiceArgs,
        excludeDebugFields: true,
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Scan-proxy POST transfer-factory returned ${res.status} ${res.statusText}: ${text}`,
    )
  }

  type RpcResponse = {
    factoryId?: string
    transferKind?: string
    choiceContext?: {
      choiceContextData?: Record<string, unknown>
      disclosedContracts?: DisclosedContract[]
    }
  }

  const json = (await res.json()) as RpcResponse
  if (!json.factoryId) {
    throw new Error(
      'Scan-proxy transfer-factory response missing `factoryId`',
    )
  }

  const disclosed = json.choiceContext?.disclosedContracts ?? []
  console.log(TAG, 'choice context received', {
    factoryId: json.factoryId,
    transferKind: json.transferKind,
    contextValues: Object.keys(
      (json.choiceContext?.choiceContextData?.values ?? {}) as Record<
        string,
        unknown
      >,
    ),
    disclosedCount: disclosed.length,
  })

  return {
    factoryId: json.factoryId,
    transferKind: json.transferKind,
    choiceContextData: json.choiceContext?.choiceContextData,
    disclosedContracts: disclosed,
  }
}

/**
 * Canton Coin UTXOs (Holdings) currently in the sender's active
 * contract set, filtered to the requested instrument.
 *
 * One round-trip returns both the interface view (for amount + filter
 * to Amulet) AND the createdEventBlob (for DisclosedContract). The SDK
 * does the same under the hood but also reaches into the CIP-0056
 * metadata registry (which 404s on FiveNorth) — going through the
 * ledger JSON API directly skips that path.
 */
async function fetchSenderCantonCoinHoldings(
  token: string,
  sender: string,
): Promise<Array<LedgerActiveContract>> {
  const ledgerEnd = await fetchLedgerApi<{ offset: string }>(
    token,
    'GET',
    '/v2/state/ledger-end',
  )

  // Canton ledger API v2 expects the request body to look like:
  //   { verbose, activeAtOffset, filter: { filtersByParty: { ... } } }
  // The OUTER `filter` key is added when we pass this object into the
  // request body below — we must NOT also wrap it here, otherwise the
  // body becomes `filter: { filter: { filtersByParty: ... } }` and the
  // server reads `body.filter.filtersByParty` as undefined → 400 with
  // "filtersByParty and filtersForAnyParty cannot be empty simultaneously".
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
                  interfaceId: HOLDING_INTERFACE_ID,
                },
              },
            },
          },
        ],
      },
    },
  }

  const raw = await fetchLedgerApi<LedgerActiveContractEntry[]>(
    token,
    'POST',
    '/v2/state/active-contracts',
    {
      verbose: true,
      activeAtOffset: ledgerEnd.offset,
      filter,
    },
  )

  // Flatten wire shape: contractEntry.JsActiveContract.createdEvent → contract.
  // Mirrors `core-acs-reader`'s `.map(acs => ({ ...acs.contractEntry.JsActiveContract.createdEvent, ... }))`.
  const contracts: LedgerActiveContract[] = (raw ?? [])
    .filter((a) => a.contractEntry?.JsActiveContract?.createdEvent)
    .map((a) => {
      const js = a.contractEntry!.JsActiveContract!
      return {
        contractId: js.createdEvent!.contractId!,
        templateId: js.createdEvent!.templateId!,
        createdEventBlob: js.createdEvent!.createdEventBlob!,
        synchronizerId: js.synchronizerId,
        interfaceViews: js.createdEvent!.interfaceViews,
      }
    })

  type HoldingView = {
    instrumentId?: { admin?: string; id?: string } | string
    amount?: string
  }

  const out: Array<LedgerActiveContract> = []
  for (const c of contracts) {
    const view = c.interfaceViews?.find((v) =>
      v.interfaceId.endsWith(HOLDING_INTERFACE_TAIL),
    )?.viewValue as HoldingView | undefined
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

/**
 * Greedy coin selection — sort holdings ascending by amount, pick the
 * smallest sufficient set. If even the largest single UTXO can't cover
 * the target, we throw — better to surface that than to submit a tx
 * that the ledger will reject anyway.
 */
function pickInputUtxos(
  holdings: Array<{ contractId: string; amount: number }>,
  targetAmount: number,
): string[] {
  const sorted = [...holdings].sort((a, b) => a.amount - b.amount)
  const picked: Array<{ contractId: string; amount: number }> = []
  let sum = 0
  for (const h of sorted) {
    picked.push(h)
    sum += h.amount
    if (sum >= targetAmount) return picked.map((p) => p.contractId)
  }
  throw new Error(
    `Insufficient Canton Coin balance: have ${sum}, need ${targetAmount}`,
  )
}

// ============================================
// ISO-8601 timestamp in UTC (Canton Time is RFC 3339 / ISO 8601).
// ============================================
function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

// ============================================
// Public: build the ExerciseCommand + disclosures
// ============================================

export interface BuildTransferOptions {
  /** Sender's partyId. */
  sender: string
  /** Recipient's partyId. */
  recipient: string
  /** Decimal amount string, e.g. "1.5000000000" (10 fractional digits). */
  amount: string
  /** DSO / instrument admin partyId (passed in to avoid refetching). */
  dsoParty: string
}

/**
 * Build the transfer ExerciseCommand and its disclosed contracts.
 *
 * The returned tuple matches `sdk.token.transfer.create(...)` so the
 * caller's `sdk.ledger.prepare({ partyId, commands, disclosedContracts })`
 * step is identical to the high-level path.
 *
 * Flow:
 *   1. Discover sender's CC UTXOs and pick a sufficient set.
 *   2. Assemble choice arguments (TransferFactory_Transfer schema per
 *      `@canton-network/core-token-standard`).
 *   3. POST to the scan-proxy `/registry/transfer-instruction/v1/transfer-factory`
 *      to get the factoryId + choiceContext (Map values for
 *      `extraArgs.context`) + DSO's disclosed contracts.
 *   4. Merge `choiceContextData` into `extraArgs.context` per the SDK's
 *      `createTransferFromContext`.
 *   5. Return `[exercise, disclosedContracts]` from the registry — the
 *      input UTXOs do not need disclosure (sender already owns them).
 */
export async function buildTransferCommand(
  token: string,
  opts: BuildTransferOptions,
): Promise<[ExerciseCommand, DisclosedContract[]]> {
  const TAG = '[transfer.buildTransferCommand]'

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
    const view = h.interfaceViews?.find(
      (v) => v.interfaceId.endsWith(HOLDING_INTERFACE_TAIL),
    )?.viewValue as
      | {
          amount?: string | number | { initialAmount?: string | number }
        }
      | undefined
    // `amount` is an `AmuletAmount` record on the wire:
    //   { initialAmount: "1000.0000000000", createdAt: { number }, ratePerRound: { rate } }
    // We just want the initial amount for UTXO selection (the actual
    // current balance decays over rounds; for picking inputs we use the
    // max the holder is entitled to).
    const rawAmount =
      typeof view?.amount === 'object' && view?.amount !== null
        ? view.amount.initialAmount
        : view?.amount
    return {
      contract: h,
      contractId: h.contractId,
      amount: parseFloat(String(rawAmount ?? '0')),
    }
  })
  const inputHoldingCids = pickInputUtxos(withAmounts, targetAmount)

  // 2. Assemble the TransferFactory_Transfer choice argument.
  //    Per `@canton-network/core-token-standard`:
  //      choiceArgument = {
  //        expectedAdmin: Party,
  //        transfer: Transfer = {
  //          sender, receiver: Party
  //          amount: Numeric(10)            — string
  //          instrumentId: InstrumentId = { admin: Party, id: string }
  //          requestedAt, executeBefore: ISO-8601 string
  //          inputHoldingCids: List(ContractId)
  //          meta: { values: TextMap(Text) }
  //        },
  //        extraArgs: { context: { values: {} }, meta: { values: {} } }
  //      }
  const choiceArgs: Record<string, unknown> = {
    expectedAdmin: opts.dsoParty,
    transfer: {
      sender: opts.sender,
      receiver: opts.recipient,
      amount: opts.amount,
      instrumentId: {
        admin: opts.dsoParty,
        id: AMULET_INSTRUMENT_ID,
      },
      requestedAt: isoNow(),
      executeBefore: isoNow(TRANSFER_EXECUTE_BEFORE_MS),
      inputHoldingCids,
      meta: { values: {} },
    },
    extraArgs: {
      context: { values: {} },
      meta: { values: {} },
    },
  }

  // 3. Ask the registry (via scan-proxy) for the factoryId + choice
  //    context. This is what `sdk.token.transfer.create()` does
  //    internally — we just hit the scan-proxy URL FiveNorth supports.
  const ctx = await fetchTransferFactoryChoiceContext(token, choiceArgs)

  // 4. Merge `choiceContextData` into `extraArgs.context` per the SDK's
  //    `createTransferFromContext`:
  //      choiceArgs.extraArgs.context = {
  //        ...choiceContext.choiceContextData,
  //        values: choiceContext.choiceContextData?.values ?? {},
  //      }
  const contextValues =
    ((ctx.choiceContextData?.values ?? {}) as Record<string, unknown>)
  const choiceArgument: Record<string, unknown> = {
    ...choiceArgs,
    extraArgs: {
      ...(choiceArgs.extraArgs as Record<string, unknown>),
      context: {
        ...(ctx.choiceContextData ?? {}),
        values: contextValues,
      },
    },
  }

  // 5. Build the ExerciseCommand. The SDK uses the interface id
  //    (`#splice-api-token-transfer-instruction-v1:...:TransferFactory`)
  //    as the `templateId` field — Canton accepts either a fully-qualified
  //    template id OR an interface id (with leading `#`) in this slot,
  //    and the interface id is stable across Splice deployments.
  const transferCmd: ExerciseCommand = {
    ExerciseCommand: {
      templateId: TRANSFER_FACTORY_INTERFACE_ID,
      contractId: ctx.factoryId,
      choice: 'TransferFactory_Transfer',
      choiceArgument,
    },
  }

  console.log(TAG, 'transfer command built', {
    factoryId: ctx.factoryId,
    transferKind: ctx.transferKind,
    sender: opts.sender,
    recipient: opts.recipient,
    amount: opts.amount,
    inputCount: inputHoldingCids.length,
    contextKeys: Object.keys(contextValues),
  })

  return [transferCmd, ctx.disclosedContracts]
}

/**
 * Fetch the DSO party used by the Amulet instrument. Exposed so the
 * caller can cache it alongside the token to avoid re-fetching
 * AmuletRules on every transfer.
 */
export async function getAmuletDsoParty(token: string): Promise<string> {
  return fetchDsoParty(token)
}
