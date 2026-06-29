// PriceContext — global price conversion API for the renderer.
//
// Today the price table lives in `shared/priceProvider.ts` and is
// USD-relative (every entry is "USD value of 1 unit"). Consumers
// shouldn't import that module directly — they should pull values
// off this context so we can swap to a live oracle (websocket from
// a price feed, or a SWR fetch) later without touching any consumer.
//
// Shape:
//   • `rates`         — the raw USD-relative table (debug / future use)
//   • `updated`       — manual rate-update date string ("2026-06-29")
//   • `convert(a, f, t)` — two-step `from → USD → to` converter
//   • `formatConverted(value, ccy)` — fixed-precision string formatter
//
// Anything outside the renderer (main worker, CLI) keeps importing
// the shared module directly — context is renderer-only.

import { createContext, useContext, type ReactNode } from 'react'
import {
  PRICE_TABLE,
  PRICE_TABLE_UPDATED,
  convert as _convert,
  formatConverted as _formatConverted,
  type PricedCurrency,
} from '../../../shared/priceProvider'

export type { PricedCurrency }

export interface PriceContextValue {
  rates: typeof PRICE_TABLE
  updated: string
  convert: (amount: number, from: PricedCurrency, to: PricedCurrency) => number | null
  formatConverted: (value: number, ccy: PricedCurrency) => string
}

const PriceContext = createContext<PriceContextValue | null>(null)

export function PriceProvider({ children }: { children: ReactNode }) {
  const value: PriceContextValue = {
    rates: PRICE_TABLE,
    updated: PRICE_TABLE_UPDATED,
    convert: _convert,
    formatConverted: _formatConverted,
  }
  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>
}

/**
 * Hook: returns the price context. Throws if used outside a
 * `<PriceProvider>` so a missing mount fails loudly instead of
 * silently returning nulls.
 */
export function usePrice(): PriceContextValue {
  const ctx = useContext(PriceContext)
  if (!ctx) throw new Error('usePrice must be used inside <PriceProvider>')
  return ctx
}