import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react'
import type {
  ModelEntry,
  ModelLoadProgress,
  ModelStatus,
  ModelErrorPayload,
} from '../../../preload/index.d'

/**
 * Single renderer-side source of truth for AI state. Subscribes to
 * `models:progress` and `models:error` push channels from the main
 * process and exposes the resolved view-model that ModelSelector,
 * LoadingScreen, and Ready all consume.
 */

interface AIContextValue {
  status: ModelStatus | null
  progress: ModelLoadProgress | null
  error: ModelErrorPayload | null
  isReady: boolean
  activeModel: ModelEntry | null
  refresh: () => Promise<void>
  select: (id: string) => Promise<void>
  cancel: (clearCache?: boolean) => Promise<void>
  reload: () => Promise<void>
  unload: () => Promise<void>
  resetCache: (id: string) => Promise<{ success: boolean; deleted: string[]; error?: string }>
  setError: (e: ModelErrorPayload | null) => void
}

const AIContext = createContext<AIContextValue | null>(null)

export function AIProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [progress, setProgress] = useState<ModelLoadProgress | null>(null)
  const [error, setError] = useState<ModelErrorPayload | null>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    if (!window.api?.models?.status) return
    try {
      const s = await window.api.models.status()
      if (!mounted.current) return
      setStatus(s)
      // When the active model finishes loading, clear the in-flight progress.
      if (s.active.loaded) {
        setProgress(null)
      }
    } catch (e) {
      console.error('[AIContext] status fetch failed:', e)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    refresh()

    const offProgress = window.api.models.onProgress((p) => {
      if (!mounted.current) return
      setProgress(p)
      setError(null)
      // When load hits 100%, the modelId is set in main; refresh status
      // on the next tick so `isReady` flips to true.
      if (p.phase === 'loading' && p.percentage >= 100) {
        setTimeout(() => {
          if (mounted.current) refresh()
        }, 100)
      }
    })

    const offError = window.api.models.onError((e) => {
      if (!mounted.current) return
      setError(e)
    })

    return () => {
      mounted.current = false
      offProgress()
      offError()
    }
  }, [refresh])

  const select = useCallback(
    async (id: string) => {
      if (!window.api?.models?.select) return
      setError(null)
      setProgress(null)
      const r = await window.api.models.select(id)
      if (!r.success && r.error) {
        setError({ code: 'SELECT_FAILED', message: r.error, retryable: true })
      }
      await refresh()
    },
    [refresh],
  )

  const cancel = useCallback(
    async (clearCache?: boolean) => {
      if (!window.api?.models?.cancel) return
      await window.api.models.cancel({ clearCache })
      await refresh()
    },
    [refresh],
  )

  const reload = useCallback(async () => {
    if (!status?.active?.id) return
    await select(status.active.id)
  }, [select, status])

  const unload = useCallback(async () => {
    if (!window.api?.ai?.unload) return
    setError(null)
    try {
      await window.api.ai.unload()
    } catch (e) {
      console.error('[AIContext] unload failed:', e)
    }
    await refresh()
  }, [refresh])

  const resetCache = useCallback(
    async (id: string) => {
      if (!window.api?.models?.resetCache) {
        return { success: false, deleted: [], error: 'Not available' }
      }
      const r = await window.api.models.resetCache(id)
      if (r.success) {
        setError(null)
        setProgress(null)
      }
      await refresh()
      return r
    },
    [refresh],
  )

  const isReady = !!status?.active?.loaded
  const activeModel =
    status?.active?.id
      ? status.available.find((m) => m.id === status.active!.id) ?? null
      : null

  return (
    <AIContext.Provider
      value={{
        status,
        progress,
        error,
        isReady,
        activeModel,
        refresh,
        select,
        cancel,
        reload,
        unload,
        resetCache,
        setError,
      }}
    >
      {children}
    </AIContext.Provider>
  )
}

export function useAI() {
  const ctx = useContext(AIContext)
  if (!ctx) {
    throw new Error('useAI must be used within <AIProvider>')
  }
  return ctx
}
