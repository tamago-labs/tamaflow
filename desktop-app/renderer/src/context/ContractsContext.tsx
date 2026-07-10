import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { bridge } from '../lib/bridge'

interface ContractsContextValue {
  jpycBalance: number
  loading: boolean
  error: string | null
  fetchBalance: (partyId: string) => Promise<void>
  refresh: () => Promise<void>
}

const ContractsContext = createContext<ContractsContextValue | null>(null)

export function ContractsProvider({ children }: { children: ReactNode }) {
  const [jpycBalance, setJpycBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partyId, setPartyId] = useState<string | null>(null)
  const mounted = useRef(true)

  const fetchBalance = useCallback(async (id: string) => {
    if (!mounted.current) return
    setLoading(true)
    setError(null)
    try {
      const balance = await bridge.contracts.getJPYCBalance(id)
      if (!mounted.current) return
      setJpycBalance(balance)
      setPartyId(id)
    } catch (e) {
      console.error('[Contracts] Failed to fetch balance:', e)
      if (!mounted.current) return
      setError(e instanceof Error ? e.message : 'Failed to fetch balance')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (partyId) {
      await fetchBalance(partyId)
    }
  }, [partyId, fetchBalance])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  return (
    <ContractsContext.Provider value={{ jpycBalance, loading, error, fetchBalance, refresh }}>
      {children}
    </ContractsContext.Provider>
  )
}

export function useContracts(): ContractsContextValue {
  const ctx = useContext(ContractsContext)
  if (!ctx) {
    throw new Error('useContracts must be used within a ContractsProvider')
  }
  return ctx
}
