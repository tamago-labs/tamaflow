// Assets — tokenized holdings on Canton, sourced from the wallet
// SDK's UTXO list (`sdk.token.utxos.list({ partyId })`).
//
// Canton uses a UTXO model: a party's balance is the sum of all
// the `Holding` contracts in their position. `wallet.getHoldings()`
// aggregates by instrumentId and ships one row per token here.
//
// Table columns:
//   • Asset        — image/icon + token name
//   • Balance      — amount + symbol
//   • USD Value     — pulled from PriceContext
//   • 24h          — static mock for now
//   • Action       — Send button + More ▾ dropdown (Swap / Bridge stubs)
//
// Plus a <PendingTransfersCard> above the table for incoming CC
// offers the recipient needs to accept.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWallet } from '../../context/WalletContext'
import { usePrice } from '../../context/PriceContext'
import {
  ChevronDown,
  Repeat2,
  Send,
  Wallet,
  Workflow
} from 'lucide-react'
import { TokenAvatar } from '../TokenAvatar'
import { PendingTransfersCard } from '../PendingTransfersCard'

// Pinned symbols appear at the top, in this order.
const PINNED_SYMBOLS = ['CC']

// Hard-coded 24h change per symbol. Mirrors the web frontend's
// fallback when no live price feed is wired up. `null` entries
// show "—" in the table. Replace with a real feed (CoinMarketCap /
// CoinGecko) when network access lands.
const TOKEN_CHANGE_24H: Record<string, number | null> = {
  CC: 1.42
}

// Display name override. The wallet SDK currently returns the bare
// instrument id (e.g. "Amulet") and not the human-readable name.
const TOKEN_NAME_OVERRIDES: Record<string, string> = {
  CC: 'Canton',
  Amulet: 'Canton'
}

function tokenName(symbol: string, instrumentId: string): string {
  return (
    TOKEN_NAME_OVERRIDES[symbol] ??
    TOKEN_NAME_OVERRIDES[instrumentId] ??
    instrumentId
  )
}

function formatUsd(value: number): string {
  if (value >= 100) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
  return `$${value.toFixed(3)}`
}

function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function formatAmount(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '0'
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

export function AssetsPage() {
  const {
    status,
    holdings,
    holdingsLoading,
    openSetup,
    openSend
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
      <div className="mb-6">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Assets</h1>
      </div>
      {!walletPresent && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 text-sm mt-0.5">⚠</span>
            <div>
              <span className="text-sm text-amber-800 font-medium">Wallet not set up.</span>
              <p className="text-sm text-amber-700 m-0 mt-1">
                Set up a Canton wallet to enable settlement. The wallet is generated locally and stored encrypted on this machine.
              </p>
              <button onClick={openSetup} className="mt-2 font-medium underline hover:text-amber-900 bg-transparent border-0 p-0 cursor-pointer text-sm text-amber-800">
                Set up wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {walletPresent && (
        <>
          <PendingTransfersCard />

          <div className='overflow-hidden rounded-md border border-brand-border bg-white'>
            {/* Table header */}
            <div className='grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-brand-border bg-brand-light px-4 py-2.5'>
              <span className='font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
                Asset
              </span>
              <span className='text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
                Balance
              </span>
              <span className='text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
                USD Value
              </span>
              <span className='text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
                24h
              </span>
              <span className='text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
                Action
              </span>
            </div>

            {holdingsLoading && sortedHoldings.length === 0 && (
              <div className='py-12 text-center font-sans text-sm text-brand-muted'>
                Loading holdings…
              </div>
            )}

            {!holdingsLoading && sortedHoldings.length === 0 && (
              <div className='py-12 text-center font-sans text-sm text-brand-muted'>
                No tokens yet. Use the Faucet menu item to mint test CC.
              </div>
            )}

            {sortedHoldings.length > 0 && (
              <ul className='divide-y divide-brand-border'>
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
  onSend
}: {
  symbol: string
  instrumentId: string
  amount: string
  onSend: () => void
}) {
  const name = tokenName(symbol, instrumentId)
  const { convert } = usePrice()
  const usdValue = useMemo(() => {
    const n = parseFloat(amount)
    if (!Number.isFinite(n)) return null
    const v = convert(n, 'CC', 'USD')
    return v !== null && Number.isFinite(v) ? v : null
  }, [amount, convert])
  const change24h = TOKEN_CHANGE_24H[symbol] ?? null

  return (
    <li className='grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-brand-light/40'>
      <div className='flex min-w-0 items-center gap-3'>
        <TokenAvatar symbol={symbol} />
        <div className='min-w-0'>
          <p className='m-0 truncate font-mono text-sm font-bold text-brand-navy'>
            {name}
          </p>
        </div>
      </div>

      <div className='text-right'>
        <p className='m-0 whitespace-nowrap font-mono text-sm text-brand-navy'>
          {formatAmount(amount)}{' '}
          <span className='text-brand-muted'>{symbol}</span>
        </p>
      </div>

      <div className='text-right'>
        {usdValue !== null ? (
          <p className='m-0 font-mono text-sm text-brand-navy'>{formatUsd(usdValue)}</p>
        ) : (
          <p className='m-0 font-mono text-sm text-brand-muted'>—</p>
        )}
      </div>

      <div className='text-right'>
        {change24h !== null ? (
          <span
            className={`font-mono text-sm font-medium ${
              change24h >= 0 ? 'text-brand-ok' : 'text-brand-err'
            }`}
          >
            {formatChange(change24h)}
          </span>
        ) : (
          <span className='font-mono text-sm text-brand-muted'>—</span>
        )}
      </div>

      <div className='text-right'>
        <ActionCell symbol={symbol} onSend={onSend} />
      </div>
    </li>
  )
}

function ActionCell({ symbol, onSend }: { symbol: string; onSend: () => void }) {
  return (
    <div className='inline-flex items-center justify-end gap-1.5'>
      <button
        type='button'
        onClick={onSend}
        title={`Send ${symbol}`}
        className='inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-brand-blue px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white transition-opacity hover:opacity-90'
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
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  const recompute = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      top: r.bottom + 4,
      right: window.innerWidth - r.right
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
      if (triggerRef.current && triggerRef.current.contains(target)) return
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
        type='button'
        aria-haspopup='menu'
        aria-expanded={open}
        aria-label={`More actions for ${symbol}`}
        onClick={() => setOpen((v) => !v)}
        className='inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-brand-border bg-white text-brand-muted transition-colors hover:bg-brand-light hover:text-brand-navy'
      >
        <ChevronDown size={12} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            data-assets-more-menu
            role='menu'
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className='z-50 w-44 overflow-hidden rounded-md border border-brand-border bg-white shadow-[0_18px_50px_-12px_rgba(10,10,92,0.25)]'
          >
            <button
              type='button'
              role='menuitem'
              disabled
              className='flex w-full cursor-not-allowed items-center gap-2 border-0 bg-transparent px-3 py-2 text-left opacity-50 transition-colors hover:bg-brand-light'
            >
              <Repeat2 size={12} className='text-brand-muted' />
              <span className='font-mono text-[11px] font-bold uppercase tracking-wider2 text-brand-navy'>
                Swap
              </span>
            </button>
            <button
              type='button'
              role='menuitem'
              disabled
              className='flex w-full cursor-not-allowed items-center gap-2 border-0 bg-transparent px-3 py-2 text-left opacity-50 transition-colors hover:bg-brand-light'
            >
              <Workflow size={12} className='text-brand-muted' />
              <span className='font-mono text-[11px] font-bold uppercase tracking-wider2 text-brand-navy'>
                Bridge
              </span>
            </button>
          </div>,
          document.body
        )}
    </>
  )
}

export default AssetsPage
