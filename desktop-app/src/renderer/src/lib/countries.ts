/**
 * Country / currency / legal-entity presets for the Company profile.
 *
 * The four-country list (JP / TH / US-DE / VG) is the MVP scope. Each
 * entry carries the `defaultCurrency` that the CompanyForm auto-fills
 * when the user picks a country — overridable per-field via the
 * touched-state guard (see `CompanyForm.tsx`).
 *
 * These tables are the source of truth on the renderer side; the main
 * process hard-codes the same allowlists in `companyStore.ts` for
 * defence-in-depth validation of imports.
 */
import type { CountryCode, CurrencyCode, LegalEntityType } from '../../../preload/index.d'

export interface CountryPreset {
  code: CountryCode
  label: string
  flag: string
  defaultCurrency: CurrencyCode
}

export const COUNTRIES: ReadonlyArray<CountryPreset> = [
  {
    code: 'JP',
    label: 'Japan',
    flag: '🇯🇵',
    defaultCurrency: 'JPY'
  },
  {
    code: 'TH',
    label: 'Thailand',
    flag: '🇹🇭',
    defaultCurrency: 'THB'
  },
  {
    code: 'US-DE',
    label: 'United States (Delaware)',
    flag: '🇺🇸',
    defaultCurrency: 'USD'
  },
  {
    code: 'VG',
    label: 'British Virgin Islands',
    flag: '🇻🇬',
    defaultCurrency: 'USD'
  }
]

export const CURRENCIES: ReadonlyArray<CurrencyCode> = ['JPY', 'THB', 'USD', 'EUR']

export interface LegalEntityOption {
  value: LegalEntityType
  label: string
}

export const LEGAL_ENTITY_TYPES: ReadonlyArray<LegalEntityOption> = [
  { value: 'corporation', label: 'Corporation' },
  { value: 'limited_company', label: 'Limited Company' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'non_profit', label: 'Non-profit' },
  { value: 'other', label: 'Other' }
]

/** Lookup helper for displaying a country flag + label by code. */
export function countryLabel(code: CountryCode): string {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code
}

/** Lookup helper for displaying the currency code, falls back to the raw value. */
export function currencyLabel(code: CurrencyCode): string {
  return code
}

/** Lookup helper for displaying the legal-entity label by enum value. */
export function legalEntityLabel(value: LegalEntityType): string {
  return LEGAL_ENTITY_TYPES.find((l) => l.value === value)?.label ?? value
}