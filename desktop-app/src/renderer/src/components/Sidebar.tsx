import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Plus,
  Wallet,
  Coins,
  ListTodo,
  Settings as SettingsIcon,
} from 'lucide-react'
import { WORDMARK, APP_VERSION } from '../theme'
import Logomark from './Logomark'

/**
 * Fixed 200px left navigation. Grouped into two sections:
 *   Payroll: Dashboard, Employees, New Flow, Active Flows, Settlements
 *   Account: Assets, Settings
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
      { path: '/flows', label: 'Active Flows', icon: ListTodo, end: true },
      { path: '/settlements', label: 'Settlements', icon: Coins },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    items: [
      { path: '/assets', label: 'Assets', icon: Wallet },
      { path: '/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
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
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 py-2 px-3 rounded-md no-underline text-[13px] transition-colors ${
                        isActive
                          ? 'bg-brand-blue text-white font-medium'
                          : 'text-brand-navy font-normal hover:bg-brand-light'
                      }`
                    }
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

      {/* Bottom footer — makes it obvious this is the Employer (HR /
       payroll-runner) client, plus the app version (kept in sync with
       package.json via APP_VERSION in theme.ts). */}
      <div className="pt-4 mt-2 border-t border-brand-border">
        <p className="font-mono text-[9px] text-brand-muted tracking-wider2 uppercase m-0">
          Employer Client · v{APP_VERSION}
        </p>
      </div>
    </aside>
  )
}
