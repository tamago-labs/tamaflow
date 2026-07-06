import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { bridge } from '../lib/bridge'
import type {
  FlowDefinition,
  FlowFile,
  FlowSummary,
  RouteSummary,
} from '../ai/types'

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
 * CRUD actions plus the worker action surface (start / stop / routes).
 */

type LoadStatus = 'absent' | 'present' | 'loading' | 'error'

/** Result of a start / stop call — `{ ok: false, error }` on failure
 *  (e.g. wallet not set up, flow already active). */
export type LifecycleResult =
  | { ok: true }
  | { ok: false; error: string }

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
  /** Flip a draft flow to active. Worker picks up the routes on its
   *  next tick. */
  start: (id: string) => Promise<LifecycleResult>
  /** Stop an active flow. In-flight routes flip to `failed`; status
   *  returns to `draft`. */
  stop: (id: string) => Promise<LifecycleResult>
  /** Per-flow routes (summary shape, sorted by createdAt asc). */
  listRoutes: (flowId: string) => Promise<RouteSummary[]>
  /**
   * Cross-flow route aggregator for the Settlement History page.
   * Sorted by `completedAt` desc (fallback to `createdAt` desc).
   */
  listAllRoutes: () => Promise<RouteSummary[]>
  /**
   * Subscribe to per-route status updates the worker emits. Returns an
   * unsubscribe function.
   */
  onProgress: (
    cb: (flowId: string, routes: RouteSummary[]) => void,
  ) => () => void
  /**
   * Subscribe to flow-list changes (add / remove / status flip). Returns
   * an unsubscribe function.
   */
  onChange: (cb: (list: FlowSummary[]) => void) => () => void
  clearError: () => void
}

const FlowContext = createContext<FlowContextValue | null>(null)

/** Human-readable error message extraction. */
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
    setLoadStatus('loading')
    try {
      const list = await bridge.flows.list()
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
    try {
      return await bridge.flows.get(id)
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
      try {
        return await bridge.flows.save(flow)
      } catch (e) {
        const msg = errMsg(e)
        setError(msg)
        throw new Error(msg)
      }
    },
    [],
  )

  const remove = useCallback(async (id: string) => {
    try {
      await bridge.flows.remove(id)
    } catch (e) {
      const msg = errMsg(e)
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const start = useCallback(
    async (id: string): Promise<LifecycleResult> => {
      try {
        return await bridge.flows.start(id)
      } catch (e) {
        const msg = errMsg(e)
        setError(msg)
        return { ok: false, error: msg }
      }
    },
    [],
  )

  const stop = useCallback(
    async (id: string): Promise<LifecycleResult> => {
      try {
        return await bridge.flows.stop(id)
      } catch (e) {
        const msg = errMsg(e)
        setError(msg)
        return { ok: false, error: msg }
      }
    },
    [],
  )

  const listRoutes = useCallback(
    async (flowId: string): Promise<RouteSummary[]> => {
      try {
        return await bridge.flows.routes.list(flowId)
      } catch (e) {
        console.error('[FlowContext] listRoutes failed:', e)
        return []
      }
    },
    [],
  )

  const listAllRoutes = useCallback(async (): Promise<RouteSummary[]> => {
    try {
      return await bridge.flows.routes.listAll()
    } catch (e) {
      console.error('[FlowContext] listAllRoutes failed:', e)
      return []
    }
  }, [])

  const onProgress = useCallback(
    (cb: (flowId: string, routes: RouteSummary[]) => void): (() => void) => {
      return bridge.flows.onProgress(cb)
    },
    [],
  )

  const onChange = useCallback(
    (cb: (list: FlowSummary[]) => void): (() => void) => {
      return bridge.flows.onChange(cb)
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  // Subscribe to push channel + initial fetch on mount.
  useEffect(() => {
    mounted.current = true
    void refresh()
    const off = bridge.flows.onChange((next) => {
      if (!mounted.current) return
      setFlows(next)
      setLoadStatus(next ? 'present' : 'absent')
    })
    return () => {
      mounted.current = false
      off()
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
      start,
      stop,
      listRoutes,
      listAllRoutes,
      onProgress,
      onChange,
      clearError,
    }),
    [
      flows,
      loadStatus,
      error,
      refresh,
      get,
      save,
      remove,
      start,
      stop,
      listRoutes,
      listAllRoutes,
      onProgress,
      onChange,
      clearError,
    ],
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
