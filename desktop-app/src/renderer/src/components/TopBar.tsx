import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAI } from '../context/AIContext'
import { useWallet } from '../context/WalletContext'
import AccountMenu from './AccountMenu'
import { ChevronRight, ChevronDown, ArrowLeft } from 'lucide-react'

/**
 * Sticky 56px top bar:
 *   Left  — breadcrumb (mono, brand-muted) derived from the matched route.
 *   Right — AI status dot + Wallet chip / Setup button.
 *
 * The breadcrumb is computed from a static route→label map so we don't
 * need a router config to introspect. Dynamic segments (e.g. /flows/:id)
 * are left as "·" for now — the placeholder pages don't generate them.
 */

interface Crumb {
  path: string
  label: string
}

const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  employees: 'Employees',
  flows: 'Active Flows',
  new: 'New Flow',
  settlements: 'Settlements',
  assets: 'Assets',
  settings: 'Settings',
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return [{ path: '/', label: 'Dashboard' }]
  const crumbs: Crumb[] = [{ path: '/', label: 'Dashboard' }]
  let acc = ''
  for (const seg of segments) {
    acc += `/${seg}`
    // /flows/new should be a single "New Flow" crumb, not "Active Flows / New Flow"
    if (acc === '/flows/new') {
      crumbs.push({ path: acc, label: 'New Flow' })
      continue
    }
    crumbs.push({ path: acc, label: routeLabels[seg] ?? seg })
  }
  return crumbs
}

function truncateParty(partyId: string | undefined): string {
  if (!partyId) return '…'
  // Canton party format: `hint::fingerprint` — keep the hint + first 4
  // chars of the fingerprint after `::`. e.g. `tamaflow::1220…abcd`.
  const sep = '::'
  const i = partyId.indexOf(sep)
  if (i < 0) {
    return partyId.length <= 10 ? partyId : `…${partyId.slice(-4)}`
  }
  const hint = partyId.slice(0, i)
  const fingerprint = partyId.slice(i + sep.length)
  return `${hint}::${fingerprint.slice(0, 4)}…${fingerprint.slice(-4)}`
}

export default function TopBar({ onChangeModel }: { onChangeModel: () => void }) {
  const { isReady } = useAI()
  const { status, openSetup } = useWallet()
  const location = useLocation()
  const crumbs = buildCrumbs(location.pathname)

  const [menuOpen, setMenuOpen] = useState(false)
  const chipRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click — the AccountMenu itself also handles
  // this but doing it here too prevents the chip's own click from
  // re-toggling the menu open after close.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (
        chipRef.current &&
        !chipRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const walletPresent = !!status?.exists

  return (
    <header className="sticky top-0 z-50 h-14 bg-white border-b border-brand-border flex items-center justify-between px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <span key={c.path} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <ChevronRight size={12} className="text-brand-muted flex-shrink-0" />
              )}
              <span
                className={`font-mono text-[11px] tracking-wider2 uppercase whitespace-nowrap ${
                  isLast ? 'text-brand-navy font-medium' : 'text-brand-muted'
                }`}
              >
                {c.label}
              </span>
            </span>
          )
        })}
      </nav>

      {/* Right-side actions */}
      <div className="flex items-center gap-3">
        {/* "Back to AI Selection" — replaces the old passive AI status
            dot. Still shows the readiness state via the dot color, but
            is now actionable: clicking returns the user to the model
            picker. Sits to the left of the wallet chip. */}
        <button
          type="button"
          onClick={onChangeModel}
          title={isReady ? 'AI ready — change model' : 'No model loaded'}
          className="flex items-center gap-1.5 py-1.5 px-3 border border-brand-blue text-brand-blue bg-white rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
        > 
          <ArrowLeft size={11} />
          Back to AI Selection
        </button>

        {/* Wallet: chip (with dropdown) when set up, Setup button otherwise */}
        {!walletPresent && (
          <button
            type="button"
            onClick={openSetup}
            className="flex items-center gap-1.5 py-1.5 px-3 border border-brand-blue text-brand-blue bg-white rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
          > 
            Setup Wallet
          </button>
        )}

        {walletPresent && (
          <div ref={chipRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-1.5 py-1.5 px-3 border border-brand-blue text-brand-blue bg-white rounded-md font-mono text-[10px] font-bold tracking-wider2 cursor-pointer hover:bg-brand-light"
            >
              <span className="font-mono text-[10px] tracking-wide">
                {truncateParty(status?.partyId)}
              </span>
              <ChevronDown size={11} />
            </button>
            <AccountMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
          </div>
        )}
      </div>
    </header>
  )
}
