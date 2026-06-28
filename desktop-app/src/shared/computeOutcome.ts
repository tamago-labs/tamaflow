// Pure math for converting a Payee's gross pay into the on-ledger
// amount (in CC). Imported by both the renderer (pre-submit preview)
// and the main process worker (Phase 4 — when actually settling
// the transfer).
//
// MVP computes:
//   gross → (optional FX) → CC
//
// All amounts are kept as decimal strings to avoid float drift; the
// arithmetic is done via BigInt on the integer minor units. We pad to
// 10 decimal places at the boundary because CC has 10dp.
//
// The convention: a "rate" is a decimal string like "0.087" meaning
// 0.087 CC per 1 unit of payCurrency. The "amount" is a decimal string
// in the same units as the pay currency (e.g. "100.00" USD) until we
// get to `amountCC` which is always in CC (10dp).

/** Common pay currencies — closed allowlist in MVP. */
export type PayCurrency = 'JPY' | 'THB' | 'USD' | 'EUR'

/**
 * Inputs to the compute step. The caller (`enumerateOutcomes`) is
 * responsible for resolving the employee + Payee card together — this
 * module just does the arithmetic.
 *
 * The gross pay passed in already accounts for any `amountOverride` on
 * the Payee card (the enumarator decides which value to use); compute
 * only handles the FX step.
 */
export interface ComputeInput {
  /** Decimal string in pay currency (e.g. "5000.00"). */
  grossPay: string
  payCurrency: PayCurrency
  /** Required when payCurrency !== 'CC'. CC per 1 unit of payCurrency. */
  fxRate?: string
}

export interface ComputeResult {
  /** Decimal string in pay currency (echoed for the table). */
  grossPay: string
  payCurrency: PayCurrency
  /** CC per 1 unit of payCurrency. Set only when FX conversion was applied. */
  fxRateApplied?: string
  /**
   * Final on-ledger amount in CC, 10dp decimal string. Always set —
   * the worker signs and sends this exact value.
   */
  amountCC: string
}

/**
 * Convert a decimal string (e.g. "100.0000000000") to a BigInt of the
 * integer minor units (e.g. 1000000000000n for "100.0000000000" with
 * 10dp). Throws if the string isn't a valid non-negative decimal.
 */
function decimalToMinor(value: string, decimals: number): bigint {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid decimal: ${value}`)
  }
  const [whole, frac = ''] = trimmed.split('.')
  const paddedFrac = (frac + '0'.repeat(decimals)).slice(0, decimals)
  // BigInt("") is 0n, so this is safe.
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(paddedFrac || '0')
}

/**
 * Convert integer minor units back to a fixed-point decimal string
 * with the given number of decimal places. No exponent notation, no
 * trailing zeros dropped beyond what the input warranted.
 */
function minorToDecimal(minor: bigint, decimals: number): string {
  const factor = BigInt(10) ** BigInt(decimals)
  const whole = minor / factor
  const frac = minor % factor
  // Pad the fractional part to `decimals` digits.
  const fracStr = frac.toString().padStart(decimals, '0')
  // Strip trailing zeros from the fractional part for readability —
  // ledger amounts round-trip identically when re-parsed.
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed === '' ? whole.toString() : `${whole.toString()}.${trimmed}`
}

/**
 * Multiply a decimal string by a decimal rate, returning a decimal
 * string. Rounds HALF_UP at the target precision. Used for the FX
 * conversion (gross × fxRate → CC amount).
 *
 * `value` and `rate` are both decimal strings; `precision` is the
 * number of decimal places in the result (NOT in CC — pass CC_DECIMALS
 * for the final ledger value).
 */
function decimalMul(value: string, rate: string, precision: number): string {
  // Convert both to integer minor units at a sufficient precision to
  // avoid losing the fractional part of `rate`. We use 18dp precision
  // (the rate itself) so a 10dp rate like "0.0000001234" still rounds
  // sensibly.
  const RATE_PRECISION = 18
  const valueMinor = decimalToMinor(value, precision)
  const rateMinor = decimalToMinor(rate, RATE_PRECISION)
  // result = value * rate, at `precision` decimal places.
  const product = valueMinor * rateMinor
  // product has `precision + RATE_PRECISION` decimal places; rescale
  // down by RATE_PRECISION with HALF_UP rounding.
  const divisor = BigInt(10) ** BigInt(RATE_PRECISION)
  const quotient = product / divisor
  const remainder = product % divisor
  // HALF_UP: if remainder * 2 >= divisor, round up.
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient
  return minorToDecimal(rounded, precision)
}

/**
 * Compute the final CC amount for a single outcome.
 *
 * Pure function — no I/O, no time, no randomness. Safe to call from
 * the renderer (preview modal) and the main worker (Phase 4) for
 * byte-identical results.
 */
export function computeOutcome(input: ComputeInput): ComputeResult {
  const { grossPay, payCurrency, fxRate } = input

  // CC has 10 decimal places — keep this in sync with the worker.
  const CC_DECIMALS = 10

  // ─── FX conversion to CC ────────────────────────────────────
  // CC is always the settlement currency. The employee's `payCurrency`
  // is fiat (JPY / THB / USD / EUR) so an FX rate is required when
  // the employee is paid in non-CC currency. The `payCurrency === 'CC'`
  // escape hatch is kept for future "paid in CC" cases (e.g. an
  // employee whose salary is denominated in CC) — for now it's a
  // no-op pass-through.
  let amountCC: string
  let fxRateApplied: string | undefined

  if ((payCurrency as string) === 'CC') {
    amountCC = padCC(grossPay, CC_DECIMALS)
    fxRateApplied = undefined
  } else {
    if (!fxRate || fxRate === '') {
      throw new Error(
        `FX rate required for payCurrency=${payCurrency} but not provided`,
      )
    }
    if (!isFiniteRate(fxRate)) {
      throw new Error(`Invalid fxRate: ${fxRate}`)
    }
    fxRateApplied = fxRate
    amountCC = padCC(decimalMul(grossPay, fxRate, CC_DECIMALS), CC_DECIMALS)
  }

  const result: ComputeResult = {
    grossPay,
    payCurrency,
    amountCC,
  }
  if (fxRateApplied !== undefined) result.fxRateApplied = fxRateApplied
  return result
}

/** Pad a decimal value to exactly 10dp for CC. Truncates trailing
 *  zeros beyond 10dp (defensive — input should already be at most
 *  10dp). */
function padCC(value: string, decimals: number): string {
  const minor = decimalToMinor(value, decimals)
  return minorToDecimal(minor, decimals)
}

/** Lightweight rate validation: matches /^\d+(\.\d+)?$/ and is in [0, 1]. */
function isFiniteRate(rate: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(rate)) return false
  const minor = decimalToMinor(rate, 18)
  // rate ≤ 1.0 means minor ≤ 10^18
  return minor <= BigInt(10) ** BigInt(18)
}