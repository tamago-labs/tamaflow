// Employee roster helpers — type/status/frequency labels and options.
// Mirrors the old version's lib/employees.ts.

import type { EmployeeType, PayFrequency, EmployeeStatus } from '../ai/types'

export interface EmployeeTypeOption {
  value: EmployeeType
  label: string
  desc: string
}

export const EMPLOYEE_TYPES: ReadonlyArray<EmployeeTypeOption> = [
  { value: 'employee', label: 'Employee', desc: 'On payroll, salaried or hourly' },
  { value: 'contractor', label: 'Contractor', desc: 'Engagement-based, deliverables or invoice' },
  { value: 'other', label: 'Other', desc: 'Custom arrangement' }
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

export function employeeTypeLabel(value: EmployeeType): string {
  return EMPLOYEE_TYPES.find((t) => t.value === value)?.label ?? value
}

export function payFrequencyLabel(value: PayFrequency): string {
  return PAY_FREQUENCIES.find((f) => f.value === value)?.label ?? value
}

export function employeeStatusLabel(value: EmployeeStatus): string {
  return EMPLOYEE_STATUSES.find((s) => s.value === value)?.label ?? value
}

export function employeeStatusBadge(value: EmployeeStatus): string {
  return (
    EMPLOYEE_STATUSES.find((s) => s.value === value)?.badge ??
    'bg-brand-light text-brand-muted border-brand-border'
  )
}

export function frequencyRequiresHourly(value: PayFrequency): boolean {
  return value === 'hourly'
}
