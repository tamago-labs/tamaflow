// CompanyContext — renderer-side source of truth for the employer company profile.
//
// Mirrors the EmployeeContext shape (loadStatus state machine + push
// subscription + serialized saves).

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { bridge } from '../lib/bridge'
import type { CompanyProfile, CompanyFile } from '../ai/types'

type LoadStatus = 'absent' | 'present' | 'saving' | 'error'

interface CompanyContextValue {
  profile: CompanyProfile | null
  file: CompanyFile | null
  loadStatus: LoadStatus
  error: string | null
  refresh: () => Promise<void>
  save: (profile: CompanyProfile) => Promise<void>
  reset: () => Promise<void>
  clearError: () => void
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

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
    try {
      const f = await bridge.company.get()
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
    if (saveInFlight.current) await saveInFlight.current
    const run = async (): Promise<void> => {
      setLoadStatus('saving')
      setError(null)
      try {
        const f = await bridge.company.save(profile)
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

  const reset = useCallback(async () => {
    setError(null)
    try {
      await bridge.company.reset()
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
    const off = bridge.company.onChange((next) => {
      if (!mounted.current) return
      setFile(next)
      setLoadStatus(next ? 'present' : 'absent')
    })
    return () => {
      mounted.current = false
      off()
    }
  }, [refresh])

  const value: CompanyContextValue = useMemo(() => ({
    profile: file?.profile ?? null,
    file,
    loadStatus,
    error,
    refresh,
    save,
    reset,
    clearError
  }), [file, loadStatus, error, refresh, save, reset, clearError])

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext)
  if (!ctx) {
    throw new Error('useCompany must be used within a <CompanyProvider>')
  }
  return ctx
}
