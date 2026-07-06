import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import type { CompanyProfile, CountryCode, CurrencyCode, LegalEntityType } from '../ai/types'
import { COUNTRIES, CURRENCIES, LEGAL_ENTITY_TYPES } from '../lib/countries'

interface CompanyFormProps {
  initial?: CompanyProfile
  submitLabel: string
  onSubmit: (profile: CompanyProfile) => Promise<void> | void
  onCancel?: () => void
  submitting?: boolean
}

const MONTHS = [
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

export default function CompanyForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  submitting
}: CompanyFormProps) {
  const [country, setCountry] = useState<CountryCode>(initial?.country ?? 'JP')
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(
    initial?.baseCurrency ?? 'JPY'
  )
  const [companyName, setCompanyName] = useState(initial?.companyName ?? '')
  const [legalEntityType, setLegalEntityType] = useState<LegalEntityType>(
    initial?.legalEntityType ?? 'corporation'
  )
  const [fiscalYearStart, setFiscalYearStart] = useState(
    initial?.fiscalYearStart ?? '01'
  )

  const [currencyTouched, setCurrencyTouched] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!initial) return
    setCountry(initial.country)
    setBaseCurrency(initial.baseCurrency)
    setCompanyName(initial.companyName)
    setLegalEntityType(initial.legalEntityType)
    setFiscalYearStart(initial.fiscalYearStart)
    setCurrencyTouched(false)
    setTouched({})
    setSubmitError(null)
  }, [initial?.updatedAt])

  useEffect(() => {
    if (currencyTouched) return
    const match = COUNTRIES.find((c) => c.code === country)
    if (match) setBaseCurrency(match.defaultCurrency)
  }, [country, currencyTouched])

  const trimmedName = companyName.trim()
  const nameValid = trimmedName.length >= 1 && trimmedName.length <= 200
  const allValid = nameValid

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setTouched({ companyName: true })
    if (!allValid) return

    try {
      await onSubmit({
        companyName: trimmedName,
        country,
        baseCurrency,
        legalEntityType,
        settlementCurrency: 'CC',
        fiscalYearStart,
        paymentTemplates: initial?.paymentTemplates ?? [],
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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <fieldset className="space-y-4 m-0 p-0 border-0">
        {/* Country (jurisdiction) */}
        <div>
          <label
            htmlFor="co-country"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Country (jurisdiction)
          </label>
          <select
            id="co-country"
            value={country}
            onChange={(e) => setCountry(e.target.value as CountryCode)}
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

        {/* Base currency */}
        <div>
          <label
            htmlFor="co-currency"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Base currency
          </label>
          <select
            id="co-currency"
            value={baseCurrency}
            onChange={(e) => {
              setBaseCurrency(e.target.value as CurrencyCode)
              setCurrencyTouched(true)
              setTouched((t) => ({ ...t, baseCurrency: true }))
            }}
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
            Auto-filled from jurisdiction. Change manually if needed.
          </p>
        </div>

        {/* Company name */}
        <div>
          <label
            htmlFor="co-name"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Company name
          </label>
          <input
            id="co-name"
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
          {show('companyName') && !nameValid && (
            <p className="font-sans text-xs text-brand-err mt-1 m-0">
              {trimmedName.length === 0 ? 'Company name is required.' : 'Must be 200 characters or fewer.'}
            </p>
          )}
        </div>

        {/* Legal entity type */}
        <div>
          <label
            htmlFor="co-entity"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Legal entity type
          </label>
          <select
            id="co-entity"
            value={legalEntityType}
            onChange={(e) => setLegalEntityType(e.target.value as LegalEntityType)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
          >
            {LEGAL_ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Fiscal year start */}
        <div>
          <label
            htmlFor="co-fiscal"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Fiscal year start
          </label>
          <select
            id="co-fiscal"
            value={fiscalYearStart}
            onChange={(e) => setFiscalYearStart(e.target.value)}
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
