// ContractsConfigContext — renderer-side source of truth for contract IDs.
// Loads from userData/contracts.json via the Electron bridge.

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { bridge } from '../lib/bridge'
import type { ContractsConfig } from '../lib/bridge'

type LoadStatus = 'absent' | 'present' | 'saving' | 'error'

interface ContractsConfigContextValue {
  config: ContractsConfig | null
  loadStatus: LoadStatus
  error: string | null
  refresh: () => Promise<void>
  save: (config: ContractsConfig) => Promise<void>
  reset: () => Promise<void>
}

const ContractsConfigContext = createContext<ContractsConfigContextValue | null>(null)

export function ContractsConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ContractsConfig | null>(null)
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('absent')
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const c = await bridge.contractsConfig.get()
      if (!mounted.current) return
      setConfig(c)
      setLoadStatus('present')
      setError(null)
    } catch (e) {
      if (!mounted.current) return
      setLoadStatus('error')
      setError(e instanceof Error ? e.message : 'Failed to load contract config')
    }
  }, [])

  const save = useCallback(async (newConfig: ContractsConfig) => {
    setLoadStatus('saving')
    setError(null)
    try {
      const c = await bridge.contractsConfig.save(newConfig)
      if (!mounted.current) return
      setConfig(c)
      setLoadStatus('present')
    } catch (e) {
      if (!mounted.current) return
      setLoadStatus('error')
      setError(e instanceof Error ? e.message : 'Failed to save contract config')
      throw e
    }
  }, [])

  const reset = useCallback(async () => {
    setError(null)
    try {
      const c = await bridge.contractsConfig.reset()
      if (!mounted.current) return
      setConfig(c)
      setLoadStatus('present')
    } catch (e) {
      setLoadStatus('error')
      setError(e instanceof Error ? e.message : 'Failed to reset contract config')
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void refresh()
    const off = bridge.contractsConfig.onChange((c) => {
      if (!mounted.current) return
      setConfig(c)
      setLoadStatus('present')
    })
    return () => {
      mounted.current = false
      off()
    }
  }, [refresh])

  const value = useMemo(() => ({
    config,
    loadStatus,
    error,
    refresh,
    save,
    reset,
  }), [config, loadStatus, error, refresh, save, reset])

  return <ContractsConfigContext.Provider value={value}>{children}</ContractsConfigContext.Provider>
}

export function useContractsConfig(): ContractsConfigContextValue {
  const ctx = useContext(ContractsConfigContext)
  if (!ctx) throw new Error('useContractsConfig must be used within ContractsConfigProvider')
  return ctx
}
