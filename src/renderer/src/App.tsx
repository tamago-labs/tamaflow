import { useEffect, useState } from 'react'
import { useAI } from './context/AIContext'
import ModelSelector from './pages/ModelSelector'
import LoadingScreen from './pages/LoadingScreen'
import Ready from './pages/Ready'
import { SPLASH_DELAY_MS } from './theme'
import type { ModelEntry } from '../../preload/index.d'

type AppState = 'loading' | 'model' | 'model-loading' | 'ready'

/**
 * Boot flow:
 *   loading        (brief splash — gives the renderer time to mount
 *                  the wordmark before the picker slides in)
 *   model          user picks a model in ModelSelector
 *   model-loading  LoadingScreen tracks the in-flight load via useAI();
 *                  advances on its own when isReady
 *   ready          "AI is ready" landing page
 *
 * The model step is required because the chat (and everything else
 * downstream of `isReady`) needs a loaded model. The "Continue
 * without loading" link on the ModelSelector jumps straight to
 * `ready` with `isReady = false` so the user can pick later.
 */
function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const { isReady, status, refresh } = useAI()

  // Brief splash so the wordmark fades in gracefully.
  useEffect(() => {
    const t = setTimeout(() => setAppState('model'), SPLASH_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  // Once a model is loaded in the main process, refresh the status
  // so the `Ready` page shows the correct card.
  useEffect(() => {
    if (appState === 'ready') void refresh()
  }, [appState, refresh])

  const handleModelSelect = (_entry: ModelEntry) => {
    setAppState('model-loading')
  }

  const handleLoadingComplete = () => {
    setAppState('ready')
  }

  const handleModelSkip = () => {
    setAppState('ready')
  }

  const handleBackToPicker = () => {
    setAppState('model')
  }

  const handleUnload = async () => {
    try {
      await window.api?.ai?.unload()
    } catch (e) {
      console.error('[App] unload failed:', e)
    }
    await refresh()
    setAppState('model')
  }

  return (
    <>
      {appState === 'loading' && (
        <Splash />
      )}

      {appState === 'model' && (
        <ModelSelectorGate
          isReady={isReady}
          status={status}
          onSelect={handleModelSelect}
          onSkip={handleModelSkip}
        />
      )}

      {appState === 'model-loading' && <LoadingScreen onComplete={handleLoadingComplete} />}

      {appState === 'ready' && (
        <Ready onBackToPicker={handleBackToPicker} onUnload={() => void handleUnload()} />
      )}
    </>
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
