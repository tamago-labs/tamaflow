import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react'
import type {
  WalletStatus,
  Holding,
  FaucetResult,
} from '../../../preload/index.d'

/**
 * Renderer-side source of truth for the Canton wallet state.
 *
 * Subscribes to `wallet:onChange` push events from the main process
 * (fired whenever wallet.json is created/destroyed). Exposes a small
 * state machine + action API the rest of the UI consumes.
 *
 * Mirrors the AIContext shape so the patterns stay consistent.
 */

type Status = 'absent' | 'present' | 'creating' | 'fauceting' | 'error'

interface ModalState {
  setupOpen: boolean
  accountInfoOpen: boolean
  faucetOpen: boolean
  exportKeyOpen: boolean
  destroyOpen: boolean
  exportKeyValue: string | null
}

interface WalletContextValue {
  status: WalletStatus | null
  loadStatus: Status
  holdings: Holding[]
  holdingsLoading: boolean
  modal: ModalState
  error: string | null
  refreshStatus: () => Promise<void>
  refreshHoldings: () => Promise<void>
  setup: (
    opts?: { partyHint?: string },
  ) => Promise<FaucetResult['success'] extends true ? void : { error?: string }>
  destroy: () => Promise<void>
  runFaucet: (amount?: string) => Promise<FaucetResult>
  exportKey: () => Promise<void>
  openSetup: () => void
  closeSetup: () => void
  openAccountInfo: () => void
  closeAccountInfo: () => void
  openFaucet: () => void
  closeFaucet: () => void
  openExportKey: () => void
  closeExportKey: () => void
  openDestroy: () => void
  closeDestroy: () => void
  clearError: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

const NOOP = () => undefined

const defaultModal: ModalState = {
  setupOpen: false,
  accountInfoOpen: false,
  faucetOpen: false,
  exportKeyOpen: false,
  destroyOpen: false,
  exportKeyValue: null,
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus | null>(null)
  const [loadStatus, setLoadStatus] = useState<Status>('absent')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [holdingsLoading, setHoldingsLoading] = useState(false)
  const [modal, setModal] = useState<ModalState>(defaultModal)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const refreshStatus = useCallback(async () => {
    if (!window.api?.wallet?.status) return
    try {
      const s = await window.api.wallet.status()
      if (!mounted.current) return
      setStatus(s)
      setLoadStatus(s.exists ? 'present' : 'absent')
    } catch (e) {
      console.error('[WalletContext] status failed:', e)
    }
  }, [])

  const refreshHoldings = useCallback(async () => {
    if (!window.api?.wallet?.holdings) return
    setHoldingsLoading(true)
    try {
      const h = await window.api.wallet.holdings()
      if (!mounted.current) return
      setHoldings(h)
    } catch (e) {
      console.error('[WalletContext] holdings failed:', e)
    } finally {
      if (mounted.current) setHoldingsLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    refreshStatus()

    const off = window.api.wallet.onChange(() => {
      if (!mounted.current) return
      refreshStatus()
      // After a change, refresh holdings too — destroy clears them,
      // create allows the dashboard to populate after a faucet run.
      refreshHoldings()
    })

    return () => {
      mounted.current = false
      off()
    }
  }, [refreshStatus, refreshHoldings])

  // When a wallet becomes present for the first time, fetch holdings.
  useEffect(() => {
    if (loadStatus === 'present') {
      refreshHoldings()
    }
  }, [loadStatus, refreshHoldings])

  const setup = useCallback(async (opts?: { partyHint?: string }) => {
    if (!window.api?.wallet?.create) return { error: 'Not available' }
    setLoadStatus('creating')
    setError(null)
    const r = await window.api.wallet.create(opts)
    if (!mounted.current) return r
    if (!r.success) {
      setLoadStatus('error')
      setError(r.error ?? 'Failed to create wallet')
      return r
    }
    setLoadStatus('present')
    setModal((m) => ({ ...m, setupOpen: false }))
    return r
  }, [])

  const destroy = useCallback(async () => {
    if (!window.api?.wallet?.destroy) return
    await window.api.wallet.destroy()
    if (!mounted.current) return
    setModal((m) => ({ ...m, destroyOpen: false }))
    // Main process fires wallet:onChange which triggers refreshStatus.
  }, [])

  const runFaucet = useCallback(
    async (amount?: string): Promise<FaucetResult> => {
      if (!window.api?.wallet?.faucet)
        return { success: false, error: 'Not available' }
      setLoadStatus('fauceting')

      setError(null)
      const r = await window.api.wallet.faucet(amount)

      if (!mounted.current) return r
      setLoadStatus('present')
      if (!r.success) {
        setError(r.error ?? 'Faucet failed')
      } else {
        // Refresh holdings so the new CC balance shows.
        refreshHoldings()
        setModal((m) => ({ ...m, faucetOpen: false }))
      }
      return r
    },
    [refreshHoldings],
  )

  const exportKey = useCallback(async () => {
    if (!window.api?.wallet?.exportKey) return
    const r = await window.api.wallet.exportKey()
    if (!mounted.current) return
    if (r.success && r.privateKey) {
      setModal((m) => ({
        ...m,
        exportKeyOpen: true,
        exportKeyValue: r.privateKey!,
      }))
    } else {
      setError(r.error ?? 'Failed to export key')
    }
  }, [])

  // Modal helpers
  const openSetup = useCallback(() => setModal((m) => ({ ...m, setupOpen: true })), [])
  const closeSetup = useCallback(() => setModal((m) => ({ ...m, setupOpen: false })), [])
  const openAccountInfo = useCallback(
    () => setModal((m) => ({ ...m, accountInfoOpen: true })),
    [],
  )
  const closeAccountInfo = useCallback(
    () => setModal((m) => ({ ...m, accountInfoOpen: false })),
    [],
  )
  const openFaucet = useCallback(() => setModal((m) => ({ ...m, faucetOpen: true })), [])
  const closeFaucet = useCallback(() => setModal((m) => ({ ...m, faucetOpen: false })), [])
  const openExportKey = useCallback(() => {
    // Trigger the IPC — it will set exportKeyValue + flip openExportKey.
    exportKey()
  }, [exportKey])
  const closeExportKey = useCallback(
    () => setModal((m) => ({ ...m, exportKeyOpen: false, exportKeyValue: null })),
    [],
  )
  const openDestroy = useCallback(
    () => setModal((m) => ({ ...m, destroyOpen: true })),
    [],
  )
  const closeDestroy = useCallback(
    () => setModal((m) => ({ ...m, destroyOpen: false })),
    [],
  )
  const clearError = useCallback(() => setError(null), [])

  // Provide safe no-op defaults for the rare Server-Component reach.
  const value: WalletContextValue = {
    status,
    loadStatus,
    holdings,
    holdingsLoading,
    modal,
    error,
    refreshStatus,
    refreshHoldings,
    setup,
    destroy,
    runFaucet,
    exportKey,
    openSetup: openSetup ?? NOOP,
    closeSetup: closeSetup ?? NOOP,
    openAccountInfo: openAccountInfo ?? NOOP,
    closeAccountInfo: closeAccountInfo ?? NOOP,
    openFaucet: openFaucet ?? NOOP,
    closeFaucet: closeFaucet ?? NOOP,
    openExportKey: openExportKey ?? NOOP,
    closeExportKey: closeExportKey ?? NOOP,
    openDestroy: openDestroy ?? NOOP,
    closeDestroy: closeDestroy ?? NOOP,
    clearError: clearError ?? NOOP,
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error('useWallet must be used within <WalletProvider>')
  }
  return ctx
}
