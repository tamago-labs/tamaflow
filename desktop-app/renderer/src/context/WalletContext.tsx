// Renderer-side source of truth for the Canton wallet state.
//
// Tamaflow v1 surface: status / create / destroy / exportKey /
// faucet / holdings / pendingTransfers / accept / reject / transfer
// + the four modals (Setup, AccountInfo, ExportKey, ConfirmDestroy)
// + the SendModal + FaucetModal.
//
// Subscribes to `wallet:onChange` push events from the main process
// (fired whenever wallet.json is created/destroyed). Holdings +
// pending transfers auto-refresh on a 30s cadence while a wallet is
// present and the app is mounted.

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
import type {
  FaucetResult,
  Holding,
  PendingTransfer,
  RecipientResult,
  TransferParams,
  TransferResult,
  WalletRestoreResult,
  WalletStatus
} from '../lib/bridge'

type Status = 'absent' | 'present' | 'creating' | 'fauceting' | 'error'

interface ModalState {
  setupOpen: boolean
  accountInfoOpen: boolean
  exportKeyOpen: boolean
  destroyOpen: boolean
  faucetOpen: boolean
  restoreOpen: boolean
  sendOpen: boolean
  /** Populated when the user opens Export; rendered by ExportKeyModal. */
  exportKeyValue: string | null
  /** Symbol the user is currently sending via the SendModal. */
  openSendSymbol: string | null
}

interface WalletContextValue {
  status: WalletStatus | null
  loadStatus: Status
  modal: ModalState
  error: string | null
  holdings: Holding[]
  holdingsLoading: boolean
  /**
   * True once the initial `holdings()` IPC round-trip has resolved
   * at least once. Lets the UI distinguish "still loading on first
   * paint" from "loaded, value happens to be 0" — without this flag
   * the Assets tiles flash "0" during boot.
   */
  holdingsHasLoaded: boolean
  pendingTransfers: PendingTransfer[]
  pendingTransfersLoading: boolean
  /**
   * Same as `holdingsHasLoaded` for the pending-transfers list.
   */
  pendingTransfersHasLoaded: boolean
  refreshStatus: () => Promise<void>
  refreshHoldings: () => Promise<void>
  refreshPendingTransfers: () => Promise<void>
  setup: (opts?: { partyHint?: string }) => Promise<{
    success: boolean
    partyId?: string
    fingerprint?: string
    error?: string
  }>
  restore: (opts: { privateKey: string; partyHint?: string }) => Promise<WalletRestoreResult>
  destroy: () => Promise<void>
  exportKey: () => Promise<void>
  runFaucet: (amount?: string) => Promise<FaucetResult>
  transfer: (params: TransferParams) => Promise<TransferResult>
  acceptPending: (contractId: string) => Promise<RecipientResult>
  rejectPending: (contractId: string) => Promise<RecipientResult>
  openSetup: () => void
  closeSetup: () => void
  openRestore: () => void
  closeRestore: () => void
  openAccountInfo: () => void
  closeAccountInfo: () => void
  openExportKey: () => void
  closeExportKey: () => void
  openDestroy: () => void
  closeDestroy: () => void
  openFaucet: () => void
  closeFaucet: () => void
  openSend: (symbol: string) => void
  closeSend: () => void
  clearError: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

/** Auto-refresh cadence for holdings + pending transfers (ms). */
const REFRESH_INTERVAL_MS = 30_000

const defaultModal: ModalState = {
  setupOpen: false,
  accountInfoOpen: false,
  exportKeyOpen: false,
  destroyOpen: false,
  faucetOpen: false,
  restoreOpen: false,
  sendOpen: false,
  exportKeyValue: null,
  openSendSymbol: null
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus | null>(null)
  const [loadStatus, setLoadStatus] = useState<Status>('absent')
  const [modal, setModal] = useState<ModalState>(defaultModal)
  const [error, setError] = useState<string | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [holdingsLoading, setHoldingsLoading] = useState(false)
  const [holdingsHasLoaded, setHoldingsHasLoaded] = useState(false)
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([])
  const [pendingTransfersLoading, setPendingTransfersLoading] = useState(false)
  const [pendingTransfersHasLoaded, setPendingTransfersHasLoaded] =
    useState(false)
  const mounted = useRef(true)

  const refreshStatus = useCallback(async () => {
    try {
      const s = await bridge.wallet.status()
      if (!mounted.current) return
      setStatus(s)
      setLoadStatus(s.exists ? 'present' : 'absent')
      // When the wallet is gone, cached holdings + pending lists are
      // stale; clear them so the next mount of a wallet re-runs the
      // full first-paint loading sequence.
      if (!s.exists) {
        setHoldings([])
        setHoldingsHasLoaded(false)
        setPendingTransfers([])
        setPendingTransfersHasLoaded(false)
      }
    } catch (e) {
      console.error('[WalletContext] status failed:', e)
    }
  }, [])

  const refreshHoldings = useCallback(async () => {
    setHoldingsLoading(true)
    try {
      const h = await bridge.wallet.holdings()
      if (!mounted.current) return
      setHoldings(h)
      setHoldingsHasLoaded(true)
    } catch (e) {
      console.error('[WalletContext] holdings failed:', e)
    } finally {
      if (mounted.current) setHoldingsLoading(false)
    }
  }, [])

  const refreshPendingTransfers = useCallback(async () => {
    setPendingTransfersLoading(true)
    try {
      const list = await bridge.wallet.pendingTransfers()
      if (!mounted.current) return
      setPendingTransfers(list)
      setPendingTransfersHasLoaded(true)
    } catch (e) {
      console.error('[WalletContext] pendingTransfers failed:', e)
    } finally {
      if (mounted.current) setPendingTransfersLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    refreshStatus()
    const off = bridge.wallet.onChange(() => {
      if (!mounted.current) return
      refreshStatus()
      refreshHoldings()
      refreshPendingTransfers()
    })
    return () => {
      mounted.current = false
      off()
    }
  }, [refreshStatus, refreshHoldings, refreshPendingTransfers])

  // When a wallet becomes present for the first time, fetch holdings
  // + pending transfers.
  useEffect(() => {
    if (loadStatus === 'present') {
      refreshHoldings()
      refreshPendingTransfers()
    }
  }, [loadStatus, refreshHoldings, refreshPendingTransfers])

  // Periodic auto-refresh of holdings + pending transfers. Pauses
  // while the wallet isn't ready OR the app isn't mounted.
  const walletReady = loadStatus === 'present'
  useInterval(
    () => {
      void refreshHoldings()
      void refreshPendingTransfers()
    },
    walletReady ? REFRESH_INTERVAL_MS : null
  )

  const setup = useCallback(
    async (opts?: { partyHint?: string }) => {
      setLoadStatus('creating')
      setError(null)
      const r = await bridge.wallet.create(opts)
      if (!mounted.current) return r
      if (!r.success) {
        setLoadStatus('error')
        setError(r.error ?? 'Failed to create wallet')
        return r
      }
      setLoadStatus('present')
      setModal((m) => ({ ...m, setupOpen: false }))
      return r
    },
    []
  )

  const restore = useCallback(
    async (opts: { privateKey: string; partyHint?: string }): Promise<WalletRestoreResult> => {
      setLoadStatus('creating')
      setError(null)
      const r = await bridge.wallet.restore(opts)
      if (!mounted.current) return r
      if (!r.success) {
        setLoadStatus('error')
        setError(r.error ?? 'Failed to restore wallet')
        return r
      }
      setLoadStatus('present')
      setModal((m) => ({ ...m, restoreOpen: false, setupOpen: false }))
      return r
    },
    []
  )

  const destroy = useCallback(async () => {
    await bridge.wallet.destroy()
    if (!mounted.current) return
    setModal((m) => ({ ...m, destroyOpen: false }))
  }, [])

  const exportKey = useCallback(async () => {
    const r = await bridge.wallet.exportKey()
    if (!mounted.current) return
    if (r.success && r.privateKey) {
      setModal((m) => ({
        ...m,
        exportKeyOpen: true,
        exportKeyValue: r.privateKey!
      }))
    } else {
      setError(r.error ?? 'Failed to export key')
    }
  }, [])

  const runFaucet = useCallback(
    async (amount?: string): Promise<FaucetResult> => {
      setLoadStatus('fauceting')
      setError(null)
      const r = await bridge.wallet.faucet(amount)
      if (!mounted.current) return r
      if (!r.success) {
        setLoadStatus('error')
        setError(r.error ?? 'Faucet failed')
        return r
      }
      setLoadStatus('present')
      setModal((m) => ({ ...m, faucetOpen: false }))
      return r
    },
    []
  )

  const transfer = useCallback(
    async (params: TransferParams): Promise<TransferResult> => {
      setError(null)
      const r = await bridge.wallet.transfer(params)
      if (!mounted.current) return r
      if (!r.success) {
        setError(r.error ?? 'Transfer failed')
        return r
      }
      // Refresh holdings so the new (lower) balance shows.
      refreshHoldings()
      return r
    },
    [refreshHoldings]
  )

  const acceptPending = useCallback(
    async (contractId: string): Promise<RecipientResult> => {
      setError(null)
      const r = await bridge.wallet.accept(contractId)
      if (!mounted.current) return r
      if (!r.success) {
        setError(r.error ?? 'Accept failed')
        return r
      }
      // Refresh both the pending list (row disappears) and holdings
      // (the accepted CC lands in the wallet).
      refreshPendingTransfers()
      refreshHoldings()
      return r
    },
    [refreshHoldings, refreshPendingTransfers]
  )

  const rejectPending = useCallback(
    async (contractId: string): Promise<RecipientResult> => {
      setError(null)
      const r = await bridge.wallet.reject(contractId)
      if (!mounted.current) return r
      if (!r.success) {
        setError(r.error ?? 'Reject failed')
        return r
      }
      // Refresh the pending list only — reject doesn't change balance.
      refreshPendingTransfers()
      return r
    },
    [refreshPendingTransfers]
  )

  const openSetup = useCallback(
    () => setModal((m) => ({ ...m, setupOpen: true })),
    []
  )
  const closeSetup = useCallback(
    () => setModal((m) => ({ ...m, setupOpen: false })),
    []
  )
  const openRestore = useCallback(
    () => setModal((m) => ({ ...m, restoreOpen: true })),
    []
  )
  const closeRestore = useCallback(
    () => setModal((m) => ({ ...m, restoreOpen: false })),
    []
  )
  const openAccountInfo = useCallback(
    () => setModal((m) => ({ ...m, accountInfoOpen: true })),
    []
  )
  const closeAccountInfo = useCallback(
    () => setModal((m) => ({ ...m, accountInfoOpen: false })),
    []
  )
  const openExportKey = useCallback(() => {
    exportKey()
  }, [exportKey])
  const closeExportKey = useCallback(
    () => setModal((m) => ({ ...m, exportKeyOpen: false, exportKeyValue: null })),
    []
  )
  const openDestroy = useCallback(
    () => setModal((m) => ({ ...m, destroyOpen: true })),
    []
  )
  const closeDestroy = useCallback(
    () => setModal((m) => ({ ...m, destroyOpen: false })),
    []
  )
  const openFaucet = useCallback(
    () => setModal((m) => ({ ...m, faucetOpen: true })),
    []
  )
  const closeFaucet = useCallback(
    () => setModal((m) => ({ ...m, faucetOpen: false })),
    []
  )
  const openSend = useCallback((symbol: string) => {
    setModal((m) => ({ ...m, sendOpen: true, openSendSymbol: symbol }))
  }, [])
  const closeSend = useCallback(
    () =>
      setModal((m) => ({ ...m, sendOpen: false, openSendSymbol: null })),
    []
  )
  const clearError = useCallback(() => setError(null), [])

  const value: WalletContextValue = {
    status,
    loadStatus,
    modal,
    error,
    holdings,
    holdingsLoading,
    holdingsHasLoaded,
    pendingTransfers,
    pendingTransfersLoading,
    pendingTransfersHasLoaded,
    refreshStatus,
    refreshHoldings,
    refreshPendingTransfers,
    setup,
    restore,
    destroy,
    exportKey,
    runFaucet,
    transfer,
    acceptPending,
    rejectPending,
    openSetup,
    closeSetup,
    openRestore,
    closeRestore,
    openAccountInfo,
    closeAccountInfo,
    openExportKey,
    closeExportKey,
    openDestroy,
    closeDestroy,
    openFaucet,
    closeFaucet,
    openSend,
    closeSend,
    clearError
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
