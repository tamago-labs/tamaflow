// Major countries for the employee country picker.
// Focused on jurisdictions relevant for web3/crypto operations.

export interface WorldCountry {
  code: string
  flag: string
  label: string
}

export const WORLD_COUNTRIES: ReadonlyArray<WorldCountry> = [
  // East Asia
  { code: 'JP', flag: '🇯🇵', label: 'Japan' },
  { code: 'KR', flag: '🇰🇷', label: 'South Korea' },
  { code: 'CN', flag: '🇨🇳', label: 'China' },
  { code: 'TW', flag: '🇹🇼', label: 'Taiwan' },
  { code: 'HK', flag: '🇭🇰', label: 'Hong Kong' },
  { code: 'MO', flag: '🇲🇴', label: 'Macau' },

  // Southeast Asia (ASEAN minus Laos, Myanmar, Cambodia, Timor)
  { code: 'TH', flag: '🇹🇭', label: 'Thailand' },
  { code: 'SG', flag: '🇸🇬', label: 'Singapore' },
  { code: 'MY', flag: '🇲🇾', label: 'Malaysia' },
  { code: 'PH', flag: '🇵🇭', label: 'Philippines' },
  { code: 'ID', flag: '🇮🇩', label: 'Indonesia' },
  { code: 'VN', flag: '🇻🇳', label: 'Vietnam' },
  { code: 'BN', flag: '🇧🇳', label: 'Brunei' },

  // South Asia
  { code: 'IN', flag: '🇮🇳', label: 'India' },
  { code: 'PK', flag: '🇵🇰', label: 'Pakistan' },
  { code: 'BD', flag: '🇧🇩', label: 'Bangladesh' },
  { code: 'LK', flag: '🇱🇰', label: 'Sri Lanka' },

  // Oceania
  { code: 'AU', flag: '🇦🇺', label: 'Australia' },
  { code: 'NZ', flag: '🇳🇿', label: 'New Zealand' },

  // North America
  { code: 'US', flag: '🇺🇸', label: 'United States' },
  { code: 'CA', flag: '🇨🇦', label: 'Canada' },

  // Latin America (major)
  { code: 'MX', flag: '🇲🇽', label: 'Mexico' },
  { code: 'BR', flag: '🇧🇷', label: 'Brazil' },
  { code: 'AR', flag: '🇦🇷', label: 'Argentina' },
  { code: 'CL', flag: '🇨🇱', label: 'Chile' },
  { code: 'CO', flag: '🇨🇴', label: 'Colombia' },
  { code: 'PE', flag: '🇵🇪', label: 'Peru' },

  // Europe (major)
  { code: 'GB', flag: '🇬🇧', label: 'United Kingdom' },
  { code: 'DE', flag: '🇩🇪', label: 'Germany' },
  { code: 'FR', flag: '🇫🇷', label: 'France' },
  { code: 'IT', flag: '🇮🇹', label: 'Italy' },
  { code: 'ES', flag: '🇪🇸', label: 'Spain' },
  { code: 'NL', flag: '🇳🇱', label: 'Netherlands' },
  { code: 'CH', flag: '🇨🇭', label: 'Switzerland' },
  { code: 'SE', flag: '🇸🇪', label: 'Sweden' },
  { code: 'NO', flag: '🇳🇴', label: 'Norway' },
  { code: 'DK', flag: '🇩🇰', label: 'Denmark' },
  { code: 'FI', flag: '🇫🇮', label: 'Finland' },
  { code: 'IE', flag: '🇮🇪', label: 'Ireland' },
  { code: 'PT', flag: '🇵🇹', label: 'Portugal' },
  { code: 'PL', flag: '🇵🇱', label: 'Poland' },
  { code: 'AT', flag: '🇦🇹', label: 'Austria' },
  { code: 'BE', flag: '🇧🇪', label: 'Belgium' },
  { code: 'CZ', flag: '🇨🇿', label: 'Czech Republic' },

  // Middle East (major)
  { code: 'AE', flag: '🇦🇪', label: 'United Arab Emirates' },
  { code: 'SA', flag: '🇸🇦', label: 'Saudi Arabia' },
  { code: 'QA', flag: '🇶🇦', label: 'Qatar' },
  { code: 'IL', flag: '🇮🇱', label: 'Israel' },
  { code: 'TR', flag: '🇹🇷', label: 'Turkey' },
  { code: 'JO', flag: '🇯🇴', label: 'Jordan' },
  { code: 'BH', flag: '🇧🇭', label: 'Bahrain' },
  { code: 'KW', flag: '🇰🇼', label: 'Kuwait' },
  { code: 'OM', flag: '🇴🇲', label: 'Oman' },

  // Africa (major)
  { code: 'ZA', flag: '🇿🇦', label: 'South Africa' },
  { code: 'NG', flag: '🇳🇬', label: 'Nigeria' },
  { code: 'KE', flag: '🇰🇪', label: 'Kenya' },
  { code: 'EG', flag: '🇪🇬', label: 'Egypt' },
  { code: 'MA', flag: '🇲🇦', label: 'Morocco' },
  { code: 'GH', flag: '🇬🇭', label: 'Ghana' },
  { code: 'TZ', flag: '🇹🇿', label: 'Tanzania' },

  // Crypto-friendly jurisdictions
  { code: 'VG', flag: '🇻🇬', label: 'British Virgin Islands' },
  { code: 'KY', flag: '🇰🇾', label: 'Cayman Islands' },
  { code: 'PA', flag: '🇵🇦', label: 'Panama' },
  { code: 'EE', flag: '🇪🇪', label: 'Estonia' },
  { code: 'MH', flag: '🇲🇭', label: 'Marshall Islands' },
]

export function worldCountryLabel(code: string): string {
  return WORLD_COUNTRIES.find((c) => c.code === code)?.label ?? code
}
