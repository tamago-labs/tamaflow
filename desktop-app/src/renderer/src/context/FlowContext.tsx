import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'
import type {
  FlowDefinition,
  FlowFile,
  FlowSummary,
} from '../../../preload/index.d'

/**
 * Renderer-side source of truth for the payroll flow list.
 *
 * Mirrors the `EmployeeContext` shape:
 *   - `list`/`flowList` state machine (absent / loading / present / error)
 *   - push-channel subscription keeps the list in sync across tabs
 *   - action surface exposes list/get/save/remove (the renderer never
 *     touches the file system directly)
 *
 * The FlowContext does NOT own the canvas content for a single flow —
 * that's the responsibility of the page that mounts the builder
 * (`FlowDetail.tsx`). It only holds the index (summaries) plus the
 * CRUD actions. Per-flow load is via `get(id)` on demand.
 */

type LoadStatus = 'absent' | 'present' | 'loading' | 'error'

interface FlowContextValue {
  flows: FlowSummary[]
  loadStatus: LoadStatus
  error: string | null
  refresh: () => Promise<void>
  /** Fetch a single flow by id (or `null` if missing / corrupt). */
  get: (id: string) => Promise<FlowFile | null>
  /**
   * Create OR update a flow. The renderer is expected to pass the
   * `id` on updates; main generates one when absent.
   */
  save: (
    flow: Omit<FlowDefinition, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string
      createdAt?: string
      updatedAt?: string
    },
  ) => Promise<FlowFile>
  remove: (id: string) => Promise<void>
  clearError: () => void
}

const FlowContext = createContext<FlowContextValue | null>(null)

/** Human-readable error message extraction (mirrors CompanyContext). */
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

export function FlowProvider({ children }: { children: ReactNode }) {
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('absent')
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    if (!window.api?.flows?.list) return
    setLoadStatus('loading')
    try {
      const list = await window.api.flows.list()
      if (!mounted.current) return
      setFlows(list)
      setLoadStatus('present')
      setError(null)
    } catch (e) {
      if (!mounted.current) return
      setLoadStatus('error')
      setError(errMsg(e))
    }
  }, [])

  const get = useCallback(async (id: string): Promise<FlowFile | null> => {
    if (!window.api?.flows?.get) return null
    try {
      return await window.api.flows.get(id)
    } catch (e) {
      setError(errMsg(e))
      throw e
    }
  }, [])

  const save = useCallback(
    async (
      flow: Omit<FlowDefinition, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string
        createdAt?: string
        updatedAt?: string
      },
    ): Promise<FlowFile> => {
      if (!window.api?.flows?.save) {
        throw new Error('Bridge unavailable')
      }
      try {
        // Optimistic: don't update local list here. The push channel
        // will fire with the canonical list after the round-trip.
        return await window.api.flows.save(flow)
      } catch (e) {
        const msg = errMsg(e)
        setError(msg)
        throw new Error(msg)
      }
    },
    [],
  )

  const remove = useCallback(async (id: string) => {
    if (!window.api?.flows?.remove) return
    try {
      await window.api.flows.remove(id)
      // Push channel will refresh `flows`; no optimistic update needed.
    } catch (e) {
      const msg = errMsg(e)
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  // Subscribe to push channel + initial fetch on mount.
  useEffect(() => {
    mounted.current = true
    void refresh()
    const off = window.api.flows?.onChange?.((next) => {
      if (!mounted.current) return
      setFlows(next)
      setLoadStatus(next ? 'present' : 'absent')
    })
    return () => {
      mounted.current = false
      off?.()
    }
  }, [refresh])

  const value: FlowContextValue = useMemo(
    () => ({
      flows,
      loadStatus,
      error,
      refresh,
      get,
      save,
      remove,
      clearError,
    }),
    [flows, loadStatus, error, refresh, get, save, remove, clearError],
  )

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>
}

export function useFlows(): FlowContextValue {
  const ctx = useContext(FlowContext)
  if (!ctx) {
    throw new Error('useFlows must be used within a <FlowProvider>')
  }
  return ctx
}