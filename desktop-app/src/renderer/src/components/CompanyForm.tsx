import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import type {
  CompanyProfile,
  CountryCode,
  CurrencyCode,
  LegalEntityType
} from '../../../preload/index.d'
import { COUNTRIES, CURRENCIES, LEGAL_ENTITY_TYPES } from '../lib/countries'

/**
 * Shared company profile form.
 *
 * Used at two surfaces:
 *   - CompanyGate (first-run wizard).
 *   - Company Profile page > Profile tab.
 *
 * Rendered as a single `<form>` — one unified section. Auto-fill logic:
 * when the user picks a Country, Base Currency is auto-populated from
 * `COUNTRIES[].defaultCurrency` — UNLESS the user has manually touched
 * the field, in which case the override is preserved across subsequent
 * country changes. The `touched` flag resets when `initial` changes
 * (i.e. when the parent swaps to a freshly imported profile).
 *
 * Settlement currency is NOT editable here — it's surfaced on the
 * Company Profile page's "On-ledger" tab instead, where it lives with
 * the other on-ledger settings. The form always submits `CC`.
 */

interface CompanyFormProps {
  /** Existing profile to pre-fill (edit mode). Omit for first-run create. */
  initial?: CompanyProfile
  /** Label for the primary submit button. */
  submitLabel: string
  /** Called with a complete `CompanyProfile` on submit. */
  onSubmit: (profile: CompanyProfile) => Promise<void> | void
  /** Optional cancel button (e.g. Settings edit mode). */
  onCancel?: () => void
  /** Disable inputs while parent is saving. */
  submitting?: boolean
}

/** Month names for the fiscal year picker. */
const MONTHS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
]

/**
 * Normalise a stored fiscal-year value into an MM month string.
 *
 * Accepts both the new shape (`"04"`) and the legacy `MM-DD` shape
 * (`"04-01"`) so profiles saved before the day picker was removed
 * still load. Returns `null` for anything else.
 */
function parseFiscalMonth(value: string | undefined): string | null {
  if (!value) return null
  // Legacy MM-DD → take the month half.
  if (/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    return value.split('-')[0]
  }
  // New MM shape.
  if (/^(0[1-9]|1[0-2])$/.test(value)) return value
  return null
}

export default function CompanyForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  submitting
}: CompanyFormProps) {
  const [companyName, setCompanyName] = useState(initial?.companyName ?? 'My Company')
  const [country, setCountry] = useState<CountryCode>(initial?.country ?? 'JP')
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(initial?.baseCurrency ?? 'JPY')
  const [legalEntityType, setLegalEntityType] = useState<LegalEntityType>(
    initial?.legalEntityType ?? 'corporation'
  )
  // Fiscal year start — month only (MM string). Defaults to January
  // (calendar year). Drives how payroll reports are grouped for tax.
  const [fiscalMonth, setFiscalMonth] = useState<string>(
    parseFiscalMonth(initial?.fiscalYearStart) ?? '01'
  )
  // Track manual edits so subsequent country changes don't clobber them.
  const [currencyTouched, setCurrencyTouched] = useState(
    initial ? initial.baseCurrency !== defaultCurrencyFor(initial.country) : false
  )
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  // When the parent swaps in a new `initial` (e.g. after an import),
  // reset the form to match and clear the touched flag — imports are
  // authoritative, so we re-derive "touched" from whether the imported
  // value matches the country's default.
  useEffect(() => {
    if (!initial) return
    setCompanyName(initial.companyName)
    setCountry(initial.country)
    setBaseCurrency(initial.baseCurrency)
    setLegalEntityType(initial.legalEntityType)
    setFiscalMonth(parseFiscalMonth(initial.fiscalYearStart) ?? '01')
    setCurrencyTouched(initial.baseCurrency !== defaultCurrencyFor(initial.country))
    setTouched({})
    setSubmitError(null)
    // We intentionally depend only on `initial.companyName` etc. so
    // identity-stable imports (e.g. after the same save) don't churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initial?.companyName,
    initial?.country,
    initial?.baseCurrency,
    initial?.legalEntityType,
    initial?.fiscalYearStart
  ])

  const handleCountryChange = (next: CountryCode) => {
    const preset = COUNTRIES.find((c) => c.code === next)
    if (!preset) return
    setCountry(next)
    if (!currencyTouched) setBaseCurrency(preset.defaultCurrency)
  }

  const handleCurrencyChange = (v: CurrencyCode) => {
    setBaseCurrency(v)
    setCurrencyTouched(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (!companyName.trim()) {
      setTouched((t) => ({ ...t, companyName: true }))
      return
    }
    try {
      await onSubmit({
        companyName: companyName.trim(),
        country,
        baseCurrency,
        legalEntityType,
        // Settlement currency is fixed at CC for the MVP. It lives on
        // the Company Profile page's "On-ledger" tab, not here.
        settlementCurrency: 'CC',
        fiscalYearStart: fiscalMonth,
        createdAt: initial?.createdAt ?? '',
        updatedAt: initial?.updatedAt ?? ''
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    }
  }

  const showCompanyNameError = touched.companyName && !companyName.trim()
  const disabled = !!submitting

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <fieldset className="space-y-4">
        {/* Jurisdiction comes FIRST — it's the parent anchor for the
            company base currency (auto-fill) and for any "inside
            jurisdiction" employees on the roster. Picking a jurisdiction
            here cascades into the rest of the form. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="company-country"
              className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
            >
              Jurisdiction
            </label>
            <select
              id="company-country"
              value={country}
              onChange={(e) => handleCountryChange(e.target.value as CountryCode)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="company-currency"
              className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
            >
              Base currency
            </label>
            <select
              id="company-currency"
              value={baseCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="company-name"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Company name
          </label>
          <input
            id="company-name"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, companyName: true }))}
            placeholder="Acme Corp"
            disabled={disabled}
            maxLength={200}
            autoFocus
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
          />
          {showCompanyNameError && (
            <p className="font-sans text-xs text-brand-err mt-1 m-0">Company name is required.</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="company-legal"
              className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
            >
              Legal entity type
            </label>
            <select
              id="company-legal"
              value={legalEntityType}
              onChange={(e) => setLegalEntityType(e.target.value as LegalEntityType)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
            >
              {LEGAL_ENTITY_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Fiscal year start — month-only pick. Drives how payroll
              reports are grouped for tax / accounting. Defaults to
              calendar year (January). */}
          <div>
            <label
              htmlFor="company-fiscal-month"
              className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
            >
              Fiscal year start
            </label>
            <select
              id="company-fiscal-month"
              value={fiscalMonth}
              onChange={(e) => setFiscalMonth(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
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
          disabled={disabled || !companyName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50"
        >
          {submitting && <Loader2 size={12} className="animate-spin" />}
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

// ─── helpers (kept local; trivial enough not to live in lib/) ─────────

function defaultCurrencyFor(code: CountryCode): CurrencyCode {
  return COUNTRIES.find((c) => c.code === code)?.defaultCurrency ?? 'USD'
}