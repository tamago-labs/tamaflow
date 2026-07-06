// Country + currency data for the employee roster and company profile.
//
// `COUNTRIES` is the 4 supported jurisdictions (matching the old version).
// `CURRENCIES` is the closed allowlist for pay/compensation currency.
// `LEGAL_ENTITY_TYPES` is the closed allowlist for company legal entity.
//
// `WORLD_COUNTRIES` (in worldCountries.ts) is the full ISO 3166-1 list
// for the employee country picker.

import type { CountryCode, CurrencyCode, LegalEntityType } from '../ai/types'

export interface CountryOption {
  code: CountryCode
  flag: string
  label: string
  defaultCurrency: CurrencyCode
}

export const COUNTRIES: ReadonlyArray<CountryOption> = [
  { code: 'JP', flag: '🇯🇵', label: 'Japan', defaultCurrency: 'JPY' },
  { code: 'TH', flag: '🇹🇭', label: 'Thailand', defaultCurrency: 'THB' },
  { code: 'US-DE', flag: '🇺🇸', label: 'United States (Delaware)', defaultCurrency: 'USD' },
  { code: 'VG', flag: '🇻🇬', label: 'British Virgin Islands', defaultCurrency: 'USD' }
]

export const CURRENCIES: ReadonlyArray<CurrencyCode> = ['JPY', 'THB', 'USD', 'EUR']

export interface LegalEntityTypeOption {
  value: LegalEntityType
  label: string
}

export const LEGAL_ENTITY_TYPES: ReadonlyArray<LegalEntityTypeOption> = [
  { value: 'corporation', label: 'Corporation' },
  { value: 'limited_company', label: 'Limited Company' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'non_profit', label: 'Non-profit' },
  { value: 'other', label: 'Other' }
]

export function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code
}
