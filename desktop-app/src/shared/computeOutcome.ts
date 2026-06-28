// Pure math for converting a Payee's gross pay into the on-ledger
// amount (in CC). Imported by both the renderer (pre-submit preview)
// and the main process worker (Phase 4 — when actually settling
// the transfer).
//
// Branching rules (matches the plan):
//
//   contractor variant  →  convert → send
//                          (no withhold, no SS, any jurisdiction)
//
//   employee variant    →  inside_jurisdiction:
//                          withhold → social_security → convert → send
//                        → outside_jurisdiction:
//                          convert → send
//                          (withhold + SS skipped — payee is cross-border)
//
// All amounts are kept as decimal strings to avoid float drift; the
// arithmetic is done via BigInt on the integer minor units. We pad to
// 10 decimal places at the boundary because CC has 10dp.
//
// The convention: a "rate" is a decimal string like "0.22" meaning
// 22%. The "amount" is a decimal string in the same units as the
// pay currency (e.g. "100.00" USD) until we get to `amountCC` which
// is always in CC (10dp).

import type {
  ContractorTransferFields,
  EmployeeTransferFields,
  TransferVariant,
} from '../preload/index.d'

/**
 * Where the employee sits relative to the company's home jurisdiction.
 * Derived at runtime from `employee.country === company.country` (see
 * `shared/flowPaths.ts`) — not stored on the employee. The two values
 * map directly to the cross-border rule branch:
 *   - inside → Employee Transfer applies withhold + SS
 *   - outside → Employee Transfer skips withhold + SS
 */
type JurisdictionContext = 'inside_jurisdiction' | 'outside_jurisdiction'

/** CC has 10 decimal places — keep this in sync with the worker. */
export const CC_DECIMALS = 10

/** Common pay currencies — closed allowlist in MVP. */
export type PayCurrency = 'JPY' | 'THB' | 'USD' | 'EUR'

/**
 * Inputs to the compute step. The caller (`enumerateOutcomes`) is
 * responsible for resolving the employee + payee + transfer card
 * together — this module just does the arithmetic.
 */
export interface ComputeInput {
  transferVariant: TransferVariant
  /** Decimal string in pay currency (e.g. "5000.00"). */
  grossPay: string
  payCurrency: PayCurrency
  jurisdiction: JurisdictionContext
  /** Required when payCurrency !== 'CC'. CC per 1 unit of payCurrency. */
  fxRate?: string
  /** Employee variant only — e.g. "0.22" for 22%. */
  withholdingRate?: string
  /** Employee variant only — e.g. "0.05" for 5%. Defaults to 0. */
  socialSecurityRate?: string
  /** Required when transferVariant === 'contractor'. */
  contractorFields?: ContractorTransferFields
  /** Required when transferVariant === 'employee'. */
  employeeFields?: EmployeeTransferFields
}

export interface ComputeResult {
  /** Decimal string in pay currency (echoed for the table). */
  grossPay: string
  payCurrency: PayCurrency
  /** Decimal string in pay currency. Set only for inside-jurisdiction employee variant. */
  withholdingAmount?: string
  /** Decimal string in pay currency. Set only for inside-jurisdiction employee variant. */
  socialSecurityAmount?: string
  /** CC per 1 unit of payCurrency. Set only when FX conversion was applied. */
  fxRateApplied?: string
  /**
   * Final on-ledger amount in CC, 10dp decimal string. Always set —
   * the worker signs and sends this exact value.
   */
  amountCC: string
  /**
   * Human-readable description of which branch ran. Surfaced in the
   * preview modal so the user can sanity-check the rule application.
   */
  ruleApplied:
    | 'contractor-convert-send'
    | 'employee-inside-withhold-ss-convert-send'
    | 'employee-outside-convert-send'
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
 * string. Rounds HALF_UP at the target precision. Used for both the
 * rate application (gross × withholdingRate) and FX (gross × fxRate).
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
  const {
    transferVariant,
    grossPay,
    payCurrency,
    jurisdiction,
    fxRate,
    withholdingRate,
    socialSecurityRate,
  } = input

  // ─── Step 1: compute withholding + SS (employee + inside only) ──
  let amountAfterTaxes = grossPay
  let withholdingAmount: string | undefined
  let socialSecurityAmount: string | undefined

  if (
    transferVariant === 'employee' &&
    jurisdiction === 'inside_jurisdiction'
  ) {
    const wRate = withholdingRate ?? input.employeeFields?.withholdingRate
    const ssRate =
      socialSecurityRate ??
      input.employeeFields?.socialSecurityRate ??
      '0'

    if (!wRate || wRate === '') {
      throw new Error('Employee transfer (inside jurisdiction) requires withholdingRate')
    }
    if (!isFiniteRate(wRate)) {
      throw new Error(`Invalid withholdingRate: ${wRate}`)
    }
    if (!isFiniteRate(ssRate)) {
      throw new Error(`Invalid socialSecurityRate: ${ssRate}`)
    }

    // Withholding is computed on the gross, then subtracted.
    withholdingAmount = decimalMul(grossPay, wRate, 2)
    const afterWithholding = decimalSub(grossPay, withholdingAmount, 2)
    // SS is computed on the gross too (matches reference payroll conventions),
    // also subtracted.
    socialSecurityAmount =
      ssRate === '0' || ssRate === '' ? '0' : decimalMul(grossPay, ssRate, 2)
    amountAfterTaxes =
      ssRate === '0' || ssRate === ''
        ? afterWithholding
        : decimalSub(afterWithholding, socialSecurityAmount, 2)
  }

  // ─── Step 2: FX conversion to CC ────────────────────────────────
  // CC is always the settlement currency. The employee's `payCurrency`
  // is fiat (JPY / THB / USD / EUR) so an FX rate is required when
  // the employee is paid in non-CC currency. The `payCurrency === 'CC'`
  // escape hatch is kept for future "paid in CC" cases (e.g. an
  // employee whose salary is denominated in CC) — for now it's a
  // no-op pass-through.
  let amountCC: string
  let fxRateApplied: string | undefined

  if ((payCurrency as string) === 'CC') {
    amountCC = padCC(amountAfterTaxes)
    fxRateApplied = undefined
  } else {
    const rate = fxRate ?? inputFxRate(transferVariant, input)
    if (!rate || rate === '') {
      throw new Error(
        `FX rate required for payCurrency=${payCurrency} but not provided`,
      )
    }
    if (!isFiniteRate(rate)) {
      throw new Error(`Invalid fxRate: ${rate}`)
    }
    fxRateApplied = rate
    amountCC = padCC(decimalMul(amountAfterTaxes, rate, CC_DECIMALS))
  }

  // ─── Step 3: rule label for the UI ──────────────────────────────
  const ruleApplied: ComputeResult['ruleApplied'] =
    transferVariant === 'contractor'
      ? 'contractor-convert-send'
      : jurisdiction === 'inside_jurisdiction'
        ? 'employee-inside-withhold-ss-convert-send'
        : 'employee-outside-convert-send'

  const result: ComputeResult = {
    grossPay,
    payCurrency,
    amountCC,
    ruleApplied,
  }
  if (withholdingAmount !== undefined) result.withholdingAmount = withholdingAmount
  if (socialSecurityAmount !== undefined) result.socialSecurityAmount = socialSecurityAmount
  if (fxRateApplied !== undefined) result.fxRateApplied = fxRateApplied
  return result
}

/**
 * Subtract two decimal strings at the given precision. Negative
 * results are clamped to "0" — payroll should never net to a debit.
 */
function decimalSub(a: string, b: string, precision: number): string {
  const aMinor = decimalToMinor(a, precision)
  const bMinor = decimalToMinor(b, precision)
  const diff = aMinor - bMinor
  return minorToDecimal(diff < 0n ? 0n : diff, precision)
}

/** Pad a decimal value to exactly 10dp for CC. Truncates trailing
 *  zeros beyond 10dp (defensive — input should already be at most
 *  10dp). */
function padCC(value: string): string {
  const minor = decimalToMinor(value, CC_DECIMALS)
  return minorToDecimal(minor, CC_DECIMALS)
}

/** Read fxRate out of either the typed field shape or the raw transfer
 *  fields envelope (since the renderer stores them loosely). */
function inputFxRate(
  variant: TransferVariant,
  input: ComputeInput,
): string | undefined {
  if (variant === 'contractor') {
    return (
      input.fxRate ??
      input.contractorFields?.fxRate ??
      (input.contractorFields as unknown as { fxRate?: string } | undefined)?.fxRate
    )
  }
  return (
    input.fxRate ??
    input.employeeFields?.fxRate ??
    (input.employeeFields as unknown as { fxRate?: string } | undefined)?.fxRate
  )
}

/** Lightweight rate validation: matches /^\d+(\.\d+)?$/ and is in [0, 1]. */
function isFiniteRate(rate: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(rate)) return false
  const minor = decimalToMinor(rate, 18)
  // rate ≤ 1.0 means minor ≤ 10^18
  return minor <= BigInt(10) ** BigInt(18)
}

/**
 * Human-readable label for the applied rule. Surfaced in the
 * OutcomesPreviewModal so the user can see why each row looks the way
 * it does.
 */
export function describeRule(
  rule: ComputeResult['ruleApplied'],
): string {
  switch (rule) {
    case 'contractor-convert-send':
      return 'Contractor · convert + send (no withhold, no SS)'
    case 'employee-inside-withhold-ss-convert-send':
      return 'Employee · withhold + SS + convert + send'
    case 'employee-outside-convert-send':
      return 'Employee · convert + send (withhold + SS skipped — cross-border)'
  }
}
