// Sticky 56px top bar for the in-app shell.
//
//   Left  — App › <Page label> breadcrumb
//   Right — Wallet switcher + Network badge + Chat button

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, MessageCircle } from 'lucide-react'
import { PAGE_LABELS, type PageId } from '../lib/nav'
import { useWallet, type WalletMode } from '../context/WalletContext'
import { NetworkBadge } from './wallet/NetworkBadge'

interface TopBarProps {
  currentPage: PageId
  onHome: () => void
  onChatToggle: () => void
}

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

export function TopBar({ currentPage, onHome, onChatToggle }: TopBarProps) {
  const { mode, setMode, status, loopAvailable, cliAvailable } = useWallet()
  const label = PAGE_LABELS[currentPage]

  const [menuOpen, setMenuOpen] = useState(false)
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const chipRef = useRef<HTMLDivElement>(null)
  const walletRef = useRef<HTMLDivElement>(null)

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpen && !walletMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen, walletMenuOpen])

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

      {/* Right-side actions */}
      <div className='flex items-center gap-3'>
        {/* Chat button */}
        <button
          type='button'
          onClick={onChatToggle}
          className='flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors'
          title='Chat'
        >
          <MessageCircle size={14} />
        </button>

        {/* Network badge */}
        {walletPresent && <NetworkBadge />}

        {/* Wallet switcher */}
        <div ref={walletRef} className='relative'>
          <button
            type='button'
            onClick={() => setWalletMenuOpen((v) => !v)}
            aria-haspopup='menu'
            aria-expanded={walletMenuOpen}
            className='flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-blue bg-white px-3 py-1.5 text-xs font-semibold text-brand-blue hover:bg-brand-light'
          >
            <span>{mode === 'loop' ? 'Loop' : 'CLI'}</span>
            <ChevronDown size={11} />
          </button>

          {walletMenuOpen && (
            <div className='absolute right-0 top-full mt-1 z-50 w-48 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg'>
              <div className='p-2'>
                <p className='mb-2 font-mono text-[10px] uppercase tracking-wider2 text-gray-400'>Wallet Type</p>
                <label className='flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 cursor-pointer'>
                  <input
                    type='radio'
                    name='walletMode'
                    checked={mode === 'loop'}
                    onChange={() => setMode('loop')}
                    disabled={!loopAvailable}
                    className='accent-blue-600'
                  />
                  <span className='text-sm text-gray-700'>Loop Wallet</span>
                  {!loopAvailable && <span className='text-[10px] text-gray-400'>(unavailable)</span>}
                </label>
                <label className='flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 cursor-pointer'>
                  <input
                    type='radio'
                    name='walletMode'
                    checked={mode === 'cli'}
                    onChange={() => setMode('cli')}
                    disabled={!cliAvailable}
                    className='accent-blue-600'
                  />
                  <span className='text-sm text-gray-700'>CLI Wallet</span>
                  {!cliAvailable && <span className='text-[10px] text-gray-400'>(offline)</span>}
                </label>
              </div>

              {walletPresent && (
                <div className='border-t border-gray-200 px-3 py-2'>
                  <p className='font-mono text-[10px] text-gray-400'>{truncateParty(status?.partyId)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default TopBar
