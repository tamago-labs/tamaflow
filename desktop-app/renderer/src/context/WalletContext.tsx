// Wallet context with Loop/CLI switching support

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useInterval } from 'usehooks-ts'
import { bridge } from '../lib/bridge'
import { cli } from '../lib/cli'
import type {
  Holding,
  WalletStatus
} from '../lib/bridge'

export type WalletMode = 'loop' | 'cli'

interface WalletContextValue {
  mode: WalletMode
  setMode: (mode: WalletMode) => void
  status: WalletStatus | null
  holdings: Holding[]
  holdingsLoading: boolean
  loopAvailable: boolean
  cliAvailable: boolean
  refreshStatus: () => Promise<void>
  refreshHoldings: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<WalletMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('walletMode') as WalletMode) || 'loop'
    }
    return 'loop'
  })
  const [status, setStatus] = useState<WalletStatus | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [holdingsLoading, setHoldingsLoading] = useState(false)
  const [loopAvailable, setLoopAvailable] = useState(false)
  const [cliAvailable, setCliAvailable] = useState(false)
  const mounted = useRef(true)

  // Check CLI availability
  useEffect(() => {
    cli.health()
      .then(() => { if (mounted.current) setCliAvailable(true) })
      .catch(() => { if (mounted.current) setCliAvailable(false) })
  }, [])

  // Check Loop availability
  useEffect(() => {
    if (typeof window !== 'undefined' && window.bridge) {
      setLoopAvailable(true)
    }
  }, [])

  const setMode = useCallback((newMode: WalletMode) => {
    setModeState(newMode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('walletMode', newMode)
    }
  }, [])

  const refreshStatus = useCallback(async () => {
    if (!mounted.current) return
    try {
      if (mode === 'cli') {
        const s = await cli.wallet.status()
        if (!mounted.current) return
        setStatus({ exists: s.exists, partyId: s.partyId, fingerprint: s.fingerprint, filePath: '', encryptionAvailable: true })
      } else {
        const s = await bridge.wallet.status()
        if (!mounted.current) return
        setStatus(s)
      }
    } catch (e) {
      console.error('[WalletContext] status failed:', e)
    }
  }, [mode])

  const refreshHoldings = useCallback(async () => {
    if (!mounted.current) return
    setHoldingsLoading(true)
    try {
      if (mode === 'cli') {
        const h = await cli.holdings.list()
        if (!mounted.current) return
        setHoldings(Array.isArray(h) ? h : [])
      } else {
        const h = await bridge.wallet.holdings()
        if (!mounted.current) return
        setHoldings(h)
      }
    } catch (e) {
      console.error('[WalletContext] holdings failed:', e)
    } finally {
      if (mounted.current) setHoldingsLoading(false)
    }
  }, [mode])

  // Refresh on mount
  useEffect(() => {
    mounted.current = true
    refreshStatus()
    return () => { mounted.current = false }
  }, [refreshStatus])

  // Auto-refresh holdings every 30s
  useInterval(() => {
    if (status?.exists) refreshHoldings()
  }, 30000)

  return (
    <WalletContext.Provider value={{
      mode,
      setMode,
      status,
      holdings,
      holdingsLoading,
      loopAvailable,
      cliAvailable,
      refreshStatus,
      refreshHoldings
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return ctx
}
