// Build the `AmuletRules_DevNet_Tap` ExerciseCommand + disclosed
// contracts directly, bypassing the Wallet SDK's high-level
// `sdk.amulet.tap()`.
//
// Why bypass: the SDK's `amulet.tap()` calls into the CIP-0056
// token-metadata-v1 registry (`GET /registry/metadata/v1/instruments`,
// `…/info`, `POST /registry/transfer-instruction/v1/transfer-factory`)
// to look up the Amulet's admin party + fetch a transfer-factory
// choice context. FiveNorth's hosted DevNet validator does not expose
// those endpoints (it serves a CIP-0056-incomplete Splice build), so
// the high-level path 404s with:
//   "The requested resource could not be found:
//    http://.../api/validator/registry/metadata/v1/instruments"
//
// On FiveNorth, `AmuletRules` is a singleton owned by the DSO party
// (visible in the AmuletRules payload's `dso` field), and the only
// inputs to the `AmuletRules_DevNet_Tap` exercise are the
// `AmuletRules` and the active `OpenMiningRound` contract — both
// served by the scan-proxy endpoints under
// `${validatorUrl}/v0/scan-proxy/...`, which DO work. We fetch those
// two contracts and construct the ExerciseCommand ourselves.
//
// Returns the same `[WrappedCommand, DisclosedContract[]]` tuple
// shape that `sdk.amulet.tap()` would have, so the downstream
// `sdk.ledger.prepare({ partyId, commands, disclosedContracts })` in
// wallet.js is unchanged.

const { DEVNET, DEFAULT_AMULET_AMOUNT } = require('./devnet')

/** Minimal contract shape returned by the Splice scan-proxy. */
function toDisclosed(c) {
  return {
    templateId: c.template_id,
    contractId: c.contract_id,
    createdEventBlob: c.created_event_blob,
    ...(c.domain_id ? { synchronizerId: c.domain_id } : {})
  }
}

/** Returns the round whose `[opensAt, targetClosesAt)` window
 *  contains `now`. */
function pickActiveRound(rounds, now) {
  const eligible = rounds.filter((round) => {
    const openMs = round.payload?.opensAt
      ? Date.parse(round.payload.opensAt)
      : NaN
    const closeMs = round.payload?.targetClosesAt
      ? Date.parse(round.payload.targetClosesAt)
      : NaN
    return (
      Number.isFinite(openMs) &&
      Number.isFinite(closeMs) &&
      openMs <= now &&
      now < closeMs
    )
  })
  // Most recently opened wins (matches the SDK's `pickActive` behaviour).
  eligible.sort(
    (a, b) =>
      Date.parse(a.payload.opensAt) - Date.parse(b.payload.opensAt)
  )
  return eligible.at(-1) ?? null
}

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

/**
 * Build the tap command and its disclosed contracts.
 *
 * @param token Bearer JWT from the OAuth token endpoint.
 * @param receiver Party ID of the wallet to fund.
 * @param amount Canton Coin amount as a decimal string (e.g. "1000.0000000000").
 */
async function buildTapCommand(token, receiver, amount = DEFAULT_AMULET_AMOUNT) {
  // 1. Fetch AmuletRules (DSO singleton).
  const amuletRulesResp = await fetchScanProxy(token, '/v0/scan-proxy/amulet-rules')
  const amuletRules = amuletRulesResp.amulet_rules.contract

  // 2. Fetch OpenMiningRounds and pick the active one.
  const roundsResp = await fetchScanProxy(
    token,
    '/v0/scan-proxy/open-and-issuing-mining-rounds'
  )
  const rounds = roundsResp.open_mining_rounds.map((r) => r.contract)
  const activeRound = pickActiveRound(rounds, Date.now())
  if (!activeRound) {
    throw new Error('No active OpenMiningRound at the current moment.')
  }

  console.log('[tap] resolved AmuletRules + active OpenMiningRound', {
    amuletRulesId: amuletRules.contract_id,
    openRound: activeRound.contract_id
  })

  // 3. Build the ExerciseCommand.
  const tapCmd = {
    ExerciseCommand: {
      templateId: amuletRules.template_id,
      contractId: amuletRules.contract_id,
      choice: 'AmuletRules_DevNet_Tap',
      choiceArgument: {
        receiver,
        amount,
        openRound: activeRound.contract_id
      }
    }
  }

  // 4. Disclosed contracts: the two consumed by the choice. The Canton
  //    ledger API v2 expects camelCase fields, while scan-proxy returns
  //    snake_case — convert before handing off.
  return [tapCmd, [amuletRules, activeRound].map(toDisclosed)]
}

module.exports = { buildTapCommand }
