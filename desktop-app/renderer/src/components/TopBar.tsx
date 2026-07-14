// Sticky 56px top bar for the in-app shell.
//
//   Left  — App › <Page label> breadcrumb (App click → employees)
//   Right — Network badge + Wallet chip / Setup button
//
// The breadcrumb is in the default sans (DM Sans) per the Tamaflow
// rebrand — the old version's mono labels read as
// product-decoration noise next to the in-app shell. The wallet
// chip + network badge use the same sans treatment so the right
// side of the bar pairs visually with the rest of the UI.

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { PAGE_LABELS, type PageId } from '../lib/nav'
import { useWallet } from '../context/WalletContext'
import { NetworkBadge } from './wallet/NetworkBadge'
import { AccountMenu } from './wallet/AccountMenu'

interface TopBarProps {
  currentPage: PageId
  onHome: () => void
}

/** Canton party format: `hint::fingerprint` — keep the hint + first
 *  4 + last 4 chars of the fingerprint. e.g. `tamaflow::1220…abcd`. */
function truncateParty(partyId: string | undefined): string {
  if (!partyId) return '…'
  const sep = '::'
  const i = partyId.indexOf(sep)
  if (i < 0) {
    return partyId.length <= 10 ? partyId : `…${partyId.slice(-4)}`
  }
  const hint = partyId.slice(0, i)
  const fingerprint = partyId.slice(i + sep.length)
  return `${hint}::${fingerprint.slice(0, 4)}…${fingerprint.slice(-4)}`
}

export function TopBar({ currentPage, onHome }: TopBarProps) {
  const { status, openSetup } = useWallet()
  const label = PAGE_LABELS[currentPage]

  const [menuOpen, setMenuOpen] = useState(false)
  const chipRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const walletPresent = !!status?.exists

  return (
    <header className='sticky top-0 z-50 flex h-14 items-center justify-between border-b border-brand-border bg-white px-8'>
      {/* Breadcrumb */}
      <nav aria-label='Breadcrumb' className='flex min-w-0 items-center gap-1.5'>
        <ol className='flex min-w-0 items-center gap-1.5'>
          <li className='flex min-w-0 items-center gap-1.5'>
            <button
              type='button'
              onClick={onHome}
              className='whitespace-nowrap text-xs font-medium uppercase tracking-wider2 text-brand-muted hover:text-brand-blue transition-colors'
            >
              App
            </button>
          </li>
          <li className='flex min-w-0 items-center gap-1.5'>
            <ChevronRight size={12} className='flex-shrink-0 text-brand-muted' aria-hidden />
            <span
              aria-current='page'
              className='whitespace-nowrap text-xs font-medium uppercase tracking-wider2 text-brand-navy'
            >
              {label}
            </span>
          </li>
        </ol>
      </nav>

      {/* Right-side actions — just Network badge + Wallet chip. The
         old version's topbar matches this exact surface; the peer
         count + writer-key prefix that lived here in an earlier
         pass were noise (looked like fake data when the room was
         empty), so they're gone. */}
      <div className='flex items-center gap-3'>
        {/* Network badge — only shown once the wallet is ready */}
        {walletPresent && <NetworkBadge />}

        {/* Wallet: chip (with dropdown) when set up, Setup button otherwise */}
        {!walletPresent && (
          <button
            type='button'
            onClick={openSetup}
            className='flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-blue bg-white px-3 py-1.5 text-xs font-semibold text-brand-blue hover:bg-brand-light'
          >
            Setup Wallet
          </button>
        )}

        {walletPresent && (
          <div ref={chipRef} className='relative'>
            <button
              type='button'
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup='menu'
              aria-expanded={menuOpen}
              className='flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-blue bg-white px-3 py-1.5 text-xs font-semibold text-brand-blue hover:bg-brand-light'
            >
              <span>{truncateParty(status?.partyId)}</span>
              <ChevronDown size={11} />
            </button>
            <AccountMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
          </div>
        )}
      </div>
    </header>
  )
}

export default TopBar
