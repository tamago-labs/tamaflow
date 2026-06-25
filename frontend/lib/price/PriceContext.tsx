"use client";

/**
 * PriceContext — global state for token prices.
 *
 * v1: hardcoded values for the three tokens we care about (CC, cETH, CBTC).
 * Future: swap the static `PRICES` map for a real-time price feed
 * (e.g. websocket from a price oracle, or a SWR fetch to `/api/prices`).
 * The consumer API (`usePrice(symbol)`) won't change, so any swap
 * is invisible to the rest of the app.
 *
 * The shape returned by `usePrice()` is intentionally minimal — only
 * what the tokens table needs today (USD value + 24h change). Add
 * fields (volume, market cap, sparkline) as we need them.
 */
import { createContext, useContext, type ReactNode } from "react";

export interface Price {
  /** Spot price in USD. */
  usd: number;
  /** 24h change as a percentage (e.g. `1.47` = +1.47%, `-2.78` = -2.78%). */
  change24h: number;
}

const PRICES: Record<string, Price> = {
  CC: { usd: 0.153, change24h: 1.47 },
  cETH: { usd: 1629.618, change24h: -2.78 },
  CBTC: { usd: 61138.372, change24h: -2.69 },
};

const PriceContext = createContext<Record<string, Price>>(PRICES);

export function PriceProvider({ children }: { children: ReactNode }) {
  return (
    <PriceContext.Provider value={PRICES}>{children}</PriceContext.Provider>
  );
}

/**
 * Hook: returns the price info for a given token symbol, or
 * `undefined` if no price is known (e.g. an unknown token).
 */
export function usePrice(symbol: string): Price | undefined {
  const prices = useContext(PriceContext);
  return prices[symbol];
}

/**
 * Format a `change24h` value as a sign-prefixed percent string
 * (e.g. `1.47` → `"+1.47%"`, `-2.78` → `"-2.78%"`).
 */
export function formatChange(change: number): string {
  const sign = change > 0 ? "+" : change < 0 ? "" : "±";
  return `${sign}${change.toFixed(2)}%`;
}
