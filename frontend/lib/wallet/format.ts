/**
 * Display formatters for wallet-related data. Centralised so the truncation
 * length, thousands-separator style, and amount decimals stay consistent
 * across the top bar, dashboard, and settings page.
 */
import type { Account, Holding, HoldingFormatted } from "./types";

/**
 * Insert thousands separators into the integer part of a decimal string
 * without touching the fractional digits. We split on the first "." so we
 * don't run a regex on every digit.
 */
function addThousandsSeparators(amount: string): string {
  const [intPart, fracPart] = amount.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fracPart !== undefined ? `${withCommas}.${fracPart}` : withCommas;
}

/**
 * Format a Canton decimal-string amount (e.g. "1000.0000000000") for display.
 * Pads the fractional part to `decimals` so all holdings line up nicely, then
 * adds thousands separators to the integer part.
 */
export function formatAmount(raw: string, decimals: number): string {
  if (!raw) return "0";
  const [intPart, fracPart = ""] = raw.split(".");
  const paddedFrac = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  return addThousandsSeparators(paddedFrac ? `${intPart}.${paddedFrac}` : intPart);
}

/**
 * Convert a raw SDK `Holding` into a `HoldingFormatted` view-model.
 * `unlocked` and `locked` are the human-readable totals (no symbol suffix);
 * the row component appends the symbol itself.
 */
export function formatHolding(holding: Holding): HoldingFormatted {
  return {
    symbol: holding.symbol,
    orgName: holding.org_name,
    image: holding.image,
    unlocked: formatAmount(holding.total_unlocked_coin, holding.decimals),
    locked: formatAmount(holding.total_locked_coin, holding.decimals),
    decimals: holding.decimals,
    instrumentId: holding.instrument_id,
  };
}

/**
 * Truncate a Canton party ID for the top-bar badge. We keep the first 6 and
 * last 4 characters of the fingerprint so two parties with the same prefix
 * are still distinguishable at a glance.
 */
export function truncateParty(party: string | null | undefined): string {
  if (!party) return "";
  if (party.length <= 12) return party;
  return `${party.slice(0, 6)}…${party.slice(-4)}`;
}

/**
 * Map the boolean/enum fields on the SDK `Account` object to the labels the
 * demo uses. Returns "—" when the field is missing (which happens on a fresh
 * connect before `getAccount()` resolves).
 */
export function formatAccountField(
  account: Account | null,
  field: "preapproval" | "merge_delegation" | "usdc_bridge" | "email",
): string {
  if (!account) return "—";
  switch (field) {
    case "email":
      return account.email ?? "—";
    case "preapproval":
      return account.has_preapproval ? "enabled" : "not enabled";
    case "merge_delegation":
      return account.has_merge_delegation ? "enabled" : "not enabled";
    case "usdc_bridge":
      switch (account.usdc_bridge_access) {
        case "granted":
          return "granted";
        case "pending":
          return "pending";
        case "not_requested":
        default:
          return "not requested";
      }
  }
}
