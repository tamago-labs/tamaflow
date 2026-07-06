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
import ChatPage from './pages/ChatPage'
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
import type { RoomRole } from './hooks/useRoom'

type AppState = 'loading' | 'splash' | 'company' | 'model' | 'model-loading' | 'app'

/**
 * Boot flow:
 *   loading   → brief splash (wordmark)
 *   splash    → P2P room setup: host gets invite code, guest auto-joins
 *   company   → employer profile gate
 *   model     → model selector
 *   model-loading → tracks load, auto-advances
 *   app       → main app
 */
function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const { isReady, status, refresh } = useAI()

  // Brief splash so the wordmark fades in gracefully.
  useEffect(() => {
    const t = setTimeout(
      () => setAppState((s) => (s === 'loading' ? 'splash' : s)),
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

  const handleCompanyDestroyed = () => {
    setAppState('company')
  }

  return (
    <PriceProvider>
    <WalletProvider enabled={appState === 'app'}>
      {appState === 'loading' && <Splash />}

      {appState === 'splash' && (
        <P2PSplashGate onReady={() => setAppState('company')} />
      )}

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

      {/* Wallet modals */}
      <SetupWalletModal />
      <AccountInfoModal />
      <FaucetModal />
      <ExportKeyModal />
      <ConfirmDestroyModal />
      <ReceiveModal />
      <SendModal />
    </WalletProvider>
    </PriceProvider>
  )
}

// ─── P2P Splash Gate ─────────────────────────────────────────────────
// Renders the SplashPage. Auto-transitions to company when the room is
// ready (guest) or when the host dismisses.

function P2PSplashGate({ onReady }: { onReady: () => void }) {
  const room = useRoom()
  const [hostDismissed, setHostDismissed] = useState(false)

  // Auto-transition once the room is writable. In a host scenario
  // the user may want to copy the invite code from the splash first,
  // so we expose a manual "Open workspace" affordance in SplashPage
  // via the `hostDismissed` flag instead of forcing a timer.
  useEffect(() => {
    if (room.status !== 'ready') return
    if (room.role === 'host' && !hostDismissed) return
    onReady()
  }, [room.status, room.role, hostDismissed, onReady])

  return (
    <SplashPage
      role={room.role as RoomRole | null}
      invite={room.invite}
      writable={room.writable}
      me={room.me}
      error={room.error}
      onOpenCanvas={() => setHostDismissed(true)}
      onJoinInvite={room.joinInvite}
      onRenameSelf={room.renameSelf}
    />
  )
}

// ─── SplashPage (ported from v2) ─────────────────────────────────────

function SplashPage({
  role,
  invite,
  writable,
  error,
  me,
  onOpenCanvas,
  onJoinInvite,
  onRenameSelf,
}: {
  role: RoomRole | null
  invite: string | null
  writable: boolean
  me: { key: string; name: string } | null
  error: string | null
  onOpenCanvas: () => void
  onJoinInvite: (invite: string) => void
  onRenameSelf: (name: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showNameEdit, setShowNameEdit] = useState(false)

  function handleCopy() {
    if (!invite) return
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(invite)
        .then(() => setCopied(true))
        .catch(() => {})
    }
  }

  const ready = role !== null && writable
  const isJoining = !ready && showJoin && role === null

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-white"
      style={{ background: 'linear-gradient(135deg, #0a0a5c 0%, #0a0a5c 50%, #1A1AE8 100%)' }}
    >
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(62, 196, 192, 0.28) 0%, rgba(62, 196, 192, 0) 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-32 h-[480px] w-[480px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(26, 26, 232, 0.25) 0%, rgba(26, 26, 232, 0) 70%)' }}
      />

      {/* Wordmark */}
      <div className="relative flex items-center gap-3">
        <span
          className="text-5xl font-extrabold tracking-tight"
          style={{ fontFamily: 'var(--font-sans, sans-serif)' }}
        >
          <span className="text-white">Tama</span>
          <span className="text-brand-blue">flow</span>
        </span>
      </div>

      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-brand-teal/90">
        Private Settlement • Local AI • P2P Sync
      </p>

      {/* Signed in as */}
      {me && (
        <button
          type="button"
          onClick={() => setShowNameEdit(true)}
          className="mt-8 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 backdrop-blur transition hover:bg-white/10"
        >
          <span className="text-white/60">Signed in as</span>
          <span className="font-semibold text-white">{me.name}</span>
        </button>
      )}

      {!ready && (
        <div className="mt-6 flex items-center gap-3 text-sm text-white/80">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
          <span>
            {error
              ? `Failed to start TamaFlow: ${error}`
              : isJoining
                ? 'Joining with invite…'
                : role === null
                  ? 'Preparing teamspace…'
                  : 'Starting TamaFlow…'}
          </span>
        </div>
      )}

      {ready && (
        <div className="mt-8 flex flex-col items-center gap-4 px-6 text-center">
          {role === 'host' && invite ? (
            <>
              <p className="text-sm text-white/80">
                Send this code to a co-worker to bring them in
              </p>
              <div className="flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                <code
                  className="max-w-xs truncate font-mono text-xs text-white"
                  title={invite}
                >
                  {invite}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-white/80 transition hover:bg-white/10"
                >
                  {copied ? (
                    <span className="text-brand-teal">✓</span>
                  ) : (
                    <span className="text-[10px]">copy</span>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={onOpenCanvas}
                className="mt-2 inline-flex h-9 items-center rounded-md bg-white px-5 text-sm font-semibold text-brand-navy transition hover:bg-white/90"
              >
                Open teamspace
              </button>
            </>
          ) : (
            <p className="text-sm text-white/80">
              Joined. Loading teamspace…
            </p>
          )}
        </div>
      )}

      {ready && (
        <button
          type="button"
          onClick={() => setShowJoin(true)}
          className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/10"
        >
          Join existing teamspace
        </button>
      )}

      {/* Join modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-brand-border bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-brand-navy">Join existing board</h2>
            <p className="mt-2 text-sm text-brand-muted">
              Paste the invite code shared by your co-worker to join their teamspace.
            </p>
            <input
              autoFocus
              type="text"
              placeholder="e.g. yrya…"
              className="mt-4 h-9 w-full rounded border border-brand-border bg-white px-3 font-mono text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-teal/60"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val) {
                    onJoinInvite(val)
                  }
                }
              }}
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowJoin(false)}
                className="inline-flex h-9 items-center rounded-md border border-brand-border bg-white px-4 text-sm font-medium text-brand-navy transition hover:bg-brand-light"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>('[placeholder="e.g. yrya…"]')
                  const val = input?.value.trim()
                  if (val) {
                    onJoinInvite(val)
                  }
                }}
                disabled={isJoining}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-blue px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {isJoining ? 'Joining…' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Name edit modal */}
      {showNameEdit && me && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-brand-border bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-brand-navy">Change display name</h2>
            <p className="mt-2 text-sm text-brand-muted">
              Your display name for the teamspace.
            </p>
            <input
              autoFocus
              type="text"
              defaultValue={me.name}
              maxLength={32}
              className="mt-4 h-9 w-full rounded border border-brand-border bg-white px-3 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-teal/60"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val && val !== me.name) {
                    onRenameSelf(val)
                    setShowNameEdit(false)
                  }
                }
              }}
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNameEdit(false)}
                className="inline-flex h-9 items-center rounded-md border border-brand-border bg-white px-4 text-sm font-medium text-brand-navy transition hover:bg-brand-light"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>('[maxLength="32"]')
                  const val = input?.value.trim()
                  if (val && val !== me.name) {
                    onRenameSelf(val)
                    setShowNameEdit(false)
                  }
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-blue px-4 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── HashRouter wrapper ──────────────────────────────────────────────

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
          <Route path="/chat" element={<ChatPage />} />
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

// ─── Model selector gate ─────────────────────────────────────────────

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
      queueMicrotask(() => onSelect(found))
    } else {
      queueMicrotask(() => onSkip())
    }
  }

  return (
    <div className="relative">
      <ModelSelector onComplete={onSelect} />
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

// ─── Brief splash ────────────────────────────────────────────────────

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
