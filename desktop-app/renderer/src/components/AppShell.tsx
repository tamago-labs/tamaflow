// AppShell — the in-app shell that wraps the sidebar + topbar + main
// content area. Mirrors the frontend's `app/app/layout.tsx` + page
// pattern but with a simple in-process router (state-based, no
// URL routing — the desktop app is a single window).
//
//   ┌────────────┬──────────────────────────────────┐
//   │  Sidebar   │  TopBar                          │
//   │            ├──────────────────────────────────┤
//   │  200px     │  Main content (the page)         │
//   │            │  • ChatPage / ShareablePage / …  │
//   │            │  • FlowBuilderPage (full-bleed)  │
//   │            ├──────────────────────────────────┤
//   │            │  Global footer (AI + worker pill)│
//   └────────────┴──────────────────────────────────┘

import { useState, type JSX } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { CanvasFooter } from './CanvasFooter'
import { ChatPage } from './pages/ChatPage'
import { ShareablePage } from './pages/ShareablePage'
import { EmployeesPage } from './pages/EmployeesPage'
import { FlowBuilderPage } from './pages/FlowBuilderPage'
import PaymentSettingsPage from './pages/PaymentSettingsPage'
import { SettlementsPage } from './pages/SettlementsPage'
import { AssetsPage } from './pages/AssetsPage'
import { SettingsPage } from './pages/SettingsPage'
import { WalletProvider } from '../context/WalletContext'
import { PriceProvider } from '../context/PriceContext'
import { SetupWalletModal } from './wallet/SetupWalletModal'
import { RestoreWalletModal } from './wallet/RestoreWalletModal'
import { AccountInfoModal } from './wallet/AccountInfoModal'
import { ExportKeyModal } from './wallet/ExportKeyModal'
import { ConfirmDestroyModal } from './wallet/ConfirmDestroyModal'
import { FaucetModal } from './wallet/FaucetModal'
import { SendModal } from './wallet/SendModal'
import type { PageId } from '../lib/nav'

// Page → component map. `null` entries (none right now) would render
// the placeholder. The FlowBuilderPage renders the real canvas.
const PAGES: Record<PageId, () => JSX.Element> = {
  chat: ChatPage,
  shareable: ShareablePage,
  employees: EmployeesPage,
  'flow-builder': FlowBuilderPage,
  'payment-settings': PaymentSettingsPage,
  settlements: SettlementsPage,
  assets: AssetsPage,
  settings: SettingsPage
}

interface AppShellProps {
  // The page to land on after the splash dismisses. Defaults to
  // 'employees' per the locked-in decision (employees is the home
  // surface, Flow Builder is one click away).
  initialPage?: PageId
}

export function AppShell({ initialPage = 'employees' }: AppShellProps) {
  const [currentPage, setCurrentPage] = useState<PageId>(initialPage)

  const Page = PAGES[currentPage]
  // FlowBuilderPage renders the existing canvas shell (toolbar +
  // canvas + right drawer + footer) full-bleed, so we strip the
  // TopBar/main padding for that page. Every other page gets the
  // standard padding around the TopBar.
  const isFlowBuilder = currentPage === 'flow-builder'

  return (
    <PriceProvider>
      <WalletProvider>
        <div className='flex h-screen min-h-screen flex-col bg-brand-light'>
          <div className='flex min-h-0 flex-1'>
            <Sidebar
              currentPage={currentPage}
              onNavigate={setCurrentPage}
            />
            <div className='ml-[200px] flex flex min-h-screen flex-1 flex-col'>
              {!isFlowBuilder && (
                <TopBar
                  currentPage={currentPage}
                  onHome={() => setCurrentPage('employees')}
                />
              )}
              <main
                className={
                  isFlowBuilder
                    ? 'flex min-h-0 flex-1 overflow-hidden w-full'
                    : 'flex-1 overflow-y-auto p-8'
                }
              >
                <Page />
              </main>
              {/* Global status footer — AI model pill (left) + worker
                 status pill (right). Lives INSIDE the `ml-[200px]`
                 offset wrapper so it lines up with the TopBar instead
                 of sliding under the sidebar. Renders on every page so
                 the employer always has a glance-able view of "is the
                 local model ready + is the P2P worker online". */}
              <CanvasFooter />
            </div>
          </div>
          {/* Canton wallet modals — mounted at the AppShell level so
             any page (TopBar chip, AccountMenu, Settings page) can
             open them via the WalletContext. The modals render null
             when their own `open` flag is false, so there's no DOM
             cost when closed. */}
          <SetupWalletModal />
          <RestoreWalletModal />
          <AccountInfoModal />
          <ExportKeyModal />
          <ConfirmDestroyModal />
          <FaucetModal />
          <SendModal />
        </div>
      </WalletProvider>
    </PriceProvider>
  )
}

export default AppShell
