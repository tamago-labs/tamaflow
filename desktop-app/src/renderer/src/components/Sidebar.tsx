import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Plus,
  Wallet,
  Receipt,
  ListTodo,
  Settings as SettingsIcon,
  Building2
} from 'lucide-react'
import { WORDMARK } from '../theme'
import Logomark from './Logomark'
import { useCompany } from '../context/CompanyContext'
import { COUNTRIES } from '../lib/countries'

/**
 * Fixed 200px left navigation. Grouped into two sections:
 *   Payroll: Dashboard, Employees, Flow Builder, Active Flows
 *   Account: Assets, Settlements, Settings
 *
 * Settlements is an account-level ledger view (the record of completed
 * on-ledger payments), so it lives next to Assets rather than under
 * the operational Payroll group. The icon is a receipt — settlements
 * are receipts of completed transactions.
 *
 * Active item gets the brand-blue fill + white text. The teal 3px top
 * accent matches the my-doctor-ai reference.
 */

type IconType = typeof LayoutDashboard

interface NavItem {
  path: string
  label: string
  icon: IconType
  end?: boolean
}

interface NavCategory {
  key: string
  label: string
  items: NavItem[]
}

const navCategories: NavCategory[] = [
  {
    key: 'payroll',
    label: 'Payroll',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { path: '/employees', label: 'Employees', icon: Users },
      { path: '/flows/new', label: 'Flow Builder', icon: Plus },
      { path: '/flows', label: 'Active Flows', icon: ListTodo, end: true }
    ]
  },
  {
    key: 'account',
    label: 'Account',
    items: [
      { path: '/assets', label: 'Assets', icon: Wallet },
      { path: '/settlements', label: 'Settlements', icon: Receipt },
      { path: '/settings', label: 'Settings', icon: SettingsIcon }
    ]
  }
]

function Wordmark() {
  return (
    <div className="flex items-center gap-2 leading-none">
      <Logomark size={24} />
      <p className="font-mono font-bold text-lg tracking-wide text-brand-navy m-0 leading-none">
        <span className="text-brand-navy">{WORDMARK.prefix}</span>
        <span className="text-brand-blue">{WORDMARK.suffix}</span>
      </p>
    </div>
  )
}

export default function Sidebar() {
  const location = useLocation()
  const { profile, loadStatus } = useCompany()
  const country = profile ? COUNTRIES.find((c) => c.code === profile.country) : undefined
  const flag = country?.flag ?? null
  const displayName = profile?.companyName ?? 'Set up company…'
  const isPlaceholder = !profile || loadStatus !== 'present'

  return (
    <aside
      className="fixed top-0 left-0 w-[200px] h-screen bg-white border-r border-brand-border flex flex-col z-[100] box-border"
      style={{ padding: '24px 16px' }}
    >
      {/* Teal top accent — matches the my-doctor-ai reference */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand-teal" />

      {/* Wordmark */}
      <div className="mb-8">
        <Wordmark />
      </div>

      {/* Nav items grouped by category */}
      <nav className="flex flex-col gap-4 flex-1 overflow-y-auto">
        {navCategories.map((category) => (
          <div key={category.key}>
            <p className="font-mono text-[10px] font-semibold text-brand-muted uppercase tracking-wider2 m-0 mb-2 ml-3">
              {category.label}
            </p>
            <div className="flex flex-col gap-1">
              {category.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) => {
                      // /flows/new is a redirect route — when the user
                      // lands on the canvas at /flows/:id (e.g. /flows/abc123)
                      // the Flow Builder nav should still light up, since
                      // that's the same destination in user terms. Bare
                      // /flows stays its own entry (Active Flows).
                      const onCanvas =
                        item.path === '/flows/new' &&
                        /^\/flows\/[^/]+$/.test(location.pathname)
                      const active = isActive || onCanvas
                      return `flex items-center gap-2.5 py-2 px-3 rounded-md no-underline text-[13px] transition-colors ${
                        active
                          ? 'bg-brand-blue text-white font-medium'
                          : 'text-brand-navy font-normal hover:bg-brand-light'
                      }`
                    }}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom employer block — clickable, opens the Company Profile
          page. Surfaces the active company name + country flag so the
          user always knows which employer context they're in. When no
          profile exists yet, shows a "Set up company…" prompt. */}
      <NavLink
        to="/company-profile"
        className={({ isActive }) =>
          `block pt-3 mt-2 border-t border-brand-border px-3 py-2.5 rounded-md no-underline transition-colors ${
            isActive ? 'bg-brand-light' : 'hover:bg-brand-light'
          }`
        }
        title="Open Company Profile"
      >
        <div className="flex items-center gap-2 mb-1">
          <Building2
            size={11}
            className={`flex-shrink-0 ${isPlaceholder ? 'text-brand-muted' : 'text-brand-blue'}`}
          />
          <p className="font-mono text-[9px] text-brand-muted tracking-wider2 uppercase m-0">
            Employer Client
          </p>
        </div>
        <p
          className={`font-sans text-[13px] m-0 truncate ${
            isPlaceholder ? 'text-brand-muted italic' : 'text-brand-navy font-medium'
          }`}
        >
          {flag && <span className="mr-1">{flag}</span>}
          {displayName}
        </p>
      </NavLink>
    </aside>
  )
}
