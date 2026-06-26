import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAI } from './context/AIContext'
import ModelSelector from './pages/ModelSelector'
import LoadingScreen from './pages/LoadingScreen'
import MainLayout from './components/MainLayout'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import NewFlow from './pages/NewFlow'
import ActiveFlows from './pages/ActiveFlows'
import Settlements from './pages/Settlements'
import Assets from './pages/Assets'
import Settings from './pages/Settings'
import SetupWalletModal from './components/SetupWalletModal'
import AccountInfoModal from './components/AccountInfoModal'
import FaucetModal from './components/FaucetModal'
import ExportKeyModal from './components/ExportKeyModal'
import ConfirmDestroyModal from './components/ConfirmDestroyModal'
import { SPLASH_DELAY_MS } from './theme'
import type { ModelEntry } from '../../preload/index.d'

type AppState = 'loading' | 'model' | 'model-loading' | 'app'

/**
 * Boot flow:
 *   loading        (brief splash — gives the renderer time to mount
 *                  the wordmark before the picker slides in)
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
    const t = setTimeout(() => setAppState((s) => (s === 'loading' ? 'model' : s)), SPLASH_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  // Once we're in the app, refresh status so the TopBar / Settings
  // show the correct AI state.
  useEffect(() => {
    if (appState === 'app') void refresh()
  }, [appState, refresh])

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

  return (
    <>
      {appState === 'loading' && <Splash />}

      {appState === 'model' && (
        <ModelSelectorGate
          isReady={isReady}
          status={status}
          onSelect={handleModelSelect}
          onSkip={handleModelSkip}
        />
      )}

      {appState === 'model-loading' && <LoadingScreen onComplete={handleLoadingComplete} />}

      {appState === 'app' && <AppRouter onChangeModel={handleBackToPicker} />}

      {/* Wallet modals — rendered at the top of the tree so they're
          available from every route once we're in the app. */}
      <SetupWalletModal />
      <AccountInfoModal />
      <FaucetModal />
      <ExportKeyModal />
      <ConfirmDestroyModal />
    </>
  )
}

/**
 * HashRouter wrapper. Passes `onChangeModel` to MainLayout, which
 * forwards it to child routes via Outlet context. That way Settings >
 * AI Model can navigate the user back to the model picker without
 * prop-drilling through Sidebar/TopBar.
 */
function AppRouter({ onChangeModel }: { onChangeModel: () => void }) {
  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout onChangeModel={onChangeModel} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/flows" element={<ActiveFlows />} />
          <Route path="/flows/new" element={<NewFlow />} />
          <Route path="/settlements" element={<Settlements />} />
          <Route path="/assets" element={<Assets />} />
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

export default App
