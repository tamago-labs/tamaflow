// Enumerate one Route per Payee card on the canvas. The renderer
// calls this for the pre-submit preview modal; the main process worker
// calls the same function when settling the batch — guarantees the
// preview matches the eventual on-ledger amounts byte-for-byte.
//
// Connection rules (declarative, single source of truth in flowCards.ts):
//
//   source  → payee  → payment
//   payment (terminal — funds move here)
//
// One route per Payee. The Payment card contributes only its memo
// (per-card override, falling back to the template's default, then to
// the company default); the upstream Source card contributes its wallet
// party id (snapshotted into `sourceFields.partyId` at creation time —
// used by the worker to fund the transfer). The gross amount comes from
// the employee's roster record (salary / hourly rate × pay frequency);
// the FX rate is auto-fetched from the shared priceProvider (USD-
// relative table with two-step via USD bridge). Deductions (withholding
// + social security) come from the PaymentTemplate the user wired to
// this Payment card — the card composition is authoritative.

import type {
  CanvasCard,
  CompanyProfile,
  Connection,
  Employee,
  PaymentTemplate,
  RouteSummary,
} from '../preload/index.d'
import {
  computeOutcome,
  type ComputeInput,
  type PayCurrency,
} from './computeOutcome'
import { convert, type PricedCurrency } from './priceProvider'
import { DIRECT_PAYMENT_TEMPLATE_ID } from './paymentTemplate'
import type { PayeeFields, PaymentFields } from '../renderer/src/flow/types'

/** Inputs to the enumeration — the canvas content + the people to pay
 *  + the company profile (jurisdiction + custom payment templates). */
export interface EnumerateInput {
  flowId: string
  cards: CanvasCard[]
  connections: Connection[]
  employees: Employee[]
  companyProfile: CompanyProfile | null
}

export interface EnumerationWarning {
  /** placementId of the Payee card that produced the warning. */
  payeePlacementId: string
  /** Human-readable reason the Payee was skipped (or partially filled). */
  message: string
}

export interface EnumerationResult {
  routes: RouteSummary[]
  warnings: EnumerationWarning[]
}

// ─── PayFrequency → gross pay resolution ───────────────────────────

/**
 * Compute the gross pay for a single Payee from their Employee record.
 *
 * MVP assumptions (documented for the user when they review the
 * preview modal):
 *   • monthly   → salaryAmount as-is
 *   • one-off   → salaryAmount as-is
 *   • biweekly  → salaryAmount / 2     (assumes monthly salary)
 *   • weekly    → salaryAmount / 4.33  (assumes monthly salary, 52/12)
 *   • hourly    → hourlyRate × 160     (40h/week × 4 weeks)
 *
 * The preview modal surfaces the resolved value so the user can
 * sanity-check before submitting.
 */
function resolveGrossPay(
  employee: Employee,
): { value: string; payCurrency: PayCurrency } | { error: string } {
  const payCurrency = resolvePayCurrency(employee)
  if (!payCurrency) {
    return { error: 'payCurrency not set' }
  }

  switch (employee.payFrequency) {
    case 'monthly':
    case 'one-off': {
      if (!employee.salaryAmount) {
        return { error: 'salaryAmount required for monthly/one-off' }
      }
      return { value: employee.salaryAmount, payCurrency }
    }
    case 'biweekly': {
      if (!employee.salaryAmount) {
        return { error: 'salaryAmount required for biweekly' }
      }
      // salaryAmount is monthly → divide by 2.
      const monthly = parseDecimal(employee.salaryAmount)
      if (monthly === null) return { error: `Invalid salaryAmount: ${employee.salaryAmount}` }
      return { value: (monthly / 2).toFixed(2), payCurrency }
    }
    case 'weekly': {
      if (!employee.salaryAmount) {
        return { error: 'salaryAmount required for weekly' }
      }
      // salaryAmount is monthly → divide by 52/12 ≈ 4.333.
      const monthly = parseDecimal(employee.salaryAmount)
      if (monthly === null) return { error: `Invalid salaryAmount: ${employee.salaryAmount}` }
      return { value: (monthly / (52 / 12)).toFixed(2), payCurrency }
    }
    case 'hourly': {
      if (!employee.hourlyRate) {
        return { error: 'hourlyRate required for hourly' }
      }
      const rate = parseDecimal(employee.hourlyRate)
      if (rate === null) return { error: `Invalid hourlyRate: ${employee.hourlyRate}` }
      // 40h/week × 4 weeks/month = 160h/month.
      return { value: (rate * 160).toFixed(2), payCurrency }
    }
    default: {
      // Exhaustiveness — TS narrows `payFrequency` to `never` here.
      const _exhaustive: never = employee.payFrequency
      return { error: `Unsupported payFrequency: ${String(_exhaustive)}` }
    }
  }
}

function resolvePayCurrency(employee: Employee): PayCurrency | null {
  // `payCurrency` is required on every employee — guaranteed non-null
  // once the row is validated by `main/employeeStore.ts`. The legacy
  // null-guard here is kept as a defensive fallback.
  if (employee.payCurrency) return employee.payCurrency
  return null
}

/** Tolerant decimal parser used only for the gross-pay resolution
 *  above (where we're not touching ledger values). Returns null on
 *  parse failure — ledger-grade math is handled by computeOutcome. */
function parseDecimal(s: string): number | null {
  const trimmed = s.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  return Number(trimmed)
}

// ─── Card field readers ────────────────────────────────────────────

/**
 * Read the Payee field shape off a CanvasCard. Returns `null` when the
 * card is not a Payee or carries no fields.
 */
function readPayeeFields(card: CanvasCard): PayeeFields | null {
  if (card.category !== 'payee') return null
  if (!card.payeeFields) return null
  return card.payeeFields as unknown as PayeeFields
}

/**
 * Read the Payment field shape off a CanvasCard. Returns `null` when
 * the card is not a Payment or carries no fields.
 */
function readPaymentFields(card: CanvasCard): PaymentFields | null {
  if (card.category !== 'payment') return null
  if (!card.paymentFields) return null
  return card.paymentFields as unknown as PaymentFields
}

// ─── Deductions ────────────────────────────────────────────────────

/**
 * Apply withholding + social security to a gross pay when applicable.
 *
 * The deduction rules live on the linked `PaymentTemplate` (NOT on a
 * company-wide rule — company-wide rules were removed in favour of
 * user-defined templates that become palette tiles). A `null` template
 * = the built-in Direct Payment card = no deductions applied.
 *
 * Both deductions are computed as a percentage of the ORIGINAL gross
 * (not sequential). The `withholdingAmount` + `socialSecurityAmount`
 * surfaces are returned in `payCurrency` (2dp) so the preview modal can
 * render a per-row breakdown.
 *
 * Note: there is NO country-based skip rule here. The flow's card
 * composition is authoritative — if the user wires a template with
 * non-zero rates to a Payee card, those rates are applied. Cross-border
 * deductions (employee.country ≠ company.country) are the user's
 * intent, not something we silently override.
 *
 * Returns the adjusted gross (still in `payCurrency`) for downstream
 * FX conversion in `computeOutcome`.
 */
function applyDeductions(
  grossPay: string,
  template: PaymentTemplate | null,
): {
  adjustedGross: string
  withholdingAmount?: string
  socialSecurityAmount?: string
} {
  // Direct Payment (no template) → no deductions ever.
  if (!template) {
    return { adjustedGross: grossPay }
  }
  let withholdingAmount: string | undefined
  let socialSecurityAmount: string | undefined
  let net = grossPay
  if (template.withholdingRate && template.withholdingRate.trim() !== '') {
    withholdingAmount = mulDecimal(grossPay, template.withholdingRate, 2)
    net = subDecimal(net, withholdingAmount, 2)
  }
  if (template.socialSecurityRate && template.socialSecurityRate.trim() !== '') {
    socialSecurityAmount = mulDecimal(grossPay, template.socialSecurityRate, 2)
    net = subDecimal(net, socialSecurityAmount, 2)
  }
  return {
    adjustedGross: net,
    ...(withholdingAmount && { withholdingAmount }),
    ...(socialSecurityAmount && { socialSecurityAmount }),
  }
}

/** Multiply two decimal strings with HALF_UP rounding at `precision`
 *  decimal places. The rate is treated as having at most 18dp of
 *  precision (matches computeOutcome's rate assumption). */
function mulDecimal(value: string, rate: string, precision: number): string {
  const trimValue = value.trim()
  const trimRate = rate.trim()
  if (!/^\d+(\.\d+)?$/.test(trimValue)) {
    throw new Error(`Invalid value: ${value}`)
  }
  if (!/^\d+(\.\d+)?$/.test(trimRate)) {
    throw new Error(`Invalid rate: ${rate}`)
  }
  const RATE_PRECISION = 18
  const toMinor = (s: string, d: number): bigint => {
    const [whole, frac = ''] = s.split('.')
    const padded = (frac + '0'.repeat(d)).slice(0, d)
    return BigInt(whole) * BigInt(10) ** BigInt(d) + BigInt(padded || '0')
  }
  const valueMinor = toMinor(trimValue, precision)
  const rateMinor = toMinor(trimRate, RATE_PRECISION)
  const product = valueMinor * rateMinor
  const divisor = BigInt(10) ** BigInt(RATE_PRECISION)
  const quotient = product / divisor
  const remainder = product % divisor
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient
  const factor = BigInt(10) ** BigInt(precision)
  const whole = rounded / factor
  const frac = rounded % factor
  const fracStr = frac.toString().padStart(precision, '0')
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed === '' ? whole.toString() : `${whole.toString()}.${trimmed}`
}

/** Subtract `b` from `a` with `precision` decimal places. */
function subDecimal(a: string, b: string, precision: number): string {
  const trimA = a.trim()
  const trimB = b.trim()
  if (!/^\d+(\.\d+)?$/.test(trimA)) throw new Error(`Invalid value: ${a}`)
  if (!/^\d+(\.\d+)?$/.test(trimB)) throw new Error(`Invalid value: ${b}`)
  const toMinor = (s: string, d: number): bigint => {
    const [whole, frac = ''] = s.split('.')
    const padded = (frac + '0'.repeat(d)).slice(0, d)
    return BigInt(whole) * BigInt(10) ** BigInt(d) + BigInt(padded || '0')
  }
  const aMinor = toMinor(trimA, precision)
  const bMinor = toMinor(trimB, precision)
  const diff = aMinor - bMinor
  const factor = BigInt(10) ** BigInt(precision)
  const whole = diff / factor
  const frac = diff % factor
  // `diff` may go negative (shouldn't for our use case — both values
  // are non-negative and we subtract a value computed from a smaller
  // or equal gross — but we handle it defensively so the UI never
  // shows "-0.00").
  if (diff < 0n) return '0'
  const fracStr = frac.toString().padStart(precision, '0')
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed === '' ? whole.toString() : `${whole.toString()}.${trimmed}`
}

// ─── Enumeration ──────────────────────────────────────────────────

/**
 * Walk the canvas and produce one Route per Payee card.
 *
 * Pure function — no I/O, no time, no randomness. Safe to call from
 * both the renderer (preview) and main (worker) for byte-identical
 * results.
 *
 * Returns both the routes and a list of warnings — Payee cards that
 * couldn't be turned into routes (missing employee, no source
 * connection, no payment connection, missing FX rate, etc.) are
 * surfaced here so the UI can show the user exactly which row needs
 * attention.
 */
export function enumerateRoutes(input: EnumerateInput): EnumerationResult {
  const { flowId, cards, connections, employees, companyProfile } = input

  const payees = cards.filter((c) => c.category === 'payee')
  const sourcesById = new Map(
    cards.filter((c) => c.category === 'source').map((c) => [c.placementId, c]),
  )
  const paymentsById = new Map(
    cards.filter((c) => c.category === 'payment').map((c) => [c.placementId, c]),
  )

  // Index incoming connections by `to` so we can look up "what's upstream
  // of this Payee" in O(1) instead of scanning all connections per row.
  const incoming = new Map<string, string[]>()
  for (const conn of connections) {
    const arr = incoming.get(conn.to) ?? []
    arr.push(conn.from)
    incoming.set(conn.to, arr)
  }

  const employeeById = new Map(employees.map((e) => [e.id, e]))

  const routes: RouteSummary[] = []
  const warnings: EnumerationWarning[] = []

  for (const payee of payees) {
    const employeeId = (payee.payeeFields?.employeeId as string) || ''
    if (!employeeId) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: 'Payee card has no employee selected.',
      })
      continue
    }
    const employee = employeeById.get(employeeId)
    if (!employee) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `Employee ${employeeId} not found (it may have been deleted).`,
      })
      continue
    }
    if (employee.status !== 'active') {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `Employee ${employee.displayName} is ${employee.status} — skipped.`,
      })
      continue
    }

    // Find the upstream Source card (Payee's only incoming edge in MVP).
    const upstreamIds = incoming.get(payee.placementId) ?? []
    if (upstreamIds.length === 0) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: Payee card has no connected Source — pick one from the palette.`,
      })
      continue
    }
    const sourceCard = sourcesById.get(upstreamIds[0])
    if (!sourceCard) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: connected Source card not found on canvas.`,
      })
      continue
    }

    // Find the downstream Payment card (Payee's outgoing edge).
    // The MVP allows exactly one Payment downstream of a Payee.
    const outgoingIds = connections
      .filter((c) => c.from === payee.placementId)
      .map((c) => c.to)
    if (outgoingIds.length === 0) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: Payee has no connected Payment — drop a Direct Payment tile and connect it.`,
      })
      continue
    }
    const paymentCard = paymentsById.get(outgoingIds[0])
    if (!paymentCard) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: connected Payment card not found on canvas.`,
      })
      continue
    }

    const payeeFields = readPayeeFields(payee)
    const paymentFields = readPaymentFields(paymentCard)

    // Resolve the linked payment template for this Payment card. A
    // `undefined` or `'direct'` templateId = built-in Direct Payment
    // (no deductions, memo-only). If the card references a custom
    // template that no longer exists in the profile, fall back to
    // Direct Payment AND warn so the user sees the staleness in the
    // preview modal.
    const templateId = paymentFields?.templateId
    let template: PaymentTemplate | null = null
    if (templateId && templateId !== DIRECT_PAYMENT_TEMPLATE_ID) {
      template =
        companyProfile?.paymentTemplates.find((t) => t.id === templateId) ?? null
      if (template === null) {
        warnings.push({
          payeePlacementId: payee.placementId,
          message: `${employee.displayName}: payment template was deleted — falling back to Direct Payment (no deductions).`,
        })
      }
    }

    // Resolve the gross pay from the employee's roster record. The
    // Payment card no longer carries an `amountOverride` — one-off
    // amounts require editing the employee salary directly (and that
    // change persists in the roster).
    const gross = resolveGrossPay(employee)
    if ('error' in gross) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: ${gross.error}`,
      })
      continue
    }

    // Apply withholding + social security from the linked template.
    // Direct Payment (template === null) skips deductions; a custom
    // template applies whatever rates the user configured, regardless
    // of the employee's country.
    let adjustedGross: string
    let withholdingAmount: string | undefined
    let socialSecurityAmount: string | undefined
    try {
      const result = applyDeductions(gross.value, template)
      adjustedGross = result.adjustedGross
      withholdingAmount = result.withholdingAmount
      socialSecurityAmount = result.socialSecurityAmount
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: deduction error — ${msg}`,
      })
      continue
    }

    // FX rate is auto-fetched from the price provider (USD-relative,
    // 2-step via USD bridge). convert(1, payCurrency, 'CC') gives "CC
    // per 1 unit of payCurrency" which matches computeOutcome's
    // expected `fxRate` shape (CC per 1 unit of payCurrency).
    let fxRate: string | undefined
    if (gross.payCurrency !== 'CC') {
      const ccPerUnit = convert(
        1,
        gross.payCurrency as PricedCurrency,
        'CC',
      )
      if (ccPerUnit === null) {
        warnings.push({
          payeePlacementId: payee.placementId,
          message: `${employee.displayName}: no FX rate for ${gross.payCurrency} — update the price provider.`,
        })
        continue
      }
      // Render at 18dp — matches the table's precision assumption and
      // is enough headroom for the rate to drift without re-rounding
      // the same way on re-run. Trailing zeros stripped for readability.
      fxRate = ccPerUnit.toFixed(18).replace(/0+$/, '').replace(/\.$/, '')
    }

    const computeInput: ComputeInput = {
      grossPay: adjustedGross,
      payCurrency: gross.payCurrency,
      fxRate,
    }

    let computed
    try {
      computed = computeOutcome(computeInput)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: ${msg}`,
      })
      continue
    }

    // Memo fallback chain:
    //   1. per-card memo (Payment.memo)
    //   2. linked template's defaultMemo (when a custom template is used)
    //   3. company profile's directPaymentDefaultMemo (when Direct Payment is used)
    //   4. empty string — preview surfaces this as a "blank memo" warning
    //      because Canton transfers go on-ledger verbatim.
    const memo =
      paymentFields?.memo?.trim() ||
      template?.defaultMemo?.trim() ||
      companyProfile?.directPaymentDefaultMemo?.trim() ||
      ''

    // Direct Payment + blank memo is the worst-case fallthrough: no
    // template default AND no company default AND no per-card memo.
    // Surface as a non-blocking warning so the user can fix it before
    // settling — Canton sends the memo on-ledger verbatim and an empty
    // memo is rarely what you want.
    if (memo === '' && template === null) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: Direct Payment has no memo set — type one on the card, or set a company default in Settings.`,
      })
    }

    const route: RouteSummary = {
      id: freshRouteId(),
      flowId,
      status: 'pending',
      employeeId,
      payeePlacementId: payee.placementId,
      sourcePlacementId: sourceCard.placementId,
      paymentPlacementId: paymentCard.placementId,
      amountCC: computed.amountCC,
      payCurrency: computed.payCurrency,
      grossPay: gross.value,
      recipientPartyId: employee.cantonPartyId ?? '',
      memo,
      createdAt: new Date().toISOString(),
    }
    if (computed.fxRateApplied !== undefined) {
      route.fxRate = computed.fxRateApplied
    }
    if (withholdingAmount) route.withholdingAmount = withholdingAmount
    if (socialSecurityAmount) route.socialSecurityAmount = socialSecurityAmount
    // payeeFields is read above only to silence the linter when nothing
    // else needs it — kept as a placeholder so future per-Payee card
    // fields (e.g. a per-card memo override) have an obvious hook here.
    void payeeFields
    routes.push(route)
  }

  return { routes, warnings }
}

/**
 * Backwards-compatible alias for the previous name. New callers should
 * use `enumerateRoutes` directly. Kept so any leftover import sites
 * (and tests written against the old name) keep compiling until the
 * rename fully lands.
 *
 * @deprecated Use `enumerateRoutes` instead.
 */
export const enumerateOutcomes = enumerateRoutes

/** Stable route id — same format the worker uses for persisted records. */
function freshRouteId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return 'r_' + crypto.randomUUID().replace(/-/g, '')
  }
  return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}