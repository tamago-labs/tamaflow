// Hardcoded FX rate table — single source of truth for CC ↔ fiat
// conversions across the desktop app.
//
// Why hardcoded?
//   • MVP doesn't pull from a price oracle (CoinGecko, CMC, …).
//   • Rates drift slowly; bumping the table by hand is fine for now.
//   • The whole table is small (4 fiat + CC) so it's easy to review when
//     we eventually swap to a fetch.
//
// Convention
// ----------
// Every rate is denominated in USD — PRICE_TABLE[ccy] = USD value of
// 1 unit of `ccy`. USD is the implicit bridge for every conversion:
//   amount_in_USD  = amount × PRICE_TABLE[from]
//   amount_in_TO   = amount_in_USD / PRICE_TABLE[to]
//
// Example: 1910 CC → JPY with `PRICE_TABLE.CC = 0.15` and
// `PRICE_TABLE.JPY = 0.0067`:
//   1910 CC × 0.15 USD/CC = 286.5 USD
//   286.5 USD / 0.0067 USD/JPY ≈ 42,761 JPY
//
// Imported by both the renderer (Source card edit-mode balance, route
// preview totals, Assets page USD column) and the main worker (future
// FX autofill on the Payee card). No I/O — safe to use from either
// side. The renderer should consume it through PriceContext so the
// shape is stable across future swaps.

import type { CurrencyCode } from '../preload/index.d'

/** Closed allowlist of currencies the price provider knows about.
 *  Mirrors the MVP fiat allowlist + CC. */
export type PricedCurrency = CurrencyCode | 'CC'

/** USD value of 1 unit of the keyed currency. e.g. PRICE_TABLE.EUR =
 *  1.10 means 1 EUR = 1.10 USD. USD itself = 1.0 (identity). CC is
 *  priced against USD like any other token. */
export const PRICE_TABLE: Record<PricedCurrency, number> = {
  USD: 1.0,
  CC: 0.15,
  EUR: 1.1,
  JPY: 0.0067,
  THB: 0.028,
}

/** Last manual update — surfaced in the UI so users know the price
 *  isn't live. Update this when the table moves materially. */
export const PRICE_TABLE_UPDATED = '2026-06-29'

/** Return the USD rate for a currency, or null when unknown. */
export function priceFor(ccy: PricedCurrency): number | null {
  const rate = PRICE_TABLE[ccy]
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null
}

/** Convert `amount` from `from` → `to` via USD as the bridge.
 *  Returns null when either side is missing from the table — the
 *  caller decides how to render the gap. */
export function convert(
  amount: number,
  from: PricedCurrency,
  to: PricedCurrency,
): number | null {
  if (!Number.isFinite(amount)) return null
  if (from === to) return amount
  const fromRate = priceFor(from)
  const toRate = priceFor(to)
  if (fromRate === null || toRate === null) return null
  // amount × fromRate = USD value of `amount`
  // USD value / toRate = amount in `to`
  return (amount * fromRate) / toRate
}

/** Format a converted value as a fixed-precision decimal string.
 *  Defaults to 2dp for fiat / 10dp for CC — matches the ledger
 *  conventions used elsewhere in the app. */
export function formatConverted(value: number, ccy: PricedCurrency): string {
  if (!Number.isFinite(value)) return '—'
  const decimals = ccy === 'CC' ? 10 : 2
  return value.toFixed(decimals)
}

/** Convenience: list every priced currency. Useful for Settings /
 *  future rate-management UIs. */
export function listSupportedCurrencies(): PricedCurrency[] {
  return Object.keys(PRICE_TABLE) as PricedCurrency[]
}