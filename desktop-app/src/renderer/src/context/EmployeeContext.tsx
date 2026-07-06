import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  ReactNode
} from 'react'
import type {
  Employee,
  EmployeeFile,
  EmployeeImportResult
} from '../../../preload/index.d'

/**
 * Renderer-side source of truth for the employee roster.
 *
 * Mirrors `CompanyContext` shape (loadStatus state machine + push
 * subscription + serialized saves). Action surface is broader because
 * the roster is a list: `add` / `update` / `remove` build the new list
 * locally and call `save` (whole-list semantics).
 *
 * Saves are serialized via `saveInFlightRef` to avoid races when two
 * surfaces (e.g. a future flow builder + this page) submit in quick
 * succession. The push-channel subscription keeps the local list in
 * sync after a round-trip.
 *
 * The export / import actions delegate to main and surface errors via
 * `error` (a string) + `throw` for caller-side handling.
 */

type LoadStatus = 'absent' | 'present' | 'saving' | 'error'

interface EmployeeContextValue {
  employees: Employee[]
  file: EmployeeFile | null
  loadStatus: LoadStatus
  error: string | null
  refresh: () => Promise<void>
  /** Replace the whole roster. */
  save: (employees: Employee[]) => Promise<void>
  /** Append (or update, if `employee.id` collides). */
  add: (employee: Employee) => Promise<void>
  /** Patch fields on an existing row. No-op if id not found. */
  update: (id: string, patch: Partial<Employee>) => Promise<void>
  /** Drop one employee by id. */
  remove: (id: string) => Promise<void>
  exportJson: () => Promise<void>
  /** Triggers the OS open dialog + diff computation in main. Returns
   *  the parsed file (does NOT save — caller decides). */
  importJson: () => Promise<EmployeeImportResult>
  /** Recovery hatch — deletes the on-disk roster. */
  reset: () => Promise<void>
  clearError: () => void
}

const EmployeeContext = createContext<EmployeeContextValue | null>(null)

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

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<EmployeeFile | null>(null)
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('absent')
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const saveInFlight = useRef<Promise<void> | null>(null)

  const employees = useMemo(() => file?.employees ?? [], [file])

  const refresh = useCallback(async () => {
    if (!window.api?.employees?.get) return
    try {
      const f = await window.api.employees.get()
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

  const save = useCallback(async (next: Employee[]) => {
    if (!window.api?.employees?.save) return
    if (saveInFlight.current) {
      await saveInFlight.current
    }
    const run = async (): Promise<void> => {
      setLoadStatus('saving')
      setError(null)
      try {
        const f = await window.api.employees.save(next)
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

  const add = useCallback(
    async (employee: Employee) => {
      // Replace by id if already present, otherwise append.
      const without = employees.filter((e) => e.id !== employee.id)
      await save([...without, employee])
    },
    [employees, save]
  )

  const update = useCallback(
    async (id: string, patch: Partial<Employee>) => {
      const next = employees.map((e) => (e.id === id ? { ...e, ...patch } : e))
      await save(next)
    },
    [employees, save]
  )

  const remove = useCallback(
    async (id: string) => {
      // Local optimistic drop, then persist. If the main round-trip
      // fails the push-channel will reconcile.
      const next = employees.filter((e) => e.id !== id)
      await save(next)
    },
    [employees, save]
  )

  const exportJson = useCallback(async () => {
    if (!window.api?.employees?.exportJson) return
    try {
      const r = await window.api.employees.exportJson()
      if (r.success) return
      if (r.canceled) return
      throw new Error(r.error ?? 'Export failed')
    } catch (e) {
      setError(errMsg(e))
      throw e
    }
  }, [])

  const importJson = useCallback(async (): Promise<EmployeeImportResult> => {
    if (!window.api?.employees?.importJson) {
      return { success: false, error: 'Bridge unavailable' }
    }
    try {
      return await window.api.employees.importJson()
    } catch (e) {
      const msg = errMsg(e)
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const reset = useCallback(async () => {
    if (!window.api?.employees?.reset) return
    setError(null)
    try {
      await window.api.employees.reset()
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
    const off = window.api.employees?.onChange?.((next) => {
      if (!mounted.current) return
      setFile(next)
      setLoadStatus(next ? 'present' : 'absent')
    })
    return () => {
      mounted.current = false
      off?.()
    }
  }, [refresh])

  const value: EmployeeContextValue = {
    employees,
    file,
    loadStatus,
    error,
    refresh,
    save,
    add,
    update,
    remove,
    exportJson,
    importJson,
    reset,
    clearError
  }

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>
}

export function useEmployees(): EmployeeContextValue {
  const ctx = useContext(EmployeeContext)
  if (!ctx) {
    throw new Error('useEmployees must be used within a <EmployeeProvider>')
  }
  return ctx
}