// Enumerate one FlowOutcome per Payee card on the canvas. The renderer
// calls this for the pre-submit preview modal; the main process worker
// will call the same function in Phase 4 when settling the batch.
//
// Connection rules (declarative, single source of truth in flowCards.ts):
//
//   source  → payee
//   payee   → transfer
//   transfer (terminal)
//
// One outcome per Payee. The Payee inherits rules from the Transfer
// card it's connected to (1:1 — a Payee can only have one Transfer
// input in MVP since the connection rules are strict). The Transfer
// card is a shared "rules provider" — multiple Payees can connect to
// the same Transfer to apply identical rules.
//
// Phase 3 — read-only enumeration + per-outcome math. Phase 4 will
// persist each outcome to disk and walk it through the worker.

import type {
  CanvasCard,
  CompanyProfile,
  Connection,
  Employee,
  EmployeeTransferFields,
  ContractorTransferFields,
  FlowOutcome,
  FlowOutcomeStatus,
} from '../preload/index.d'
import { computeOutcome, type ComputeInput, type PayCurrency } from './computeOutcome'

/** Inputs to the enumeration — the canvas content + the people to pay
 *  + the company profile (for inside-jurisdiction payCurrency). */
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
    return { error: 'payCurrency not set and no company profile to inherit from' }
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
  if (employee.payCurrency) return employee.payCurrency
  // Inside-jurisdiction employees inherit from the company profile.
  if (employee.employmentLocation === 'inside_jurisdiction') return null
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

// ─── Transfer card → typed field shape ────────────────────────────

/** The renderer stores transfer field envelopes loosely on the wire
 *  (`Record<string, unknown>`) for forward-compat. Re-narrow them to
 *  the typed shapes here so computeOutcome sees a clean input. */
function readTransferFields(
  card: CanvasCard,
): { variant: 'contractor'; fields: ContractorTransferFields } | { variant: 'employee'; fields: EmployeeTransferFields } | null {
  if (card.category !== 'transfer') return null
  if (card.transferVariant === 'contractor') {
    return {
      variant: 'contractor',
      fields: {
        variant: 'contractor',
        fxRate: (card.contractorTransferFields?.fxRate as string) || undefined,
      },
    }
  }
  if (card.transferVariant === 'employee') {
    return {
      variant: 'employee',
      fields: {
        variant: 'employee',
        withholdingRate:
          ((card.employeeTransferFields?.withholdingRate as string) ?? '') || '0',
        socialSecurityRate:
          ((card.employeeTransferFields?.socialSecurityRate as string) ?? '') || undefined,
        fxRate: (card.employeeTransferFields?.fxRate as string) || undefined,
      },
    }
  }
  return null
}

// ─── Enumeration ──────────────────────────────────────────────────

/**
 * Walk the canvas and produce one FlowOutcome per Payee card.
 *
 * Pure function — no I/O, no time, no randomness. Safe to call from
 * both the renderer (preview) and main (worker, Phase 4).
 *
 * Returns both the outcomes and a list of warnings — Payee cards that
 * couldn't be turned into outcomes (missing employee, no transfer
 * connection, missing payCurrency, etc.) are surfaced here so the
 * UI can show the user exactly which row needs attention.
 */
export function enumerateOutcomes(input: EnumerateInput): EnumerationResult {
  const { flowId, cards, connections, employees } = input

  const payees = cards.filter((c) => c.category === 'payee')
  const transfersById = new Map(
    cards.filter((c) => c.category === 'transfer').map((c) => [c.placementId, c]),
  )

  // Index connections by `from` so we can look up "what's downstream
  // of this Payee" in O(1) instead of scanning all connections per row.
  const outgoing = new Map<string, string[]>()
  for (const conn of connections) {
    const arr = outgoing.get(conn.from) ?? []
    arr.push(conn.to)
    outgoing.set(conn.from, arr)
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

    // Find the downstream Transfer card (Payee's only outgoing edge in MVP).
    const downstreamIds = outgoing.get(payee.placementId) ?? []
    if (downstreamIds.length === 0) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: Payee card has no connected Transfer — choose a Contractor or Employee Transfer.`,
      })
      continue
    }
    const transferCard = transfersById.get(downstreamIds[0])
    if (!transferCard) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: connected Transfer card not found on canvas.`,
      })
      continue
    }
    const transfer = readTransferFields(transferCard)
    if (!transfer) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: Transfer card is missing its variant — re-add it from the palette.`,
      })
      continue
    }

    const gross = resolveGrossPay(employee)
    if ('error' in gross) {
      warnings.push({
        payeePlacementId: payee.placementId,
        message: `${employee.displayName}: ${gross.error}`,
      })
      continue
    }

    const computeInput: ComputeInput = {
      transferVariant: transfer.variant,
      grossPay: gross.value,
      payCurrency: gross.payCurrency,
      jurisdiction: employee.employmentLocation,
      fxRate:
        transfer.variant === 'contractor'
          ? transfer.fields.fxRate
          : transfer.fields.fxRate,
      withholdingRate:
        transfer.variant === 'employee' ? transfer.fields.withholdingRate : undefined,
      socialSecurityRate:
        transfer.variant === 'employee' ? transfer.fields.socialSecurityRate : undefined,
      contractorFields: transfer.variant === 'contractor' ? transfer.fields : undefined,
      employeeFields: transfer.variant === 'employee' ? transfer.fields : undefined,
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

    // Narrow the transfer field shape so the conditional spread
    // below can read `withholdingRate` / `socialSecurityRate` safely.
    const employeeFields =
      transfer.variant === 'employee' ? transfer.fields : null

    const outcome: FlowOutcome = {
      id: freshOutcomeId(),
      flowId,
      employeeId,
      payeePlacementId: payee.placementId,
      transferPlacementId: transferCard.placementId,
      transferVariant: transfer.variant,
      status: 'pending' satisfies FlowOutcomeStatus,
      grossPay: computed.grossPay,
      payCurrency: computed.payCurrency,
      jurisdiction: employee.employmentLocation,
      amountCC: computed.amountCC,
      recipientPartyId: employee.cantonPartyId ?? '',
      ...(computed.withholdingAmount !== undefined && {
        withholdingAmount: computed.withholdingAmount,
      }),
      ...(computed.withholdingAmount !== undefined &&
        employeeFields !== null && {
          withholdingRate: employeeFields.withholdingRate,
        }),
      ...(computed.socialSecurityAmount !== undefined && {
        socialSecurityAmount: computed.socialSecurityAmount,
      }),
      ...(computed.socialSecurityAmount !== undefined &&
        employeeFields !== null &&
        employeeFields.socialSecurityRate !== undefined && {
          socialSecurityRate: employeeFields.socialSecurityRate,
        }),
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
