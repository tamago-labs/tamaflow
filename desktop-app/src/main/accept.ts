/**
 * Recipient-side `TransferInstruction` operations: list pending incoming
 * transfers, and build the Accept / Reject ExerciseCommands.
 *
 * This is the COUNTERPART to `transfer.ts` (which handles the sender-side
 * `TransferFactory_Transfer`). Canton defaults Splice transfers to the
 * two-step (offer) mode where the recipient must explicitly exercise
 * `TransferInstruction_Accept` to claim the locked CC, otherwise the
 * offer expires after `executeBefore` (24h default) and the funds
 * return to the sender.
 *
 * The Loop SDK doesn't expose a recipient-side accept() method, so the
 * desktop wallet's own key must sign the accept exercise. We delegate
 * to the Canton Wallet SDK's `token.transfer` namespace
 * (`@canton-network/wallet-sdk/dist/wallet/namespace/token/transfer`):
 *
 *   - Listing   ← `sdk.token.transfer.pending(partyId)`
 *   - Accept    ← `sdk.token.transfer.accept({ transferInstructionCid, registryUrl })`
 *   - Reject    ← `sdk.token.transfer.reject({ transferInstructionCid, registryUrl })`
 *
 * Why pass the SCAN-PROXY URL as `registryUrl`:
 *   The SDK calls into the CIP-0056 token registry at
 *   `${registryUrl}/registry/transfer-instruction/v1/{cid}/choice-contexts/accept`
 *   (and `/reject`). On FiveNorth's hosted DevNet validator, that path
 *   404s — only the scan-proxy prefix (`/v0/scan-proxy/registry/...`)
 *   works. Same pattern as `transfer.ts` for the transfer-factory
 *   endpoint.
 *
 * Status tag gotcha (caught when the manual filter returned 0 results):
 *   `TransferInstructionStatus` is a Splice DAML variant whose pending
 *   tag is `'TransferPendingReceiverAcceptance'` — NOT `'Pending'`. The
 *   SDK's `pending()` returns ALL TransferInstruction contracts visible
 *   to the party (regardless of status), so we filter client-side for
 *   that exact tag. See
 *   `@canton-network/core-token-standard` `TransferInstructionStatus`.
 *
 * Returns the same `[WrappedCommand, DisclosedContract[]]` tuple shape
 * the SDK emits, so the downstream
 * `sdk.ledger.prepare({ partyId, commands, disclosedContracts })` call
 * in wallet.ts is unchanged.
 */
import type { SDKInterface } from '@canton-network/wallet-sdk'
import { DEVNET } from './devnet.js'

// ============================================
// Constants
// ============================================

/**
 * Splice DAML variant tag for a `TransferInstruction` that is still
 * awaiting the receiver's acceptance. Defined in
 * `@canton-network/core-token-standard`'s `TransferInstructionStatus`
 * (along with `TransferPendingInternalWorkflow` for in-flight
 * workflow steps). Any other tag means the offer has already been
 * completed, withdrawn, or failed — we filter those out.
 */
const TRANSFER_PENDING_RECEIVER_ACCEPTANCE = 'TransferPendingReceiverAcceptance'

// ============================================
// Public return types
// ============================================

/**
 * Return type of `buildAcceptCommand` / `buildRejectCommand`. Matches
 * the SDK's `PreparedCommand` tuple — `[WrappedCommand,
 * DisclosedContract[]]` — but expressed as `Awaited<ReturnType<…>>` so
 * we don't have to redeclare the SDK's internal wrapped-command types
 * (which are not exported from `@canton-network/wallet-sdk`). The
 * downstream `sdk.ledger.prepare({ commands, disclosedContracts })`
 * call in wallet.ts accepts this exact shape.
 */
type AcceptRejectResult = Awaited<
  ReturnType<
    NonNullable<SDKInterface<'token'>['token']>['transfer']['accept']
  >
>

/**
 * A pending incoming transfer visible to the wallet's party. Mirrors
 * the fields the renderer needs to render the dashboard card.
 */
export interface PendingTransfer {
  /** Contract id of the `TransferInstruction` contract. */
  contractId: string
  /** Sender's partyId. */
  sender: string
  /** Receiver's partyId (== wallet party on this filter). */
  receiver: string
  /**
   * Initial transfer amount as a Numeric(10) decimal string (e.g.
   * "10.0000000000"). The actual on-ledger value decays over rounds;
   * for the recipient UI we display the initial amount.
   */
  amount: string
  /** Instrument id (e.g. "Amulet"). */
  instrumentId: string
  /** ISO-8601 expiry — recipient must accept before this time. */
  executeBefore: string
  /** Optional reconciliation memo from the sender. */
  memo?: string
}

// ============================================
// SDK view shape
// ============================================

/**
 * Decoded view of a `TransferInstruction` contract. The Canton SDK
 * (`core-token-standard`'s `TransferInstructionView`) types these fields
 * strictly, but we keep a permissive local shape so a Splice schema bump
 * surfaces as a runtime warning rather than a TS build error.
 */
type TransferInstructionViewLocal = {
  transfer?: {
    sender?: string
    receiver?: string
    amount?: string | number | { initialAmount?: string | number }
    instrumentId?: string | { admin?: string; id?: string }
    executeBefore?: string
  }
  status?: { tag?: string; value?: Record<string, unknown> }
  meta?: { values?: Record<string, string> }
}

// ============================================
// Registry URL helper
// ============================================

/**
 * Returns the registry URL the SDK should hit for CIP-0056 endpoints.
 *
 * The SDK appends `/registry/transfer-instruction/v1/...` to whatever
 * base URL we pass, so we point it at the scan-proxy prefix that
 * FiveNorth's hosted DevNet actually serves. Wrapped in `new URL()`
 * because `TransferAllocationChoiceParams.registryUrl` is typed as
 * `URL`, not `string`.
 */
function scanProxyRegistryUrl(): URL {
  return new URL(`${DEVNET.validatorUrl}/v0/scan-proxy`)
}

// ============================================
// SDK accessor
// ============================================

/**
 * Narrow the extended SDK down to one with the `token` namespace
 * attached. `token.transfer.{pending,accept,reject}` lives here, so the
 * caller must use `buildExtendedSdk()` (with `token` config), not
 * `buildBaseSdk()`.
 */
function getTokenTransfer(
  sdk: SDKInterface<'token'>,
): NonNullable<SDKInterface<'token'>['token']>['transfer'] {
  if (!sdk.token?.transfer) {
    throw new Error(
      'SDK was built without the `token` extension — token.transfer namespace is missing. ' +
        'Use buildExtendedSdk() (with token config) for recipient-side operations.',
    )
  }
  return sdk.token.transfer
}

// ============================================
// List pending transfers
// ============================================

/**
 * Find pending `TransferInstruction` contracts where `receiver` is the
 * given party (i.e. incoming offers to the wallet).
 *
 * Delegates to the SDK's `sdk.token.transfer.pending(partyId)`, which
 * under the hood calls
 * `tokenStandardService.listContractsByInterface(TransferInstruction,
 * partyId)`. The SDK returns ALL TransferInstruction contracts visible
 * to the party regardless of status, so we filter client-side for
 * `status.tag === 'TransferPendingReceiverAcceptance'`.
 */
export async function listPendingTransferInstructions(
  sdk: SDKInterface<'token'>,
  receiver: string,
): Promise<PendingTransfer[]> {
  const TAG = '[accept.listPendingTransferInstructions]'

  const tokenTransfer = getTokenTransfer(sdk)
  const contracts = await tokenTransfer.pending(receiver)

  const out: PendingTransfer[] = []
  for (const c of contracts) {
    const view = c.interfaceViewValue as TransferInstructionViewLocal | undefined
    if (!view?.transfer) continue

    // Only show offers the wallet itself is the receiver of.
    if (view.transfer.receiver !== receiver) continue
    // Only show offers still in the receiver-acceptance pending state.
    if (view.status?.tag !== TRANSFER_PENDING_RECEIVER_ACCEPTANCE) continue

    const t = view.transfer

    const rawAmount =
      typeof t.amount === 'object' && t.amount !== null
        ? t.amount.initialAmount
        : t.amount
    const amountStr = String(rawAmount ?? '0')

    const instrumentIdObj =
      typeof t.instrumentId === 'object' && t.instrumentId !== null
        ? t.instrumentId
        : null
    const instrumentId: string =
      instrumentIdObj?.id ??
      (typeof t.instrumentId === 'string' ? t.instrumentId : '') ??
      ''

    const memo = view.meta?.values?.['memo']

    out.push({
      contractId: c.contractId,
      sender: t.sender ?? '',
      receiver: t.receiver ?? receiver,
      amount: amountStr,
      instrumentId,
      executeBefore: t.executeBefore ?? '',
      ...(memo ? { memo } : {}),
    })
  }

  console.log(TAG, 'found', out.length, 'pending transfers for', receiver)
  return out
}

// ============================================
// Build Accept / Reject commands
// ============================================

export interface AcceptRejectOptions {
  /** Contract id of the `TransferInstruction` to accept / reject. */
  contractId: string
}

/**
 * Build the `TransferInstruction_Accept` ExerciseCommand and its
 * disclosed contracts.
 *
 * Delegates to `sdk.token.transfer.accept`, which:
 *   1. POSTs the choice-context fetch to
 *      `${registryUrl}/registry/transfer-instruction/v1/{cid}/choice-contexts/accept`
 *      (FiveNorth doesn't host the non-scan-proxy registry endpoint).
 *   2. Wraps the resulting command as `{ ExerciseCommand: ... }` and
 *      returns it alongside the disclosed contracts (DSO's AmuletRules,
 *      OpenMiningRound, etc.) needed by `sdk.ledger.prepare()`.
 *
 * The output shape is the SDK's `PreparedCommand = [WrappedCommand,
 * DisclosedContract[]]`, ready to feed into
 * `sdk.ledger.prepare({ commands, disclosedContracts })`.
 */
export async function buildAcceptCommand(
  sdk: SDKInterface<'token'>,
  opts: AcceptRejectOptions,
): Promise<AcceptRejectResult> {
  const TAG = '[accept.buildAcceptCommand]'
  const tokenTransfer = getTokenTransfer(sdk)

  const [wrapped, disclosed] = await tokenTransfer.accept({
    transferInstructionCid: opts.contractId,
    registryUrl: scanProxyRegistryUrl(),
  })

  const disclosedCount = Array.isArray(disclosed) ? disclosed.length : 0
  console.log(TAG, 'accept command built', {
    contractId: opts.contractId,
    disclosedCount,
  })

  return [wrapped, disclosed]
}

/**
 * Build the `TransferInstruction_Reject` ExerciseCommand and its
 * disclosed contracts.
 *
 * Same shape as accept; only the choice name and the registry path
 * segment (`/reject`) differ. Delegates to
 * `sdk.token.transfer.reject`.
 */
export async function buildRejectCommand(
  sdk: SDKInterface<'token'>,
  opts: AcceptRejectOptions,
): Promise<AcceptRejectResult> {
  const TAG = '[accept.buildRejectCommand]'
  const tokenTransfer = getTokenTransfer(sdk)

  const [wrapped, disclosed] = await tokenTransfer.reject({
    transferInstructionCid: opts.contractId,
    registryUrl: scanProxyRegistryUrl(),
  })

  console.log(TAG, 'reject command built', {
    contractId: opts.contractId,
    disclosedCount: Array.isArray(disclosed) ? disclosed.length : 0,
  })

  return [wrapped, disclosed]
}