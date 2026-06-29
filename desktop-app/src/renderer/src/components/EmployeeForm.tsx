import { useState, useEffect } from 'react'
import { Loader2, HelpCircle } from 'lucide-react'
import type {
  Employee,
  EmployeeType,
  EmployeeStatus,
  PayFrequency,
  CurrencyCode
} from '../../../preload/index.d'
import { CURRENCIES } from '../lib/countries'
import { WORLD_COUNTRIES, worldCountryLabel } from '../lib/worldCountries'
import {
  EMPLOYEE_TYPES,
  PAY_FREQUENCIES,
  EMPLOYEE_STATUSES,
  frequencyRequiresHourly
} from '../lib/employees'

/**
 * Shared employee form.
 *
 * Used by `<EmployeeFormDrawer>` (right-side slide-in). Mirrors
 * `CompanyForm.tsx` for label/input/button classes.
 *
 * Country + compensation currency are both always required on every
 * employee row — there is no inside/outside-jurisdiction inheritance
 * from the company profile. The user always picks a country (from the
 * full ISO 3166-1 list) and a compensation currency manually; both
 * are stored on the row.
 *
 * Frequency-conditional: `hourly` swaps salary → hourlyRate as the
 * required amount field. `one-off` accepts either, but typically
 * just `salaryAmount` for a project fee.
 *
 * `endDate` becomes required when `status === 'terminated'`.
 *
 * Validation runs on-blur via the `touched` map AND at submit time.
 */
interface EmployeeFormProps {
  /** Existing employee to pre-fill (edit mode). Omit for first-run create. */
  initial?: Employee
  /** Label for the primary submit button. */
  submitLabel: string
  /** Called with a complete `Employee` on submit. */
  onSubmit: (employee: Employee) => Promise<void> | void
  /** Optional cancel button (typically wired to close the drawer). */
  onCancel?: () => void
  /** Disable inputs while parent is saving. */
  submitting?: boolean
  /** When true, the form lives inside the drawer footer; renders
   *  actions on the right. Default false (caller renders own footer). */
  compactActions?: boolean
}

export default function EmployeeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  submitting,
  compactActions = false
}: EmployeeFormProps) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [type, setType] = useState<EmployeeType>(initial?.type ?? 'employee')
  const [role, setRole] = useState(initial?.role ?? '')
  const [country, setCountry] = useState<string>(initial?.country ?? 'JP')
  const [payCurrency, setPayCurrency] = useState<CurrencyCode>(
    initial?.payCurrency ?? 'JPY'
  )
  const [payFrequency, setPayFrequency] = useState<PayFrequency>(
    initial?.payFrequency ?? 'monthly'
  )
  const [salaryAmount, setSalaryAmount] = useState(initial?.salaryAmount ?? '')
  const [hourlyRate, setHourlyRate] = useState(initial?.hourlyRate ?? '')
  const [cantonPartyId, setCantonPartyId] = useState(initial?.cantonPartyId ?? '')
  const [status, setStatus] = useState<EmployeeStatus>(initial?.status ?? 'active')
  const [startDate, setStartDate] = useState(initial?.startDate ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [partyIdHelpOpen, setPartyIdHelpOpen] = useState(false)

  // Re-sync on `initial` change (parent swapped in a different employee).
  useEffect(() => {
    if (!initial) return
    setDisplayName(initial.displayName)
    setEmail(initial.email ?? '')
    setType(initial.type)
    setRole(initial.role ?? '')
    setCountry(initial.country ?? 'JP')
    setPayCurrency(initial.payCurrency ?? 'JPY')
    setPayFrequency(initial.payFrequency)
    setSalaryAmount(initial.salaryAmount ?? '')
    setHourlyRate(initial.hourlyRate ?? '')
    setCantonPartyId(initial.cantonPartyId ?? '')
    setStatus(initial.status)
    setStartDate(initial.startDate ?? '')
    setEndDate(initial.endDate ?? '')
    setNote(initial.note ?? '')
    setTouched({})
    setSubmitError(null)
  }, [initial?.id])

  const handleFrequencyChange = (next: PayFrequency) => {
    setPayFrequency(next)
    // Switching into hourly: clear stale salary (validation runs on submit).
    if (next === 'hourly' && salaryAmount) {
      setSalaryAmount('')
    }
    if (next !== 'hourly' && hourlyRate) {
      setHourlyRate('')
    }
  }

  const handleStatusChange = (next: EmployeeStatus) => {
    setStatus(next)
    // Status moved AWAY from terminated → no longer need endDate.
    // (We don't auto-clear; if the user set a date they probably want it.)
  }

  // ── Validation ──────────────────────────────────────────────────────
  const trimmedName = displayName.trim()
  const nameValid = trimmedName.length >= 1 && trimmedName.length <= 200
  const emailValid =
    email.trim().length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const isHourly = frequencyRequiresHourly(payFrequency)
  const isOneOff = payFrequency === 'one-off'
  const amountValid = isHourly
    ? /^\d+(\.\d{1,2})?$/.test(hourlyRate.trim()) && parseFloat(hourlyRate) > 0
    : isOneOff
      ? true // one-off accepts missing amount; row can be informational
      : /^\d+(\.\d{1,2})?$/.test(salaryAmount.trim()) && parseFloat(salaryAmount) > 0
  // Country and currency are both required on every employee row —
  // no inside/outside inheritance from the company profile.
  const countryValid = country.trim().length > 0 && country.trim().length <= 64
  const currencyValid = (CURRENCIES as ReadonlyArray<string>).includes(payCurrency)
  const partyIdValid =
    cantonPartyId.trim().length === 0 ||
    (cantonPartyId.trim().length >= 10 &&
      !/\s/.test(cantonPartyId) &&
      !/[\x00-\x1f]/.test(cantonPartyId))
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const startDateValid = startDate.trim().length === 0 || dateRegex.test(startDate.trim())
  const endDateRequired = status === 'terminated'
  const endDateValid =
    (!endDateRequired && endDate.trim().length === 0) ||
    (endDateRequired && dateRegex.test(endDate.trim())) ||
    (!endDateRequired && dateRegex.test(endDate.trim()))
  const endDateAfterStart =
    endDate.trim().length === 0 ||
    startDate.trim().length === 0 ||
    Date.parse(endDate) > Date.parse(startDate)
  const noteValid = note.trim().length <= 500
  const roleValid = role.trim().length <= 100

  const allValid =
    nameValid &&
    emailValid &&
    amountValid &&
    countryValid &&
    currencyValid &&
    partyIdValid &&
    startDateValid &&
    endDateValid &&
    endDateAfterStart &&
    noteValid &&
    roleValid

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    // Force all fields touched so the user sees every error.
    setTouched({
      displayName: true,
      email: true,
      salaryAmount: true,
      hourlyRate: true,
      cantonPartyId: true,
      startDate: true,
      endDate: true,
      note: true,
      role: true,
      country: true,
      payCurrency: true
    })
    if (!allValid) return

    try {
      await onSubmit({
        id: initial?.id ?? '',
        displayName: trimmedName,
        email: email.trim() || undefined,
        type,
        role: role.trim() || undefined,
        country: country.trim(),
        payCurrency,
        salaryAmount: !isHourly && salaryAmount.trim() ? salaryAmount.trim() : undefined,
        payFrequency,
        hourlyRate: isHourly && hourlyRate.trim() ? hourlyRate.trim() : undefined,
        cantonPartyId: cantonPartyId.trim() || undefined,
        status,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
        note: note.trim() || undefined,
        createdAt: initial?.createdAt ?? '',
        updatedAt: initial?.updatedAt ?? ''
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    }
  }

  const disabled = !!submitting
  const show = (field: string) => !!touched[field]

  return (
    <form
      onSubmit={handleSubmit}
      className={compactActions ? '' : 'space-y-5'}
      noValidate
    >
      <fieldset className="space-y-4 m-0 p-0 border-0">
        {/* Display name */}
        <div>
          <label
            htmlFor="emp-name"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Display name
          </label>
          <input
            id="emp-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, displayName: true }))}
            placeholder="Taro Yamada"
            disabled={disabled}
            maxLength={200}
            autoFocus
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
          />
          {show('displayName') && !nameValid && (
            <p className="font-sans text-xs text-brand-err mt-1 m-0">
              {trimmedName.length === 0 ? 'Display name is required.' : 'Must be 200 characters or fewer.'}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="emp-email"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Email <span className="text-brand-muted/60 normal-case font-normal">(optional)</span>
          </label>
          <input
            id="emp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder="taro@example.com"
            disabled={disabled}
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
          />
          {show('email') && !emailValid && (
            <p className="font-sans text-xs text-brand-err mt-1 m-0">Enter a valid email address.</p>
          )}
        </div>

        {/* Type */}
        <div>
          <label
            htmlFor="emp-type"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Type
          </label>
          <select
            id="emp-type"
            value={type}
            onChange={(e) => setType(e.target.value as EmployeeType)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
          >
            {EMPLOYEE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.desc}
              </option>
            ))}
          </select>
        </div>

        {/* Role */}
        <div>
          <label
            htmlFor="emp-role"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Role <span className="text-brand-muted/60 normal-case font-normal">(optional)</span>
          </label>
          <input
            id="emp-role"
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, role: true }))}
            placeholder="Senior Engineer"
            disabled={disabled}
            maxLength={100}
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
          />
          {show('role') && !roleValid && (
            <p className="font-sans text-xs text-brand-err mt-1 m-0">Must be 100 characters or fewer.</p>
          )}
        </div>

        {/* Country + Compensation currency — 2-col, always required */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="emp-country"
              className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
            >
              Country
            </label>
            <select
              id="emp-country"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value)
                setTouched((t) => ({ ...t, country: true }))
              }}
              onBlur={() => setTouched((t) => ({ ...t, country: true }))}
              disabled={disabled}
              className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
            >
              {WORLD_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.label}
                </option>
              ))}
            </select>
            {show('country') && !countryValid && (
              <p className="font-sans text-xs text-brand-err mt-1 m-0">Country is required.</p>
            )}
          </div>

          <div>
            <label
              htmlFor="emp-currency"
              className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
            >
              Compensation currency
            </label>
            <select
              id="emp-currency"
              value={payCurrency}
              onChange={(e) => {
                setPayCurrency(e.target.value as CurrencyCode)
                setTouched((t) => ({ ...t, payCurrency: true }))
              }}
              onBlur={() => setTouched((t) => ({ ...t, payCurrency: true }))}
              disabled={disabled}
              className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mt-1.5 m-0">
              What the employment contract specifies. Payroll is paid in CC and
              converted at payment time.
            </p>
            {show('payCurrency') && !currencyValid && (
              <p className="font-sans text-xs text-brand-err mt-1 m-0">
                Compensation currency is required.
              </p>
            )}
          </div>
        </div>

        {/* Pay frequency — full width */}
        <div>
          <label
            htmlFor="emp-frequency"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Pay frequency
          </label>
          <select
            id="emp-frequency"
            value={payFrequency}
            onChange={(e) => handleFrequencyChange(e.target.value as PayFrequency)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
          >
            {PAY_FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Salary / Hourly rate — 2-col, frequency-conditional */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="emp-salary"
              className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
            >
              {isHourly ? 'Salary (n/a)' : isOneOff ? 'Fee (optional)' : 'Salary / period'}
            </label>
            <input
              id="emp-salary"
              type="text"
              inputMode="decimal"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, salaryAmount: true }))}
              placeholder={isHourly ? '—' : '5000.00'}
              disabled={disabled || isHourly}
              className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
            />
            {show('salaryAmount') && !isHourly && !amountValid && (
              <p className="font-sans text-xs text-brand-err mt-1 m-0">
                {isOneOff
                  ? 'If set, must be a positive number with up to 2 decimals.'
                  : 'Salary is required and must be a positive number.'}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="emp-hourly"
              className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
            >
              Hourly rate {!isHourly && <span className="text-brand-muted/60 normal-case font-normal">(n/a)</span>}
            </label>
            <input
              id="emp-hourly"
              type="text"
              inputMode="decimal"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, hourlyRate: true }))}
              placeholder={isHourly ? '50.00' : '—'}
              disabled={disabled || !isHourly}
              className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
            />
            {show('hourlyRate') && isHourly && !amountValid && (
              <p className="font-sans text-xs text-brand-err mt-1 m-0">
                Hourly rate is required and must be a positive number.
              </p>
            )}
          </div>
        </div>

        {/* Canton partyId */}
        <div>
          <label
            htmlFor="emp-partyid"
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Canton partyId
            <span className="text-brand-muted/60 normal-case font-normal">(optional)</span>
            <button
              type="button"
              onClick={() => setPartyIdHelpOpen((v) => !v)}
              aria-label="What is a Canton partyId?"
              className="bg-transparent border-0 p-0 ml-0.5 cursor-pointer text-brand-muted hover:text-brand-blue inline-flex items-center"
            >
              <HelpCircle size={11} />
            </button>
          </label>
          <input
            id="emp-partyid"
            type="text"
            value={cantonPartyId}
            onChange={(e) => setCantonPartyId(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, cantonPartyId: true }))}
            placeholder="party::1220abcdef…"
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-mono text-xs text-brand-navy placeholder:text-brand-muted focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
          />
          {partyIdHelpOpen && (
            <p className="font-sans text-xs text-brand-muted mt-1.5 m-0 leading-relaxed">
              A Canton partyId identifies the recipient's on-ledger wallet. Employees get
              one when they install Canton Wallet and create their own party. You'll add
              it here once they've shared it with you. Leave blank if they don't have
              one yet — they can't receive payroll without it.
            </p>
          )}
          {!partyIdHelpOpen && (
            <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mt-1.5 m-0">
              Used for payroll transfers. Leave blank if the employee doesn't have a Canton wallet yet.
            </p>
          )}
          {show('cantonPartyId') && !partyIdValid && (
            <p className="font-sans text-xs text-brand-err mt-1 m-0">
              Looks invalid — Canton partyIds are long strings like <code className="font-mono text-[11px]">party::1220abcd…</code>
            </p>
          )}
        </div>

        {/* Status + Start date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="emp-status"
              className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
            >
              Status
            </label>
            <select
              id="emp-status"
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as EmployeeStatus)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
            >
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="emp-start"
              className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
            >
              Start date <span className="text-brand-muted/60 normal-case font-normal">(optional)</span>
            </label>
            <input
              id="emp-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, startDate: true }))}
              disabled={disabled}
              className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
            />
            {show('startDate') && !startDateValid && (
              <p className="font-sans text-xs text-brand-err mt-1 m-0">Enter a valid date.</p>
            )}
          </div>
        </div>

        {/* End date — only required when status === terminated */}
        <div>
          <label
            htmlFor="emp-end"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            End date{' '}
            {endDateRequired ? (
              <span className="text-brand-err normal-case font-normal">(required)</span>
            ) : (
              <span className="text-brand-muted/60 normal-case font-normal">(optional)</span>
            )}
          </label>
          <input
            id="emp-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, endDate: true }))}
            disabled={disabled}
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
          />
          {show('endDate') && endDateRequired && endDate.trim().length === 0 && (
            <p className="font-sans text-xs text-brand-err mt-1 m-0">
              End date is required when status is "terminated".
            </p>
          )}
          {show('endDate') && endDate.trim().length > 0 && !endDateValid && (
            <p className="font-sans text-xs text-brand-err mt-1 m-0">Enter a valid date.</p>
          )}
          {show('endDate') && endDate.trim().length > 0 && endDateValid && !endDateAfterStart && (
            <p className="font-sans text-xs text-brand-err mt-1 m-0">End date must be after start date.</p>
          )}
        </div>

        {/* Note */}
        <div>
          <label
            htmlFor="emp-note"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Note <span className="text-brand-muted/60 normal-case font-normal">(optional)</span>
          </label>
          <textarea
            id="emp-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, note: true }))}
            placeholder="Project code, invoice reference, anything to remember…"
            disabled={disabled}
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60 resize-y"
          />
          {show('note') && !noteValid && (
            <p className="font-sans text-xs text-brand-err mt-1 m-0">Must be 500 characters or fewer.</p>
          )}
        </div>
      </fieldset>

      {/* Inline submit error */}
      {submitError && (
        <div className="p-3 bg-brand-errBg border border-brand-errBorder rounded-md">
          <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-err m-0 mb-1">
            Error
          </p>
          <p className="font-sans text-xs text-brand-errDark m-0 whitespace-pre-wrap">
            {submitError}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || !allValid}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50"
        >
          {submitting && <Loader2 size={12} className="animate-spin" />}
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

/* Re-export world country lookup so the Employees page can use it */
export { worldCountryLabel }