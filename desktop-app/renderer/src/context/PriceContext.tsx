// PriceContext — global price conversion API for the renderer.
//
// The price table lives in `lib/priceProvider.ts` and is USD-relative.
// Consumers shouldn't import that module directly — they should pull
// values off this context so we can swap to a live oracle later
// without touching any consumer.
//
// Shape:
//   • `rates`         — the raw USD-relative table (debug / future use)
//   • `updated`       — manual rate-update date string
//   • `convert(a, f, t)` — two-step `from → USD → to` converter
//   • `formatConverted(value, ccy)` — fixed-precision string formatter

import { createContext, useContext, type ReactNode } from 'react'
import {
  PRICE_TABLE,
  PRICE_TABLE_UPDATED,
  convert as _convert,
  formatConverted as _formatConverted,
  type PricedCurrency
} from '../lib/priceProvider'

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
    formatConverted: _formatConverted
  }
  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>
}

export function usePrice(): PriceContextValue {
  const ctx = useContext(PriceContext)
  if (!ctx) throw new Error('usePrice must be used inside <PriceProvider>')
  return ctx
}
