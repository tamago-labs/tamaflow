"use client";

/**
 * HoldingsTable — employee's tokenized holdings on the Canton network.
 *
 * Renders as a real `<table>` (not a list) so it reads like a
 * financial position view rather than a "card grid". The page
 * already provides the surrounding card chrome (`bg-white border
 * border-border rounded-md`), so this component just owns
 * the table body.
 *
 * Columns (left → right):
 *   • Asset    — real token image (or initials fallback) + token
 *                name (orgName) as the primary label
 *   • Amount   — balance + symbol, single line, right-aligned
 *   • USD Value — formatted USD value, right-aligned
 *   • 24h       — change %, brand-ok for positive / brand-err for negative
 *   • Action   — "Send" button + "More ▾" dropdown (Swap / Bridge)
 *
 * Reads `holdings` from `useWallet()` and `usePrice(symbol)` from
 * `lib/price/PriceContext.tsx` for the USD / 24h columns.
 *
 * Two render branches:
 *   • Not connected → "Connect wallet to view tokens" CTA
 *   • Has tokens → the table (no "no tokens" empty state)
 *
 * Auto-refresh: every `REFRESH_INTERVAL_MS` while connected and
 * the tab is visible.
 *
 * Sort: `CC` pinned to the top, then alphabetical by symbol.
 */
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Coins,
  MoreHorizontal,
  Repeat2,
  Send,
  Wallet,
  Workflow,
} from "lucide-react";
import { useWallet } from "@/lib/wallet/WalletContext";
import {
  PriceContext,
  usePrice,
  formatChange,
} from "@/lib/price/PriceContext";
import { STYLES } from "@/lib/theme";

/** How often to re-fetch holdings while the wallet is connected. */
const REFRESH_INTERVAL_MS = 30_000;

/** Tokens pinned to the top of the table. */
const PINNED_SYMBOLS = ["CC"];

/**
 * Hard-coded override logos for tokens whose backend image is
 * empty or otherwise unreliable. Map of `symbol → URL`.
 * (Currently: CC's backend returns an empty string, so we use
 * the CoinMarketCap public thumbnail instead.)
 */
const TOKEN_IMAGE_OVERRIDES: Record<string, string> = {
  CC: "https://s2.coinmarketcap.com/static/img/coins/64x64/37263.png",
};

/**
 * Base URL prepended to relative token-image paths returned by the
 * backend. The backend serves token logos at `/api/v1/assets/...`
 * (relative) — to make them loadable in the browser we need an
 * absolute URL, and the devnet hosts them at `devnet.cantonloop.com`.
 *
 * If a future backend ever returns an absolute URL (e.g. via a CDN),
 * we detect the `http` prefix and skip the prepend.
 */
const TOKEN_IMAGE_BASE_URL = "https://devnet.cantonloop.com";

/**
 * Format a USD value to a sensible number of decimals based on its
 * magnitude.
 */
function formatUsd(value: number): string {
  if (value >= 100) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 3 })}`;
  return `$${value.toFixed(3)}`;
}

/** Format a token amount with thousands separators (no decimals). */
function formatAmount(value: string): string {
  const n = parseFloat(value.replace(/,/g, ""));
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function HoldingsTable() {
  const { status, holdings, refreshHoldings, connect } = useWallet();
  const prices = useContext(PriceContext);

  // Auto-refresh
  useEffect(() => {
    if (status !== "connected") return;
    refreshHoldings();
    const id = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        refreshHoldings();
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, refreshHoldings]);

  // Sort: pinned first, then alphabetical
  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const aPinned = PINNED_SYMBOLS.indexOf(a.symbol);
      const bPinned = PINNED_SYMBOLS.indexOf(b.symbol);
      if (aPinned !== -1 && bPinned !== -1) return aPinned - bPinned;
      if (aPinned !== -1) return -1;
      if (bPinned !== -1) return 1;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [holdings]);

  // Sum USD value across all priced holdings — shown in the header so the
  // user sees their portfolio total at a glance without having to add
  // each row manually. Holdings without a known price are skipped (we
  // don't want to pretend they're worth $0).
  const totalUsd = useMemo(() => {
    return sortedHoldings.reduce((sum, h) => {
      const price = prices[h.symbol];
      const amount = parseFloat(h.unlocked.replace(/,/g, ""));
      if (!price || Number.isNaN(amount)) return sum;
      return sum + amount * price.usd;
    }, 0);
  }, [sortedHoldings, prices]);

  // --- 1. Wallet not connected ----------------------------------------
  if (status !== "connected") {
    return (
      <EmptyState
        icon={<Wallet size={20} />}
        title="Connect wallet to view tokens"
        body="Link your Loop wallet to see your token balances on Canton network."
        cta={
          <button
            type="button"
            onClick={connect}
            className={STYLES.buttonPrimary}
          >
            <Wallet size={12} />
            Connect Wallet
          </button>
        }
      />
    );
  }

  // --- 2. Holdings table ---------------------------------------------
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className={STYLES.label}>All Assets</p>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Total Value
          </span>
          <span className="font-mono text-sm font-bold text-brand-navy">
            {formatUsd(totalUsd)}
          </span>
        </div>
      </div>

      <div className="border border-brand-border rounded-md overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-brand-light border-b border-brand-border">
              <th className="text-left font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold py-2.5 px-4">
                Asset
              </th>
              <th className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold py-2.5 px-4">
                Amount
              </th>
              <th className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold py-2.5 px-4 hidden sm:table-cell">
                USD Value
              </th>
              <th className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold py-2.5 px-4">
                24h
              </th>
              <th className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold py-2.5 px-4">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.map((h) => (
              <HoldingRow key={`${h.instrumentId.admin}::${h.instrumentId.id}`} h={h} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-row component — keeps the price lookup isolated so each row only     */
/* re-renders when its own price changes.                                    */
/* -------------------------------------------------------------------------- */

interface HoldingRowProps {
  h: {
    symbol: string;
    orgName: string;
    image?: string;
    unlocked: string;
  };
}

function HoldingRow({ h }: HoldingRowProps) {
  const price = usePrice(h.symbol);
  const amount = parseFloat(h.unlocked.replace(/,/g, ""));
  const usdValue = price && !Number.isNaN(amount) ? amount * price.usd : null;

  return (
    <tr className="border-b border-brand-border last:border-b-0 hover:bg-brand-light/40 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <TokenAvatar image={h.image} symbol={h.symbol} />
          <p className="font-mono text-sm font-bold text-brand-navy m-0 truncate">
            {h.orgName}
          </p>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="font-mono text-sm text-brand-navy m-0 whitespace-nowrap">
          {formatAmount(h.unlocked)} <span className="text-brand-muted">{h.symbol}</span>
        </p>
      </td>
      <td className="py-3 px-4 text-right hidden sm:table-cell">
        {usdValue !== null && price ? (
          <p className="font-mono text-sm text-brand-navy m-0">
            {formatUsd(usdValue)}
          </p>
        ) : (
          <p className="font-mono text-sm text-brand-muted m-0">—</p>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        {price ? (
          <span
            className={`font-mono text-sm font-medium ${
              price.change24h >= 0 ? "text-brand-ok" : "text-brand-err"
            }`}
          >
            {formatChange(price.change24h)}
          </span>
        ) : (
          <span className="font-mono text-sm text-brand-muted">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <ActionCell symbol={h.symbol} />
      </td>
    </tr>
  );
}

/* -------------------------------------------------------------------------- */
/* ActionCell — per-row "Send" button + "More ▾" dropdown (Swap / Bridge). */
/* -------------------------------------------------------------------------- */

function ActionCell({ symbol }: { symbol: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 justify-end">
      <button
        type="button"
        className="inline-flex items-center gap-1 py-1 px-2.5 bg-brand-blue text-white rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 transition-opacity"
        title={`Send ${symbol}`}
      >
        <Send size={11} />
        Send
      </button>
      <MoreDropdown symbol={symbol} />
    </div>
  );
}

function MoreDropdown({ symbol }: { symbol: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${symbol}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-6 h-6 bg-white text-brand-muted border border-brand-border rounded-md cursor-pointer hover:bg-brand-light hover:text-brand-navy transition-colors"
      >
        <MoreHorizontal size={12} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-44 bg-white border border-brand-border rounded-md shadow-[0_18px_50px_-12px_rgba(10,10,92,0.25)] overflow-hidden z-50"
        >
          <a
            href="#"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 hover:bg-brand-light transition-colors no-underline"
          >
            <Repeat2 size={12} className="text-brand-muted" />
            <span className="font-mono text-[11px] font-bold tracking-wider2 text-brand-navy uppercase">
              Swap
            </span>
          </a>
          <a
            href="#"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 hover:bg-brand-light transition-colors no-underline"
          >
            <Workflow size={12} className="text-brand-muted" />
            <span className="font-mono text-[11px] font-bold tracking-wider2 text-brand-navy uppercase">
              Bridge
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TokenAvatar — uses override → backend → initials fallback.                */
/* Resolution order:                                                         */
/*   1. Hard-coded override (TOKEN_IMAGE_OVERRIDES) — used for CC, etc.    */
/*   2. Backend image, with the devnet base URL prepended if relative       */
/*   3. 2-letter initials chip (last-resort fallback)                       */
/* -------------------------------------------------------------------------- */

interface TokenAvatarProps {
  image?: string;
  symbol: string;
}

function TokenAvatar({ image, symbol }: TokenAvatarProps) {
  // 1. Hard-coded override (e.g. CC's CoinMarketCap thumbnail)
  const override = TOKEN_IMAGE_OVERRIDES[symbol];
  if (override) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={override}
        alt={`${symbol} logo`}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-brand-light border border-brand-border"
      />
    );
  }

  // 2. Backend image, with base URL prepended if relative
  if (image && image.length > 0) {
    const absoluteUrl = image.startsWith("http")
      ? image
      : `${TOKEN_IMAGE_BASE_URL}${image}`;
    const cleanSrc = absoluteUrl.replace(/\?v=\d+$/, "");
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cleanSrc}
        alt={`${symbol} logo`}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-brand-light border border-brand-border"
      />
    );
  }

  // 3. Initials chip
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-light border border-brand-border font-mono text-[10px] font-bold text-brand-navy"
      aria-hidden="true"
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: React.ReactNode;
}

function EmptyState({ icon, title, body, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-12 gap-2">
      <div className="w-10 h-10 rounded-full bg-brand-light border border-brand-border flex items-center justify-center text-brand-muted">
        {icon}
      </div>
      <p className="font-sans text-sm font-medium text-brand-navy m-0">
        {title}
      </p>
      <p className="font-sans text-xs text-brand-muted m-0 max-w-sm">
        {body}
      </p>
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  );
}
