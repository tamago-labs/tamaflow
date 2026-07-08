// Country + currency data for the employee roster and company profile.

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
  { code: 'US', flag: '🇺🇸', label: 'United States', defaultCurrency: 'USD' },
  { code: 'GB', flag: '🇬🇧', label: 'United Kingdom', defaultCurrency: 'USD' },
  { code: 'SG', flag: '🇸🇬', label: 'Singapore', defaultCurrency: 'USD' },
  { code: 'AE', flag: '🇦🇪', label: 'UAE', defaultCurrency: 'USD' },
  { code: 'EE', flag: '🇪🇪', label: 'Estonia', defaultCurrency: 'EUR' },
  { code: 'HK', flag: '🇭🇰', label: 'Hong Kong', defaultCurrency: 'USD' },
  { code: 'CH', flag: '🇨🇭', label: 'Switzerland', defaultCurrency: 'EUR' },
  { code: 'VG', flag: '🇻🇬', label: 'BVI', defaultCurrency: 'USD' },
  { code: 'PA', flag: '🇵🇦', label: 'Panama', defaultCurrency: 'USD' },
  { code: 'KY', flag: '🇰🇾', label: 'Cayman Islands', defaultCurrency: 'USD' },
  { code: 'MH', flag: '🇲🇭', label: 'Marshall Islands', defaultCurrency: 'USD' }
]

export const CURRENCIES: ReadonlyArray<CurrencyCode> = ['JPY', 'THB', 'USD', 'EUR', 'SGD', 'CHF', 'HKD']

export interface LegalEntityTypeOption {
  value: LegalEntityType
  label: string
}

export const LEGAL_ENTITY_TYPES: ReadonlyArray<LegalEntityTypeOption> = [
  { value: 'dev_lab', label: 'Dev Lab' },
  { value: 'token_spv', label: 'Token SPV' },
  { value: 'dao_wrapper', label: 'DAO Legal Wrapper' },
  { value: 'other', label: 'Other' }
]

export function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code
}
