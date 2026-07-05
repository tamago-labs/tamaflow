// Sticky top bar for the in-app shell. Mirrors the frontend's
// `frontend/components/app/TopBar.tsx` pattern but simplified to a
// single breadcrumb (the desktop has no nested routes — the sidebar
// is the only navigation surface).
//
//   Left  — breadcrumb: App › <Current page label>
//   Right — room status pill (peers + writer key)
//
// The breadcrumb's first crumb is the wordmark (clicking it goes
// back to the splash via the in-app shell's "back" action — wired
// in AppShell). The second crumb is the active page.

import { ChevronRight } from 'lucide-react'
import { PAGE_LABELS, type PageId } from '../lib/nav'
import { useRoom } from '../hooks/useRoom'

interface TopBarProps {
  currentPage: PageId
  onHome: () => void
}

export function TopBar({ currentPage, onHome }: TopBarProps) {
  const room = useRoom()
  const label = PAGE_LABELS[currentPage]
  const writerKeyPrefix = room.me?.key?.slice(0, 8) ?? null
  const peerCount = room.peers
  return (
    <header className='sticky top-0 z-40 flex h-14 items-center justify-between border-b border-brand-border bg-white px-8'>
      {/* Breadcrumb */}
      <nav
        aria-label='Breadcrumb'
        className='flex min-w-0 flex-1 items-center gap-1.5'
      >
        <ol className='flex min-w-0 items-center gap-1.5'>
          <li className='flex min-w-0 items-center gap-1.5'>
            <button
              type='button'
              onClick={onHome}
              className='font-mono text-[11px] font-medium uppercase tracking-wider2 text-brand-muted whitespace-nowrap hover:text-brand-blue transition-colors'
            >
              App
            </button>
          </li>
          <li className='flex min-w-0 items-center gap-1.5'>
            <ChevronRight
              size={12}
              className='flex-shrink-0 text-brand-muted'
              aria-hidden
            />
            <span
              aria-current='page'
              className='font-mono text-[11px] font-medium uppercase tracking-wider2 whitespace-nowrap text-brand-navy'
            >
              {label}
            </span>
          </li>
        </ol>
      </nav>

      {/* Right-side: peer count + writer key (z32 prefix) — gives the
         employer a quick P2P status glance without opening a tab. */}
      <div className='flex items-center gap-4'>
        <div className='flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
          <span className='relative inline-flex h-1.5 w-1.5'>
            <span
              className={`absolute inset-0 rounded-full ${
                peerCount > 0 ? 'bg-brand-ok animate-ping opacity-60' : 'bg-brand-muted'
              }`}
            />
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                peerCount > 0 ? 'bg-brand-ok' : 'bg-brand-muted'
              }`}
            />
          </span>
          {peerCount === 0 ? 'No peers' : `${peerCount} peer${peerCount > 1 ? 's' : ''}`}
        </div>
        {writerKeyPrefix && (
          <code
            title={room.me?.key ?? ''}
            className='rounded border border-brand-border bg-brand-light px-2 py-0.5 font-mono text-[10px] text-brand-navy'
          >
            {writerKeyPrefix}…
          </code>
        )}
      </div>
    </header>
  )
}

export default TopBar
