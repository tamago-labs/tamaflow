import type {
  EmployeeType,
  PayFrequency,
  EmployeeStatus
} from '../../../preload/index.d'

/**
 * Closed-allowlist tables for the employee roster (renderer side).
 *
 * Mirrors the source-of-truth shape used in `lib/countries.ts`. The main
 * process hard-codes the same allowlists in `employeeStore.ts` for
 * defence-in-depth validation on imports.
 *
 * Type / frequency / status each render as a labelled `<select>` option
 * with a short description where useful.
 */

export interface EmployeeTypeOption {
  value: EmployeeType
  label: string
  /** One-line description rendered below the option (and on tooltips). */
  desc: string
}

export const EMPLOYEE_TYPES: ReadonlyArray<EmployeeTypeOption> = [
  {
    value: 'employee',
    label: 'Employee',
    desc: 'On payroll, salaried or hourly'
  },
  {
    value: 'contractor',
    label: 'Contractor',
    desc: 'Engagement-based, deliverables or invoice'
  },
  {
    value: 'other',
    label: 'Other',
    desc: 'Custom arrangement'
  }
]

export interface PayFrequencyOption {
  value: PayFrequency
  label: string
}

export const PAY_FREQUENCIES: ReadonlyArray<PayFrequencyOption> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'one-off', label: 'One-off / Project' }
]

export interface EmployeeStatusOption {
  value: EmployeeStatus
  label: string
  /** Tailwind classes for the list-row badge. */
  badge: string
}

export const EMPLOYEE_STATUSES: ReadonlyArray<EmployeeStatusOption> = [
  {
    value: 'active',
    label: 'Active',
    badge: 'bg-brand-teal/15 text-brand-navy border-brand-teal/30'
  },
  {
    value: 'paused',
    label: 'Paused',
    badge: 'bg-amber-100 text-amber-900 border-amber-200'
  },
  {
    value: 'terminated',
    label: 'Terminated',
    badge: 'bg-brand-light text-brand-muted border-brand-border'
  }
]

/** Lookup helper for displaying the employee-type label. */
export function employeeTypeLabel(value: EmployeeType): string {
  return EMPLOYEE_TYPES.find((t) => t.value === value)?.label ?? value
}

/** Lookup helper for displaying the pay-frequency label. */
export function payFrequencyLabel(value: PayFrequency): string {
  return PAY_FREQUENCIES.find((f) => f.value === value)?.label ?? value
}

/** Lookup helper for displaying the status label. */
export function employeeStatusLabel(value: EmployeeStatus): string {
  return EMPLOYEE_STATUSES.find((s) => s.value === value)?.label ?? value
}

/** Lookup helper for displaying the status badge classes. */
export function employeeStatusBadge(value: EmployeeStatus): string {
  return EMPLOYEE_STATUSES.find((s) => s.value === value)?.badge ?? 'bg-brand-light text-brand-muted border-brand-border'
}

/** True when the chosen frequency requires an hourly rate rather than a salary. */
export function frequencyRequiresHourly(value: PayFrequency): boolean {
  return value === 'hourly'
}