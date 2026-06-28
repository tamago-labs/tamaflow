// Enumerate one FlowOutcome per Payee card on the canvas. The renderer
// calls this for the pre-submit preview modal; the main process worker
// will call the same function in Phase 4 when settling the batch.
//
// Connection rules (declarative, single source of truth in flowCards.ts):
//
//   source  → payee
//   payee   (terminal)
//
// One outcome per Payee. The Payee inherits its FX rate (and any
// amount override) from itself; the upstream Source card contributes
// only its wallet party id (snapshotted into `sourceFields.partyId`
// at creation time — used by the worker to fund the transfer).
//
// Phase 3 — read-only enumeration + per-outcome math. Phase 4 will
// persist each outcome to disk and walk it through the worker.

import type {
  CanvasCard,
  CompanyProfile,
  Connection,
  Employee,
  FlowOutcome,
  FlowOutcomeStatus,
} from '../preload/index.d'
import {
  computeOutcome,
  type ComputeInput,
  type PayCurrency,
} from './computeOutcome'
import type { PayeeFields } from '../renderer/src/flow/types'

/** Inputs to the enumeration — the canvas content + the people to pay
 *  + the company profile (kept for future inside-jurisdiction use). */
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
  outcomes: FlowOutcome[]
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
 * sanity-check before submitting. Phase 4+ can add per-Payee overrides
 * on the edit form if these defaults don't fit.
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

// ─── Payee card → typed field shape ────────────────────────────

/**
 * Read the Payee field shape off a CanvasCard. Returns `null` when the
 * card is not a Payee or carries no fields.
 */
function readPayeeFields(card: CanvasCard): PayeeFields | null {
  if (card.category !== 'payee') return null
  if (!card.payeeFields) return null
  return card.payeeFields as unknown as PayeeFields
}

// ─── Enumeration ──────────────────────────────────────────────────

/**
 * Walk the canvas and produce one FlowOutcome per Payee card.
 *
 * Pure function — no I/O, no time, no randomness. Safe to call from
 * both the renderer (preview) and main (worker, Phase 4).
 *
 * Returns both the outcomes and a list of warnings — Payee cards that
 * couldn't be turned into outcomes (missing employee, no source
 * connection, missing FX rate, etc.) are surfaced here so the UI can
 * show the user exactly which row needs attention.
 */
export function enumerateOutcomes(input: EnumerateInput): EnumerationResult {
  const { flowId, cards, connections, employees } = input

  const payees = cards.filter((c) => c.category === 'payee')
  const sourcesById = new Map(
    cards.filter((c) => c.category === 'source').map((c) => [c.placementId, c]),
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

  const outcomes: FlowOutcome[] = []
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

    const payeeFields = readPayeeFields(payee)
    const override =
      payeeFields?.amountOverride?.trim() ?? ''

    // Resolve the gross pay. A Payee card with an `amountOverride`
    // set bypasses the employee-derived value so the user can pay a
    // one-off without editing the employee record.
    let gross: { value: string; payCurrency: PayCurrency } | { error: string }
    if (override !== '') {
      const payCurrency = resolvePayCurrency(employee)
      if (!payCurrency) {
        gross = { error: 'payCurrency not set on employee' }
      } else {
        gross = { value: override, payCurrency }
      }
    } else {
      gross = resolveGrossPay(employee)
    }
    if ('error' in gross) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: ${gross.error}`,
      })
      continue
    }

    const fxRate = payeeFields?.fxRate?.trim() ?? ''

    const computeInput: ComputeInput = {
      grossPay: gross.value,
      payCurrency: gross.payCurrency,
      fxRate: fxRate !== '' ? fxRate : undefined,
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

    const outcome: FlowOutcome = {
      id: freshOutcomeId(),
      flowId,
      employeeId,
      payeePlacementId: payee.placementId,
      sourcePlacementId: sourceCard.placementId,
      status: 'pending' satisfies FlowOutcomeStatus,
      grossPay: computed.grossPay,
      // Echo the override (if any) so the preview modal can show
      // "override $1000" distinctly from the employee's regular salary.
      ...(override !== '' && { effectiveGrossPay: override }),
      payCurrency: computed.payCurrency,
      amountCC: computed.amountCC,
      recipientPartyId: employee.cantonPartyId ?? '',
      ...(computed.fxRateApplied !== undefined && {
        fxRate: computed.fxRateApplied,
      }),
    }
    outcomes.push(outcome)
  }

  return { outcomes, warnings }
}

/** Stable outcome id — same format the worker will use (Phase 4). */
function freshOutcomeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return 'fo_' + crypto.randomUUID().replace(/-/g, '')
  }
  return 'fo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}