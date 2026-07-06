/**
 * Build the `AmuletRules_DevNet_Tap` ExerciseCommand and its disclosed
 * contracts directly, bypassing the Wallet SDK's high-level
 * `sdk.amulet.tap()`.
 *
 * Why bypass:
 *   The SDK's `amulet.tap()` calls into the CIP-0056 token-metadata-v1
 *   registry (`GET /registry/metadata/v1/instruments`, `…/info`, and
 *   `POST /registry/transfer-instruction/v1/transfer-factory`) to look
 *   up the Amulet's admin party and fetch a transfer-factory choice
 *   context. FiveNorth's hosted DevNet validator does not expose those
 *   endpoints (it serves a CIP-0056-incomplete Splice build), so the
 *   high-level path 404s with:
 *     "The requested resource could not be found:
 *      http://.../api/validator/registry/metadata/v1/instruments"
 *
 *   On FiveNorth, `AmuletRules` is a singleton owned by the DSO party
 *   (visible in the AmuletRules payload's `dso` field), and the only
 *   inputs to the `AmuletRules_DevNet_Tap` exercise are the
 *   `AmuletRules` and the active `OpenMiningRound` contract — both
 *   served by the scan-proxy endpoints under
 *   `${validatorUrl}/v0/scan-proxy/...`, which DO work. We fetch those
 *   two contracts and construct the ExerciseCommand ourselves.
 *
 * Returns the same `[WrappedCommand, DisclosedContract[]]` tuple shape
 * that `sdk.amulet.tap()` would have, so the downstream
 * `sdk.ledger.prepare({ partyId, commands, disclosedContracts })`
 * call in wallet.ts is unchanged.
 *
 * Ported from scripts/lib/tap.ts.
 */
import { DEVNET, DEFAULT_AMULET_AMOUNT } from './devnet.js'

/** Minimal contract shape returned by the Splice scan-proxy. */
type ScanProxyContract = {
  template_id: string
  contract_id: string
  payload: Record<string, unknown>
  created_event_blob: string
  created_at?: string
  domain_id?: string
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

/** Convert a scan-proxy contract (snake_case) to a ledger-API DisclosedContract (camelCase). */
function toDisclosed(c: ScanProxyContract): DisclosedContract {
  return {
    templateId: c.template_id,
    contractId: c.contract_id,
    createdEventBlob: c.created_event_blob,
    ...(c.domain_id ? { synchronizerId: c.domain_id } : {}),
  }
}

/** Returns the round whose `[opensAt, targetClosesAt)` window contains `now`. */
function pickActiveRound(
  rounds: ScanProxyContract[],
  now: number,
): ScanProxyContract | null {
  const eligible = rounds.filter((round) => {
    const payload = round.payload as {
      opensAt?: string
      targetClosesAt?: string
    }
    const openMs = payload.opensAt ? Date.parse(payload.opensAt) : NaN
    const closeMs = payload.targetClosesAt
      ? Date.parse(payload.targetClosesAt)
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
      Date.parse((a.payload as { opensAt: string }).opensAt) -
      Date.parse((b.payload as { opensAt: string }).opensAt),
  )
  return eligible.at(-1) ?? null
}

async function fetchScanProxy<T>(
  token: string,
  path: string,
): Promise<T> {
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

/**
 * Build the tap command and its disclosed contracts.
 *
 * @param token Bearer JWT from the OAuth token endpoint.
 * @param receiver Party ID of the wallet to fund.
 * @param amount Canton Coin amount as a decimal string (e.g. "1000.0000000000").
 */
export async function buildTapCommand(
  token: string,
  receiver: string,
  amount: string = DEFAULT_AMULET_AMOUNT,
): Promise<[ExerciseCommand, DisclosedContract[]]> {
  // 1. Fetch AmuletRules (DSO singleton).
  const amuletRulesResp = await fetchScanProxy<{
    amulet_rules: { contract: ScanProxyContract }
  }>(token, '/v0/scan-proxy/amulet-rules')
  const amuletRules = amuletRulesResp.amulet_rules.contract

  // 2. Fetch OpenMiningRounds and pick the active one.
  const roundsResp = await fetchScanProxy<{
    open_mining_rounds: Array<{ contract: ScanProxyContract }>
  }>(token, '/v0/scan-proxy/open-and-issuing-mining-rounds')
  const rounds = roundsResp.open_mining_rounds.map((r) => r.contract)
  const activeRound = pickActiveRound(rounds, Date.now())
  if (!activeRound) {
    throw new Error('No active OpenMiningRound at the current moment.')
  }

  console.log('[tap] resolved AmuletRules + active OpenMiningRound', {
    amuletRulesId: amuletRules.contract_id,
    openRound: activeRound.contract_id,
  })

  // 3. Build the ExerciseCommand.
  const tapCmd: ExerciseCommand = {
    ExerciseCommand: {
      templateId: amuletRules.template_id,
      contractId: amuletRules.contract_id,
      choice: 'AmuletRules_DevNet_Tap',
      choiceArgument: {
        receiver,
        amount,
        openRound: activeRound.contract_id,
      },
    },
  }

  // 4. Disclosed contracts: the two consumed by the choice. The Canton
  //    ledger API v2 expects camelCase fields, while scan-proxy returns
  //    snake_case — convert before handing off.
  return [tapCmd, [amuletRules, activeRound].map(toDisclosed)]
}
