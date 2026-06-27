import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWallet } from '../context/WalletContext'
import {
  ChevronDown,
  Repeat2,
  Send,
  Wallet,
  Workflow,
} from 'lucide-react'
import PendingTransfersCard from '../components/PendingTransfersCard'

/**
 * Assets — tokenized holdings on Canton, sourced directly from the
 * wallet SDK's UTXO list (`sdk.token.utxos.list({ partyId })`).
 *
 * Canton uses a UTXO model: a party's balance is the sum of all the
 * `Holding` contracts in their position. `wallet.getHoldings()`
 * aggregates by instrumentId and ships one row per token here.
 *
 * The table mirrors the web frontend's HoldingsCard: token avatar
 * (image → initials), full token name as the primary label, balance +
 * symbol, USD value + 24h columns, and a Send button plus a "More ▾"
 * dropdown (Swap / Bridge) in the action cell.
 *
 * USD value + 24h are computed from a hard-coded price table (mirrors
 * how the frontend's PriceContext falls back when no live source is
 * available). Symbols without a price entry show "—".
 *
 * No locked column (UTXO locks aren't surfaced), no manual refresh
 * (auto-refresh is handled centrally by WalletContext's useInterval),
 * no page header (matches Dashboard).
 */

// Pinned symbols appear at the top, in this order.
const PINNED_SYMBOLS = ['CC']

// Hard-coded override logos for tokens whose backend image is empty.
// CC's CoinMarketCap thumbnail is reliable; the backend doesn't expose
// one for the DevNet Amulet today.
const TOKEN_IMAGE_OVERRIDES: Record<string, string> = {
  CC: 'https://s2.coinmarketcap.com/static/img/coins/64x64/37263.png',
}

// Hard-coded price + 24h change per symbol. Mirrors the web frontend's
// fallback when no live price source is wired up. `null` entries show
// "—" in the table. Replace with a fetch from CoinMarketCap / CoinGecko
// when network access is needed.
const TOKEN_PRICES: Record<string, { usd: number; change24h: number } | null> = {
  CC: { usd: 0.087, change24h: 1.42 },
}

// Display name override. The wallet SDK currently returns the bare
// instrument id (e.g. "Amulet") and not the human-readable name —
// look up the friendly name here so the Asset column reads naturally.
const TOKEN_NAME_OVERRIDES: Record<string, string> = {
  CC: 'Canton',
  Amulet: 'Canton',
}

/**
 * Resolve a token's friendly display name from whatever the SDK gave
 * us. Falls back to the raw instrument id if we don't have an entry.
 */
function tokenName(symbol: string, instrumentId: string): string {
  return TOKEN_NAME_OVERRIDES[symbol] ?? TOKEN_NAME_OVERRIDES[instrumentId] ?? instrumentId
}

/** Format a USD value to a sensible number of decimals based on magnitude. */
function formatUsd(value: number): string {
  if (value >= 100) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
  return `$${value.toFixed(3)}`
}

/** Format a 24h change percent. */
function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

/** Insert thousands separators into a decimal-string amount. */
function formatAmount(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '0'
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

export default function Assets() {
  const {
    status,
    holdings,
    holdingsLoading,
    openSetup,
    openSend,
  } = useWallet()

  const walletPresent = !!status?.exists

  // Sort: pinned first, then alphabetical by symbol.
  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const aPinned = PINNED_SYMBOLS.indexOf(a.symbol)
      const bPinned = PINNED_SYMBOLS.indexOf(b.symbol)
      if (aPinned !== -1 && bPinned !== -1) return aPinned - bPinned
      if (aPinned !== -1) return -1
      if (bPinned !== -1) return 1
      return a.symbol.localeCompare(b.symbol)
    })
  }, [holdings])

  return (
    <div>
      {/* No wallet — empty state with a Setup CTA */}
      {!walletPresent && (
        <div className="bg-white border border-brand-border rounded-md">
          <div className="flex flex-col items-center text-center py-16 gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-light border border-brand-border flex items-center justify-center text-brand-muted">
              <Wallet size={20} />
            </div>
            <p className="font-sans text-sm font-medium text-brand-navy m-0">
              Connect wallet to view tokens
            </p>
            <p className="font-sans text-xs text-brand-muted m-0 max-w-sm">
              Set up the local wallet to load your Canton token balances.
            </p>
            <button
              type="button"
              onClick={openSetup}
              className="mt-2 px-4 py-2 bg-brand-blue text-white rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase hover:opacity-90 cursor-pointer border-0"
            >
              Setup Wallet
            </button>
          </div>
        </div>
      )}

      {/* Wallet present — pending transfers hero card + holdings table */}
      {walletPresent && (
        <>
          {/* Pending transfers — incoming CC offers awaiting accept/reject.
              Rendered ABOVE the holdings table since recipients look here
              first when they expect a balance change. Styled to match the
              Dashboard's AI card (navy + halos). */}
          <PendingTransfersCard />

          <div className="bg-white border border-brand-border rounded-md overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 py-2.5 px-4 border-b border-brand-border bg-brand-light">
            <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              Asset
            </span>
            <span className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              Balance
            </span>
            <span className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              USD Value
            </span>
            <span className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              24h
            </span>
            <span className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              Action
            </span>
          </div>

          {/* Loading state */}
          {holdingsLoading && sortedHoldings.length === 0 && (
            <div className="py-12 text-center font-sans text-sm text-brand-muted">
              Loading holdings…
            </div>
          )}

          {/* Empty state */}
          {!holdingsLoading && sortedHoldings.length === 0 && (
            <div className="py-12 text-center font-sans text-sm text-brand-muted">
              No tokens yet. Use the Faucet menu item to mint test CC.
            </div>
          )}

          {/* Rows */}
          {sortedHoldings.length > 0 && (
            <ul className="divide-y divide-brand-border">
              {sortedHoldings.map((h) => (
                <AssetRow
                  key={`${h.contractId}:${h.instrumentId}`}
                  symbol={h.symbol}
                  instrumentId={h.instrumentId}
                  amount={h.amount}
                  onSend={() => openSend(h.symbol)}
                />
              ))}
            </ul>
          )}
          </div>
        </>
      )}
    </div>
  )
}

function AssetRow({
  symbol,
  instrumentId,
  amount,
  onSend,
}: {
  symbol: string
  instrumentId: string
  amount: string
  onSend: () => void
}) {
  const name = tokenName(symbol, instrumentId)
  const price = TOKEN_PRICES[symbol]
  const amountNum = parseFloat(amount)
  const usdValue =
    price && Number.isFinite(amountNum) ? amountNum * price.usd : null
  const change24h = price ? price.change24h : null

  return (
    <li className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center py-3 px-4 hover:bg-brand-light/40 transition-colors">
      {/* Asset — image/icon + name (single line) */}
      <div className="flex items-center gap-3 min-w-0">
        <TokenAvatar symbol={symbol} />
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-brand-navy m-0 truncate">
            {name}
          </p>
        </div>
      </div>

      {/* Balance — amount + symbol */}
      <div className="text-right">
        <p className="font-mono text-sm text-brand-navy m-0 whitespace-nowrap">
          {formatAmount(amount)}{' '}
          <span className="text-brand-muted">{symbol}</span>
        </p>
      </div>

      {/* USD Value — amount × hardcoded price */}
      <div className="text-right">
        {usdValue !== null ? (
          <p className="font-mono text-sm text-brand-navy m-0">
            {formatUsd(usdValue)}
          </p>
        ) : (
          <p className="font-mono text-sm text-brand-muted m-0">—</p>
        )}
      </div>

      {/* 24h change */}
      <div className="text-right">
        {change24h !== null ? (
          <span
            className={`font-mono text-sm font-medium ${
              change24h >= 0 ? 'text-brand-ok' : 'text-brand-err'
            }`}
          >
            {formatChange(change24h)}
          </span>
        ) : (
          <span className="font-mono text-sm text-brand-muted">—</span>
        )}
      </div>

      {/* Action — Send button + "More ▾" dropdown */}
      <div className="text-right">
        <ActionCell symbol={symbol} onSend={onSend} />
      </div>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/* ActionCell — Send button + MoreHorizontal dropdown (Swap / Bridge).       */
/* -------------------------------------------------------------------------- */

function ActionCell({ symbol, onSend }: { symbol: string; onSend: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 justify-end">
      <button
        type="button"
        onClick={onSend}
        title={`Send ${symbol}`}
        className="inline-flex items-center gap-1 py-1 px-2.5 bg-brand-blue text-white rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 transition-opacity"
      >
        <Send size={11} />
        Send
      </button>
      <MoreDropdown symbol={symbol} />
    </div>
  )
}

function MoreDropdown({ symbol }: { symbol: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  // Position of the portal-rendered menu, in viewport coordinates.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  // Compute the menu's anchor position from the trigger button's
  // bounding rect. Re-run on open and on scroll/resize so the menu
  // stays glued to the button while the page moves.
  const recompute = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Right-align to the trigger; sit just below it.
    setPos({
      top: r.bottom + 4, // 4px gap
      right: window.innerWidth - r.right,
    })
  }

  useEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    recompute()
    const onScroll = () => recompute()
    const onResize = () => recompute()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      // Click inside the trigger button toggles — let the onClick handle.
      if (triggerRef.current && triggerRef.current.contains(target)) return
      // Click inside the portal-rendered menu should not close.
      const menu = document.querySelector('[data-assets-more-menu]')
      if (menu && menu.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${symbol}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-6 h-6 bg-white text-brand-muted border border-brand-border rounded-md cursor-pointer hover:bg-brand-light hover:text-brand-navy transition-colors"
      >
        <ChevronDown size={12} />
      </button>

      {open && pos &&
        createPortal(
          <div
            data-assets-more-menu
            role="menu"
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className="w-44 bg-white border border-brand-border rounded-md shadow-[0_18px_50px_-12px_rgba(10,10,92,0.25)] overflow-hidden z-50"
          >
            <button
              type="button"
              role="menuitem"
              disabled
              className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-brand-light transition-colors border-0 bg-transparent cursor-not-allowed opacity-50"
            >
              <Repeat2 size={12} className="text-brand-muted" />
              <span className="font-mono text-[11px] font-bold tracking-wider2 text-brand-navy uppercase">
                Swap
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled
              className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-brand-light transition-colors border-0 bg-transparent cursor-not-allowed opacity-50"
            >
              <Workflow size={12} className="text-brand-muted" />
              <span className="font-mono text-[11px] font-bold tracking-wider2 text-brand-navy uppercase">
                Bridge
              </span>
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* TokenAvatar — override → backend → initials fallback.                     */
/* -------------------------------------------------------------------------- */

function TokenAvatar({ symbol }: { symbol: string }) {
  // 1. Hard-coded override (e.g. CC's CoinMarketCap thumbnail)
  const override = TOKEN_IMAGE_OVERRIDES[symbol]
  if (override) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={override}
        alt={`${symbol} logo`}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-brand-light border border-brand-border"
      />
    )
  }

  // 2. Initials chip fallback
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-light border border-brand-border font-mono text-[10px] font-bold text-brand-navy"
      aria-hidden="true"
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  )
}