import { useState, useEffect, useRef } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import type { CompanyProfile, CountryCode, CurrencyCode, LegalEntityType } from '../ai/types'
import { COUNTRIES, CURRENCIES, LEGAL_ENTITY_TYPES } from '../lib/countries'
import { getFlagUrl } from '../lib/flags'

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
        <div className="relative">
          <label
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Country (jurisdiction)
          </label>
          <CountryDropdown
            value={country}
            onChange={setCountry}
            disabled={disabled}
          />
        </div>

        {/* Base currency */}
        <div className="relative">
          <label
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Base currency
          </label>
          <CurrencyDropdown
            value={baseCurrency}
            onChange={(v) => {
              setBaseCurrency(v)
              setCurrencyTouched(true)
              setTouched((t) => ({ ...t, baseCurrency: true }))
            }}
            disabled={disabled}
          />
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
            placeholder="Demo Co., Ltd."
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

// ─── Custom Country Dropdown with flags ─────────────────────────

function CountryDropdown({ value, onChange, disabled }: { value: CountryCode; onChange: (v: CountryCode) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = COUNTRIES.find((c) => c.code === value)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md font-sans text-sm text-gray-900 text-left focus:outline-none focus:border-blue-500 disabled:opacity-60 flex items-center gap-2"
      >
        <img src={getFlagUrl(value)} alt="" className="w-5 h-auto rounded-sm flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <span className="flex-1 truncate">{selected?.code} {selected?.label}</span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => { onChange(c.code); setOpen(false) }}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 transition-colors ${c.code === value ? 'bg-blue-50' : ''}`}
            >
              <img src={getFlagUrl(c.code)} alt="" className="w-5 h-auto rounded-sm flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <span className="font-mono text-xs text-gray-500 w-6">{c.code}</span>
              <span className="font-sans text-sm text-gray-900">{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Currency Dropdown with flags ─────────────────────────

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', JPY: '🇯🇵', THB: '🇹🇭', SGD: '🇸🇬', CHF: '🇨🇭', HKD: '🇭🇰'
}

function CurrencyDropdown({ value, onChange, disabled }: { value: CurrencyCode; onChange: (v: CurrencyCode) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md font-sans text-sm text-gray-900 text-left focus:outline-none focus:border-blue-500 disabled:opacity-60 flex items-center gap-2"
      >
        <span className="text-base">{CURRENCY_FLAGS[value] || '💱'}</span>
        <span className="flex-1 truncate">{value}</span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {CURRENCIES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => { onChange(code); setOpen(false) }}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 transition-colors ${code === value ? 'bg-blue-50' : ''}`}
            >
              <span className="text-base">{CURRENCY_FLAGS[code] || '💱'}</span>
              <span className="font-mono text-xs text-gray-500 w-8">{code}</span>
              <span className="font-sans text-sm text-gray-900">{code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
