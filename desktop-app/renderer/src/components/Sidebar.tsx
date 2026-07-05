// Fixed 200px left navigation for the in-app shell.
//
//   top section       — wordmark
//   middle sections   — one per NAV_CATEGORIES entry (Teamspace /
//                       Payroll). Each section is a small uppercase
//                       mono label + a stack of nav buttons.
//   bottom section    — Settings utility button (single, full-width).
//                       Sits below the categories, separated by a top
//                       border. Same visual treatment as the old
//                       frontend sidebar's "Download" button.
//
// Active link = brand-blue fill + white text; hover = brand-light.
// Click handling lives in the parent AppShell — the sidebar is
// presentational.

import { Logomark } from './Logomark'
import { Settings as SettingsIcon } from 'lucide-react'
import { NAV_CATEGORIES, type PageId } from '../lib/nav'

interface SidebarProps {
  currentPage: PageId
  onNavigate: (page: PageId) => void
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const isSettings = currentPage === 'settings'

  return (
    <aside
      className='fixed top-0 left-0 z-50 box-border flex h-screen w-[200px] flex-col border-r border-brand-border bg-white'
      style={{ padding: '24px 16px' }}
    >
      {/* Wordmark — sits in-app shell, no link (you can't "go home" from
         the in-app shell, only back to the splash on quit). The mark
         is a click-target for the brand "you are here" affordance. */}
      <div className='mb-8 flex items-center gap-2.5'>
        <Logomark size={28} />
        <span
          className='font-mono text-lg font-bold tracking-wide'
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <span className='text-brand-navy'>Tama</span>
          <span className='text-brand-blue'>flow</span>
        </span>
      </div>

      {/* Nav items — one section per NAV_CATEGORIES entry. Settings
         is pulled out as a bottom utility button (see below) so it
         doesn't pollute the Payroll category. */}
      <nav className='flex flex-1 flex-col gap-5 overflow-y-auto'>
        {NAV_CATEGORIES.map((category) => (
          <div key={category.key}>
            <p className='mb-2 ml-3 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              {category.label}
            </p>
            <div className='flex flex-col gap-1'>
              {category.items.map((item) => {
                const Icon = item.icon
                const isActive = currentPage === item.id
                return (
                  <button
                    key={item.id}
                    type='button'
                    onClick={() => onNavigate(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                      isActive
                        ? 'bg-brand-blue font-medium text-white'
                        : 'font-normal text-brand-navy hover:bg-brand-light'
                    }`}
                  >
                    <Icon size={16} className='flex-shrink-0' />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom utility — Settings. Sits below the categories, separated
         by a thin border, full-width single button. Mirrors the old
         frontend sidebar's "Download" affordance. */}
      <div className='mt-2 border-t border-brand-border pt-4'>
        <button
          type='button'
          onClick={() => onNavigate('settings')}
          aria-current={isSettings ? 'page' : undefined}
          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
            isSettings
              ? 'bg-brand-blue font-medium text-white'
              : 'font-normal text-brand-navy hover:bg-brand-light'
          }`}
        >
          <SettingsIcon size={16} className='flex-shrink-0' />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
