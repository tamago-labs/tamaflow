// EmployeeContext — renderer-side source of truth for the employee roster.
//
// Mirrors CompanyContext shape (loadStatus state machine + push
// subscription + serialized saves). Action surface is broader because
// the roster is a list: add / update / remove build the new list
// locally and call save (whole-list semantics).

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { bridge } from '../lib/bridge'
import type { Employee, EmployeeFile, EmployeeExportResult, EmployeeImportResult } from '../ai/types'

type LoadStatus = 'absent' | 'present' | 'saving' | 'error'

interface EmployeeContextValue {
  employees: Employee[]
  file: EmployeeFile | null
  loadStatus: LoadStatus
  error: string | null
  refresh: () => Promise<void>
  save: (employees: Employee[]) => Promise<void>
  add: (employee: Employee) => Promise<void>
  update: (id: string, patch: Partial<Employee>) => Promise<void>
  remove: (id: string) => Promise<void>
  exportJson: () => Promise<EmployeeExportResult>
  importJson: () => Promise<EmployeeImportResult>
  reset: () => Promise<void>
  clearError: () => void
}

const EmployeeContext = createContext<EmployeeContextValue | null>(null)

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
    try {
      const f = await bridge.employees.get()
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
    if (saveInFlight.current) await saveInFlight.current
    const run = async (): Promise<void> => {
      setLoadStatus('saving')
      setError(null)
      try {
        const f = await bridge.employees.save(next)
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
      const next = employees.filter((e) => e.id !== id)
      await save(next)
    },
    [employees, save]
  )

  const exportJson = useCallback(async (): Promise<EmployeeExportResult> => {
    try {
      return await bridge.employees.exportJson()
    } catch (e) {
      setError(errMsg(e))
      throw e
    }
  }, [])

  const importJson = useCallback(async (): Promise<EmployeeImportResult> => {
    try {
      return await bridge.employees.importJson()
    } catch (e) {
      const msg = errMsg(e)
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const reset = useCallback(async () => {
    setError(null)
    try {
      await bridge.employees.reset()
      setFile(null)
      setLoadStatus('absent')
    } catch (e) {
      setLoadStatus('error')
      setError(errMsg(e))
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  useEffect(() => {
    mounted.current = true
    void refresh()
    const off = bridge.employees.onChange((next) => {
      if (!mounted.current) return
      setFile(next)
      setLoadStatus(next ? 'present' : 'absent')
    })
    return () => {
      mounted.current = false
      off()
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
    throw new Error('useEmployees must be used within an <EmployeeProvider>')
  }
  return ctx
}
