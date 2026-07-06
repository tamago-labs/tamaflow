import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAI } from './context/AIContext'
import { WalletProvider } from './context/WalletContext'
import { PriceProvider } from './context/PriceContext'
import ModelSelector from './pages/ModelSelector'
import LoadingScreen from './pages/LoadingScreen'
import CompanyGate from './pages/CompanyGate'
import MainLayout from './components/MainLayout'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import NewFlow from './pages/NewFlow'
import ActiveFlows from './pages/ActiveFlows'
import FlowDetail from './pages/FlowDetail'
import Settlements from './pages/Settlements'
import Assets from './pages/Assets'
import Settings from './pages/Settings'
import CompanyProfile from './pages/CompanyProfile'
import SetupWalletModal from './components/SetupWalletModal'
import AccountInfoModal from './components/AccountInfoModal'
import FaucetModal from './components/FaucetModal'
import ExportKeyModal from './components/ExportKeyModal'
import ConfirmDestroyModal from './components/ConfirmDestroyModal'
import ReceiveModal from './components/ReceiveModal'
import SendModal from './components/SendModal'
import { SPLASH_DELAY_MS } from './theme'
import { useRoom } from './hooks/useRoom'
import type { ModelEntry } from '../../preload/index.d'

type AppState = 'loading' | 'company' | 'model' | 'model-loading' | 'app'

/**
 * Boot flow:
 *   loading        (brief splash — gives the renderer time to mount
 *                  the wordmark before the picker slides in)
 *   company        employer profile gate — wizard (absent), summary
 *                  card (present), or error recovery
 *   model          user picks a model in ModelSelector
 *   model-loading  LoadingScreen tracks the in-flight load via useAI();
 *                  advances on its own when isReady
 *   app            MainLayout with router — Dashboard, Flows, etc.
 *
 * The model step is required because every page (and the AI features in
 * particular) needs a loaded model. The "Continue without loading" link
 * on the ModelSelector jumps straight to `app` with `isReady = false`
 * so the user can browse first and load later. From inside the app the
 * user can trigger the same "back to picker" via Settings > AI Model.
 */
function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const { isReady, status, refresh } = useAI()

  // Brief splash so the wordmark fades in gracefully.
  useEffect(() => {
    const t = setTimeout(
      () => setAppState((s) => (s === 'loading' ? 'company' : s)),
      SPLASH_DELAY_MS,
    )
    return () => clearTimeout(t)
  }, [])

  // Once we're in the app, refresh status so the TopBar / Settings
  // show the correct AI state.
  useEffect(() => {
    if (appState === 'app') void refresh()
  }, [appState, refresh])

  const handleCompanyContinue = () => {
    setAppState('model')
  }

  const handleModelSelect = (_entry: ModelEntry) => {
    setAppState('model-loading')
  }

  const handleLoadingComplete = () => {
    setAppState('app')
  }

  const handleModelSkip = () => {
    setAppState('app')
  }

  const handleBackToPicker = () => {
    setAppState('model')
  }

  // After the user destroys the company profile on the Company Profile
  // page, route them back to the company gate (wizard). The CompanyGate
  // auto-advances when a profile is `present`, so once they re-create /
  // import, the boot flow resumes normally.
  const handleCompanyDestroyed = () => {
    setAppState('company')
  }

  return (
    // `enabled` gates the wallet's auto-fetch of holdings + pending
    // transfers. Before `appState === 'app'`, only the cheap wallet
    // status IPC runs — the Canton SDK isn't initialised and no
    // validator round-trip is made. Once we're in the routed app,
    // polling kicks in normally.
    <PriceProvider>
    <WalletProvider enabled={appState === 'app'}>
      {appState === 'loading' && <Splash />}

      {appState === 'company' && <CompanyGate onContinue={handleCompanyContinue} />}

      {appState === 'model' && (
        <ModelSelectorGate
          isReady={isReady}
          status={status}
          onSelect={handleModelSelect}
          onSkip={handleModelSkip}
        />
      )}

      {appState === 'model-loading' && <LoadingScreen onComplete={handleLoadingComplete} />}

      {appState === 'app' && (
        <AppRouter
          onChangeModel={handleBackToPicker}
          onCompanyDestroyed={handleCompanyDestroyed}
        />
      )}

      {/* Wallet modals — rendered at the top of the tree so they're
          available from every route once we're in the app. They live
          INSIDE `<WalletProvider>` so they can read wallet state. */}
      <SetupWalletModal />
      <AccountInfoModal />
      <FaucetModal />
      <ExportKeyModal />
      <ConfirmDestroyModal />
      <ReceiveModal />
      <SendModal />
      <RoomStatusDev />
    </WalletProvider>
    </PriceProvider>
  )
}

/**
 * HashRouter wrapper. Passes App-level callbacks to MainLayout, which
 * forwards them to child routes via Outlet context. That way Settings >
 * AI Model can navigate the user back to the model picker, and
 * CompanyProfile can route the user back to the company gate after a
 * destroy — both without prop-drilling through Sidebar/TopBar.
 */
function AppRouter({
  onChangeModel,
  onCompanyDestroyed
}: {
  onChangeModel: () => void
  onCompanyDestroyed: () => void
}) {
  return (
    <HashRouter>
      <Routes>
        <Route
          element={
            <MainLayout
              onChangeModel={onChangeModel}
              onCompanyDestroyed={onCompanyDestroyed}
            />
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/flows" element={<ActiveFlows />} />
          <Route path="/flows/new" element={<NewFlow />} />
          <Route path="/flows/:id" element={<FlowDetail />} />
          <Route path="/settlements" element={<Settlements />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/company-profile" element={<CompanyProfile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

/**
 * Wraps the ModelSelector so we can auto-advance if a model is
 * already loaded in the main process (e.g. after a fast resume
 * from cache). The selector itself is just the list + add-form
 * chrome — clicking a card kicks off the load via `select()` and
 * immediately calls `onSelect(entry)` to transition to the
 * LoadingScreen.
 */
function ModelSelectorGate({
  isReady,
  status,
  onSelect,
  onSkip,
}: {
  isReady: boolean
  status: ReturnType<typeof useAI>['status']
  onSelect: (entry: ModelEntry) => void
  onSkip: () => void
}) {
  if (isReady && status?.active?.id) {
    const found = status.available.find((m) => m.id === status.active!.id)
    if (found) {
      // Defer to the next tick so the parent can paint the splash
      // first; otherwise we render a blank frame.
      queueMicrotask(() => onSelect(found))
    } else {
      queueMicrotask(() => onSkip())
    }
  }

  return (
    <div className="relative">
      <ModelSelector onComplete={onSelect} />
      {/* "Continue without loading" affordance for users who want to
          enter the app first and pick a model later. */}
      <button
        type="button"
        onClick={onSkip}
        className="fixed right-6 bottom-6 bg-transparent border-0 text-brand-muted font-mono text-[11px] tracking-wide2 uppercase cursor-pointer hover:text-brand-navy"
      >
        Continue without loading →
      </button>
    </div>
  )
}

/** Brief ~250 ms splash. Just a centered wordmark so the app
 *  doesn't appear to "flash" the white screen on first paint. */
function Splash() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="font-mono font-bold text-2xl tracking-wide m-0">
        <span className="text-brand-navy">Tama</span>
        <span className="text-brand-blue">flow</span>
      </p>
    </div>
  )
}

// Dev-only room status panel. Shows worker state + invite code.
// Only visible in development mode so it doesn't pollute production UI.
function RoomStatusDev() {
  const room = useRoom()
  if (import.meta.env.MODE === 'production') return null
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-brand-navy/90 text-white px-4 py-2 font-mono text-[11px] flex items-center gap-4 backdrop-blur">
      <span className="opacity-60">P2P:</span>
      <span>
        <span className="opacity-50">status</span>{' '}
        <span className={room.status === 'ready' ? 'text-green-400' : room.status === 'error' ? 'text-red-400' : 'text-yellow-300'}>
          {room.status}
        </span>
      </span>
      {room.role && (
        <span>
          <span className="opacity-50">role</span>{' '}
          <span className="text-brand-blue">{room.role}</span>
        </span>
      )}
      {room.peers > 0 && (
        <span>
          <span className="opacity-50">peers</span>{' '}
          <span className="text-brand-teal">{room.peers}</span>
        </span>
      )}
      {room.me && (
        <span>
          <span className="opacity-50">me</span>{' '}
          <span>{room.me.name}</span>
        </span>
      )}
      {room.invite && (
        <span className="ml-auto truncate max-w-[200px]" title={room.invite}>
          <span className="opacity-50">invite</span>{' '}
          <span className="text-brand-teal">{room.invite.slice(0, 20)}…</span>
        </span>
      )}
      {room.error && (
        <span className="text-red-400 ml-auto truncate max-w-[200px]">{room.error}</span>
      )}
    </div>
  )
}

export default App
