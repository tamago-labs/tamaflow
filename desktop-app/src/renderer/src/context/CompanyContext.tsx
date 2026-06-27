import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode
} from 'react'
import type { CompanyProfile, CompanyFile, CompanyImportResult } from '../../../preload/index.d'

/**
 * Renderer-side source of truth for the employer company profile.
 *
 * Mirrors the `WalletContext` shape (loadStatus state machine + push
 * subscription) but with a simpler action surface — no modal registry
 * (the form lives in the gate / Settings page, not in a global modal)
 * and no per-action loading booleans (a single `saving` covers it).
 *
 * Subscribes to `company:onChange` push events from main (fired after
 * every `save` / `reset`). The push-channel handler is idempotent
 * (`setFile` only), so double-fires from save+push are safe.
 *
 * Saves are serialized via `saveInFlightRef` to avoid races when two
 * surfaces (gate + Settings) submit in quick succession.
 */

type LoadStatus = 'absent' | 'present' | 'saving' | 'error'

interface CompanyContextValue {
  profile: CompanyProfile | null
  file: CompanyFile | null
  loadStatus: LoadStatus
  error: string | null
  refresh: () => Promise<void>
  save: (profile: CompanyProfile) => Promise<void>
  exportJson: () => Promise<void>
  importJson: () => Promise<CompanyFile | null>
  reset: () => Promise<void>
  clearError: () => void
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

/**
 * Human-readable error message extraction. Mirrors `errMsg` from
 * `main/wallet.ts` so all error surfaces in the renderer use a single
 * shape. A throw could be a native `Error`, a plain `{ message }`,
 * an `Error`-shaped object, or literally anything; we always return a
 * non-empty string (never "[object Object]").
 */
function errMsg(err: unknown): string {
  if (err === null || err === undefined) return String(err)
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    try {
      return JSON.stringify(err)
    } catch {
      return 'Unknown error'
    }
  }
  return String(err)
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<CompanyFile | null>(null)
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('absent')
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const saveInFlight = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async () => {
    if (!window.api?.company?.get) return
    try {
      const f = await window.api.company.get()
      if (!mounted.current) return
      setFile(f)
      setLoadStatus(f ? 'present' : 'absent')
      setError(null)
    } catch (e) {
      if (!mounted.current) return
      setLoadStatus('error')
      setError(errMsg(e))
    }
  }, [])

  const save = useCallback(async (profile: CompanyProfile) => {
    if (!window.api?.company?.save) return
    // Serialize concurrent saves: if a save is in flight, await it
    // before running this one. The push-channel subscription will
    // update `file` from the first save; the second save re-stamps
    // and overwrites.
    if (saveInFlight.current) {
      await saveInFlight.current
    }
    const run = async (): Promise<void> => {
      setLoadStatus('saving')
      setError(null)
      try {
        const f = await window.api.company.save(profile)
        if (!mounted.current) return
        setFile(f)
        setLoadStatus('present')
      } catch (e) {
        if (!mounted.current) return
        setLoadStatus('error')
        setError(errMsg(e))
        throw e
      }
    }
    const p = run()
    saveInFlight.current = p
    try {
      await p
    } finally {
      if (saveInFlight.current === p) saveInFlight.current = null
    }
  }, [])

  const exportJson = useCallback(async () => {
    if (!window.api?.company?.exportJson) return
    try {
      const r = await window.api.company.exportJson()
      if (r.success) return
      // Cancelled — silent. Other errors — surface in the context error.
      if (r.canceled) return
      throw new Error(r.error ?? 'Export failed')
    } catch (e) {
      setError(errMsg(e))
      throw e
    }
  }, [])

  const importJson = useCallback(async (): Promise<CompanyFile | null> => {
    if (!window.api?.company?.importJson) return null
    let result: CompanyImportResult
    try {
      result = await window.api.company.importJson()
    } catch (e) {
      setError(errMsg(e))
      throw e
    }
    if (result.canceled) return null
    if (!result.success || !result.file) {
      const msg = result.error ?? 'Import failed'
      setError(msg)
      throw new Error(msg)
    }
    return result.file
  }, [])

  const reset = useCallback(async () => {
    if (!window.api?.company?.reset) return
    setError(null)
    try {
      await window.api.company.reset()
      // The push channel will set `file = null`, but update local state
      // immediately so the gate's error card can transition without
      // waiting for the round-trip.
      setFile(null)
      setLoadStatus('absent')
    } catch (e) {
      setLoadStatus('error')
      setError(errMsg(e))
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  // Subscribe to push channel + initial fetch on mount.
  useEffect(() => {
    mounted.current = true
    void refresh()

    const off = window.api.company?.onChange?.((next) => {
      if (!mounted.current) return
      setFile(next)
      setLoadStatus(next ? 'present' : 'absent')
    })

    return () => {
      mounted.current = false
      off?.()
    }
  }, [refresh])

  const value: CompanyContextValue = {
    file,
    profile: file?.profile ?? null,
    loadStatus,
    error,
    refresh,
    save,
    exportJson,
    importJson,
    reset,
    clearError
  }

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext)
  if (!ctx) {
    throw new Error('useCompany must be used within a <CompanyProvider>')
  }
  return ctx
}
