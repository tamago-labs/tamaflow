export type PayCurrency = 'JPY' | 'THB' | 'USD' | 'EUR'

export interface ComputeInput {
  grossPay: string
  payCurrency: PayCurrency
  fxRate?: string
}

export interface ComputeResult {
  grossPay: string
  payCurrency: PayCurrency
  fxRateApplied?: string
  amountCC: string
}

function decimalToMinor(value: string, decimals: number): bigint {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid decimal: ${value}`)
  }
  const [whole, frac = ''] = trimmed.split('.')
  const paddedFrac = (frac + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(paddedFrac || '0')
}

function minorToDecimal(minor: bigint, decimals: number): string {
  const factor = BigInt(10) ** BigInt(decimals)
  const whole = minor / factor
  const frac = minor % factor
  const fracStr = frac.toString().padStart(decimals, '0')
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed === '' ? whole.toString() : `${whole.toString()}.${trimmed}`
}

function decimalMul(value: string, rate: string, precision: number): string {
  const RATE_PRECISION = 18
  const valueMinor = decimalToMinor(value, precision)
  const rateMinor = decimalToMinor(rate, RATE_PRECISION)
  const product = valueMinor * rateMinor
  const divisor = BigInt(10) ** BigInt(RATE_PRECISION)
  const quotient = product / divisor
  const remainder = product % divisor
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient
  return minorToDecimal(rounded, precision)
}

function padCC(value: string, decimals: number): string {
  const minor = decimalToMinor(value, decimals)
  return minorToDecimal(minor, decimals)
}

function isFiniteRate(rate: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(rate)) return false
  const minor = decimalToMinor(rate, 18)
  return minor <= BigInt(10) ** BigInt(18)
}

export function computeOutcome(input: ComputeInput): ComputeResult {
  const { grossPay, payCurrency, fxRate } = input
  const CC_DECIMALS = 10

  let amountCC: string
  let fxRateApplied: string | undefined

  if ((payCurrency as string) === 'CC') {
    amountCC = padCC(grossPay, CC_DECIMALS)
    fxRateApplied = undefined
  } else {
    if (!fxRate || fxRate === '') {
      throw new Error(`FX rate required for payCurrency=${payCurrency} but not provided`)
    }
    if (!isFiniteRate(fxRate)) {
      throw new Error(`Invalid fxRate: ${fxRate}`)
    }
    fxRateApplied = fxRate
    amountCC = padCC(decimalMul(grossPay, fxRate, CC_DECIMALS), CC_DECIMALS)
  }

  const result: ComputeResult = { grossPay, payCurrency, amountCC }
  if (fxRateApplied !== undefined) result.fxRateApplied = fxRateApplied
  return result
}
