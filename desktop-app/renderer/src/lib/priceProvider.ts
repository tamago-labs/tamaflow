// Price table + USD-relative rate conversion for the renderer.
//
// Tamaflow v1 ships a single hard-coded rate (CC ↔ USD). The shape
// mirrors the old `frontend/shared/priceProvider.ts` so the
// `usePrice().convert()` consumer API is identical — easy to swap to
// a live oracle (CoinGecko, CoinMarketCap) without touching the
// Assets page.

/** USD-relative rate table: "USD value of 1 unit of the symbol". */
export const PRICE_TABLE: Record<string, number> = {
  CC: 1
}

/** ISO date the rates were last touched. Bumped when the table
 *  changes (e.g. when we wire up a real feed). */
export const PRICE_TABLE_UPDATED = '2026-07-05'

/** Currencies we know how to convert. Keeps the type narrow so the
 *  `convert` function doesn't accept arbitrary strings. */
export type PricedCurrency = 'CC'

/** Lookup the USD value of 1 unit of `ccy`. Returns `null` if we
 *  don't have a rate. */
function usdPerUnit(ccy: PricedCurrency): number | null {
  const rate = PRICE_TABLE[ccy]
  return typeof rate === 'number' && rate > 0 ? rate : null
}

/**
 * Two-step `from → USD → to` conversion. Returns `null` if either
 * leg's rate is missing — callers should render "—" in that case
 * (don't fall back to a placeholder currency).
 */
export function convert(
  amount: number,
  from: PricedCurrency,
  to: PricedCurrency
): number | null {
  if (!Number.isFinite(amount)) return null
  if (from === to) return amount
  if (to !== 'USD' && from !== 'USD') {
    // Convert through USD: from → USD → to
    const fromUsd = usdPerUnit(from)
    const toUsd = usdPerUnit(to)
    if (fromUsd === null || toUsd === null) return null
    return (amount * fromUsd) / toUsd
  }
  if (to === 'USD') {
    const r = usdPerUnit(from)
    return r === null ? null : amount * r
  }
  // from === 'USD'
  const r = usdPerUnit(to)
  return r === null ? null : amount / r
}

/** Format a converted value (post-conversion) with a sensible number
 *  of decimals based on magnitude. */
export function formatConverted(value: number, ccy: PricedCurrency): string {
  if (ccy === 'USD') {
    if (value >= 100)
      return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    if (value >= 1)
      return `$${value.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
    return `$${value.toFixed(3)}`
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}
