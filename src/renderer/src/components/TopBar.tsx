import { useLocation } from 'react-router-dom'
import { useAI } from '../context/AIContext'
import { ChevronRight, Wallet } from 'lucide-react'

/**
 * Sticky 56px top bar:
 *   Left  — breadcrumb (mono, brand-muted) derived from the matched route.
 *   Right — Connect Wallet button + AI status dot.
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
  inbox: 'Inbox',
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

export default function TopBar() {
  const { isReady } = useAI()
  const location = useLocation()
  const crumbs = buildCrumbs(location.pathname)

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
        {/* AI status dot — mirrors the old Ready card state */}
        <span className="flex items-center gap-1.5" title={isReady ? 'AI ready' : 'No model loaded'}>
          <span
            className="w-[7px] h-[7px] rounded-full flex-shrink-0"
            style={{ background: isReady ? '#3EC4C0' : '#9999bb' }}
          />
          <span className="font-mono text-[9px] text-brand-muted uppercase tracking-wider2">
            {isReady ? 'AI' : 'No AI'}
          </span>
        </span>

        {/* Connect Wallet button — placeholder, no real wallet logic yet */}
        <button
          type="button"
          className="flex items-center gap-1.5 py-1.5 px-3 border border-brand-blue text-brand-blue bg-white rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
        >
          <Wallet size={12} />
          Connect Wallet
        </button>
      </div>
    </header>
  )
}
