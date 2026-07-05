// Recipient-side `TransferInstruction` operations: list pending
// incoming transfers, and build the Accept / Reject ExerciseCommands.
//
// COUNTERPART to `transfer.js` (which handles the sender-side
// `TransferFactory_Transfer`). Canton defaults Splice transfers to
// two-step (offer) mode: the recipient must explicitly exercise
// `TransferInstruction_Accept` to claim the locked CC, otherwise the
// offer expires after `executeBefore` (24h default) and the funds
// return to the sender.
//
// We delegate to the Canton Wallet SDK's `token.transfer` namespace
// (`@canton-network/wallet-sdk/dist/wallet/namespace/token/transfer`):
//   - Listing   ← `sdk.token.transfer.pending(partyId)`
//   - Accept    ← `sdk.token.transfer.accept({ transferInstructionCid, registryUrl })`
//   - Reject    ← `sdk.token.transfer.reject({ transferInstructionCid, registryUrl })`
//
// Why pass the SCAN-PROXY URL as `registryUrl`:
//   The SDK calls into the CIP-0056 token registry at
//   `${registryUrl}/registry/transfer-instruction/v1/{cid}/choice-contexts/accept`
//   (and `/reject`). On FiveNorth's hosted DevNet, that path 404s —
//   only the scan-proxy prefix (`/v0/scan-proxy/registry/...`) works.
//
// Status tag gotcha: `TransferInstructionStatus` is a Splice DAML
// variant whose pending tag is `'TransferPendingReceiverAcceptance'` —
// NOT `'Pending'`. The SDK's `pending()` returns ALL
// `TransferInstruction` contracts visible to the party (regardless
// of status), so we filter client-side for that exact tag.

const { DEVNET } = require('./devnet')

/** Splice DAML variant tag for a `TransferInstruction` that is still
 *  awaiting the receiver's acceptance. */
const TRANSFER_PENDING_RECEIVER_ACCEPTANCE = 'TransferPendingReceiverAcceptance'

/** Returns the registry URL the SDK should hit for CIP-0056 endpoints. */
function scanProxyRegistryUrl() {
  return new URL(`${DEVNET.validatorUrl}/v0/scan-proxy`)
}

/** Narrow the extended SDK to one with the `token` namespace attached. */
function getTokenTransfer(sdk) {
  if (!sdk.token?.transfer) {
    throw new Error(
      'SDK was built without the `token` extension — token.transfer namespace is missing. ' +
        'Use buildExtendedSdk() (with token config) for recipient-side operations.'
    )
  }
  return sdk.token.transfer
}

/**
 * Find pending `TransferInstruction` contracts where `receiver` is the
 * given party (i.e. incoming offers to the wallet).
 */
async function listPendingTransferInstructions(sdk, receiver) {
  const tokenTransfer = getTokenTransfer(sdk)
  const contracts = await tokenTransfer.pending(receiver)
  const out = []
  for (const c of contracts) {
    const view = c.interfaceViewValue
    if (!view?.transfer) continue
    if (view.transfer.receiver !== receiver) continue
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
    const instrumentId =
      instrumentIdObj?.id ??
      (typeof t.instrumentId === 'string' ? t.instrumentId : '') ??
      ''

    const memo = view.meta?.values?.memo

    out.push({
      contractId: c.contractId,
      sender: t.sender ?? '',
      receiver: t.receiver ?? receiver,
      amount: amountStr,
      instrumentId,
      executeBefore: t.executeBefore ?? '',
      ...(memo ? { memo } : {})
    })
  }
  console.log('[accept] found', out.length, 'pending transfers for', receiver)
  return out
}

/**
 * Build the `TransferInstruction_Accept` ExerciseCommand and its
 * disclosed contracts.
 */
async function buildAcceptCommand(sdk, opts) {
  const tokenTransfer = getTokenTransfer(sdk)
  const [wrapped, disclosed] = await tokenTransfer.accept({
    transferInstructionCid: opts.contractId,
    registryUrl: scanProxyRegistryUrl()
  })
  console.log('[accept] accept command built', {
    contractId: opts.contractId,
    disclosedCount: Array.isArray(disclosed) ? disclosed.length : 0
  })
  return [wrapped, disclosed]
}

/**
 * Build the `TransferInstruction_Reject` ExerciseCommand and its
 * disclosed contracts.
 */
async function buildRejectCommand(sdk, opts) {
  const tokenTransfer = getTokenTransfer(sdk)
  const [wrapped, disclosed] = await tokenTransfer.reject({
    transferInstructionCid: opts.contractId,
    registryUrl: scanProxyRegistryUrl()
  })
  console.log('[accept] reject command built', {
    contractId: opts.contractId,
    disclosedCount: Array.isArray(disclosed) ? disclosed.length : 0
  })
  return [wrapped, disclosed]
}

module.exports = {
  listPendingTransferInstructions,
  buildAcceptCommand,
  buildRejectCommand,
  TRANSFER_PENDING_RECEIVER_ACCEPTANCE
}
