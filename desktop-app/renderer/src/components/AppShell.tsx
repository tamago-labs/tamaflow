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
import { MessageCircle } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { CanvasFooter } from './CanvasFooter'
import { TeamChatDrawer } from './dashboard/TeamChatDrawer'
import { AIModalProvider, useAIModal } from '../context/AIModalContext'
import { AIModelModal } from './AIModelModal'
import { DashboardPage } from './pages/DashboardPage'
import { AttendancePage } from './pages/AttendancePage'
import { ChatPage } from './pages/ChatPage'
import PayslipManager from './payslips/PayslipManager'
import { EmployeesPage } from './pages/EmployeesPage'
import { FlowBuilderPage } from './pages/FlowBuilderPage'
import PaymentSettingsPage from './pages/PaymentSettingsPage'
import SettlementsPage from './pages/SettlementsPage'
import { AssetsPage } from './pages/AssetsPage'
import { SettingsPage } from './pages/SettingsPage'
import { WalletProvider } from '../context/WalletContext'
import { PriceProvider } from '../context/PriceContext'
import { ContractsProvider } from '../context/ContractsContext'
import { FlowViewProvider, useFlowView } from '../context/FlowViewContext'
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
const PAGES: Record<PageId, any> = {
  dashboard: DashboardPage,
  attendance: AttendancePage,
  chat: ChatPage,
  payslips: PayslipManager,
  employees: EmployeesPage,
  'flow-builder': FlowBuilderPage,
  'payment-settings': PaymentSettingsPage,
  settlements: SettlementsPage,
  assets: AssetsPage,
  settings: SettingsPage
}

interface AppShellProps {
  initialPage?: PageId
  roomRole?: any
  invite?: string | null
  me?: { name: string } | null
}

export function AppShell({ initialPage = 'dashboard', roomRole, invite, me }: AppShellProps) {
  const [currentPage, setCurrentPage] = useState<PageId>(initialPage)

  return (
    <AIModalProvider>
      <FlowViewProvider>
        <AppShellInner currentPage={currentPage} setCurrentPage={setCurrentPage} roomRole={roomRole} invite={invite} me={me} />
      </FlowViewProvider>
    </AIModalProvider>
  )
}

function AppShellInner({ currentPage, setCurrentPage, roomRole, invite, me }: { currentPage: PageId; setCurrentPage: (p: PageId) => void; roomRole: any; invite: any; me: any }) {
  const { view } = useFlowView()
  const { aiModalOpen, closeAIModel } = useAIModal()
  const Page = PAGES[currentPage]
  const isFlowBuilder = currentPage === 'flow-builder'
  const isFullView = currentPage === 'payslips'
  const isCanvasView = isFlowBuilder && view === 'canvas'
  const [teamChatOpen, setTeamChatOpen] = useState(false)

  return (
    <PriceProvider>
      <WalletProvider>
        <ContractsProvider>
          <div className='flex h-screen min-h-screen flex-col bg-brand-light'>
            <div className='flex min-h-0 flex-1'>
              <Sidebar
                currentPage={currentPage}
                onNavigate={setCurrentPage}
              />
              <div className='ml-[200px] flex flex min-h-screen flex-1 flex-col'>
                {!isCanvasView && (
                  <TopBar
                    currentPage={currentPage}
                    onHome={() => setCurrentPage('employees')}
                  />
                )}
                <main
                  className={
                    (isCanvasView || isFullView)
                      ? 'flex min-h-0 flex-1 overflow-hidden w-full'
                      : 'flex-1 overflow-y-auto p-8'
                  }
                >
                  {currentPage === 'dashboard' ? (
                    <DashboardPage roomRole={roomRole} invite={invite} me={me} onNavigate={setCurrentPage} />
                  ) : currentPage === 'assets' ? (
                    <AssetsPage/>
                  ) : (
                    <Page />
                  )}
                </main>
                <CanvasFooter />
              </div>
            </div>

            {/* Floating team chat button — hidden in full-canvas view */}
            {(!isCanvasView&&!isFullView) && (
              <button
                type="button"
                onClick={() => setTeamChatOpen(!teamChatOpen)}
                className="fixed right-6 bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue text-white shadow-lg hover:bg-blue-700 transition-colors cursor-pointer"
                title="Team Chat"
              >
                <MessageCircle size={20} />
              </button>
            )}

            <TeamChatDrawer open={teamChatOpen} onClose={() => setTeamChatOpen(false)} />

            <SetupWalletModal />
            <RestoreWalletModal />
            <AccountInfoModal />
            <ExportKeyModal />
            <ConfirmDestroyModal />
            <FaucetModal />
            <SendModal />
            <AIModelModal open={aiModalOpen} onClose={closeAIModel} />
          </div>
        </ContractsProvider>
      </WalletProvider>
    </PriceProvider>
  )
}

export default AppShell
