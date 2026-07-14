// Price table + USD-relative rate conversion for the renderer.
//
// Tamaflow v1 ships hard-coded rates. The shape mirrors the old
// `frontend/shared/priceProvider.ts` so the `usePrice().convert()`
// consumer API is identical — easy to swap to a live oracle.

/** USD-relative rate table: "USD value of 1 unit of the symbol". */
export const PRICE_TABLE: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  JPY: 0.0067,
  THB: 0.028,
  SGD: 0.74,
  CHF: 1.13,
  HKD: 0.13,
  CC: 0.15,
  JPYC: 0.0067  // JPYC is pegged to JPY
}

/** ISO date the rates were last touched. */
export const PRICE_TABLE_UPDATED = '2026-07-08'

/** Currencies the renderer knows how to convert. */
export type PricedCurrency = 'CC' | 'USD' | 'EUR' | 'JPY' | 'THB' | 'SGD' | 'CHF' | 'HKD' | 'JPYC'

/** Lookup the USD value of 1 unit of `ccy`. */
function usdPerUnit(ccy: PricedCurrency): number | null {
  const rate = PRICE_TABLE[ccy]
  return typeof rate === 'number' && rate > 0 ? rate : null
}

/**
 * Two-step `from → USD → to` conversion. Returns `null` if either
 * leg's rate is missing.
 */
export function convert(
  amount: number,
  from: PricedCurrency,
  to: PricedCurrency
): number | null {
  if (!Number.isFinite(amount)) return null
  if (from === to) return amount
  if (to !== 'USD' && from !== 'USD') {
    const fromUsd = usdPerUnit(from)
    const toUsd = usdPerUnit(to)
    if (fromUsd === null || toUsd === null) return null
    return (amount * fromUsd) / toUsd
  }
  if (to === 'USD') {
    const r = usdPerUnit(from)
    return r === null ? null : amount * r
  }
  const r = usdPerUnit(to)
  return r === null ? null : amount / r
}

/** Format a converted value with sensible decimals. */
export function formatConverted(value: number, ccy: PricedCurrency): string {
  if (ccy === 'USD') {
    if (value >= 100) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
    return `$${value.toFixed(3)}`
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}
