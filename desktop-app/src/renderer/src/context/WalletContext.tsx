import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react'
import { useInterval } from 'usehooks-ts'
import type {
  WalletStatus,
  Holding,
  FaucetResult,
  TransferParams,
  TransferResult,
  PendingTransfer,
  RecipientResult,
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
  receiveOpen: boolean
  sendOpen: boolean
  exportKeyValue: string | null
}

interface WalletContextValue {
  status: WalletStatus | null
  loadStatus: Status
  holdings: Holding[]
  holdingsLoading: boolean
  /**
   * True once the initial `holdings()` IPC round-trip has resolved at
   * least once (success or empty result). Lets the UI distinguish
   * "still loading on first paint" from "loaded, value happens to be
   * 0" — without this flag the Dashboard tiles flash "0" during boot.
   * Reset to false when the wallet is destroyed or recreated.
   */
  holdingsHasLoaded: boolean
  pendingTransfers: PendingTransfer[]
  pendingTransfersLoading: boolean
  /**
   * Same as `holdingsHasLoaded` for the pending-transfers list. Used by
   * the Dashboard "Pending Offers" KPI tile.
   */
  pendingTransfersHasLoaded: boolean
  modal: ModalState
  /** Symbol the user is currently sending via the SendModal. */
  openSendSymbol: string | null
  error: string | null
  refreshStatus: () => Promise<void>
  refreshHoldings: () => Promise<void>
  refreshPendingTransfers: () => Promise<void>
  setup: (
    opts?: { partyHint?: string },
  ) => Promise<FaucetResult['success'] extends true ? void : { error?: string }>
  destroy: () => Promise<void>
  runFaucet: (amount?: string) => Promise<FaucetResult>
  transfer: (params: TransferParams) => Promise<TransferResult>
  acceptPending: (contractId: string) => Promise<RecipientResult>
  rejectPending: (contractId: string) => Promise<RecipientResult>
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
  openReceive: () => void
  closeReceive: () => void
  openSend: (symbol: string) => void
  closeSend: () => void
  clearError: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

const NOOP = () => undefined

/** Auto-refresh cadence for holdings + pending transfers (ms). */
const REFRESH_INTERVAL_MS = 30_000

const defaultModal: ModalState = {
  setupOpen: false,
  accountInfoOpen: false,
  faucetOpen: false,
  exportKeyOpen: false,
  destroyOpen: false,
  receiveOpen: false,
  sendOpen: false,
  exportKeyValue: null,
}

export function WalletProvider({
  children,
  enabled = true
}: {
  children: ReactNode
  enabled?: boolean
}) {
  const [status, setStatus] = useState<WalletStatus | null>(null)
  const [loadStatus, setLoadStatus] = useState<Status>('absent')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [holdingsLoading, setHoldingsLoading] = useState(false)
  const [holdingsHasLoaded, setHoldingsHasLoaded] = useState(false)
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([])
  const [pendingTransfersLoading, setPendingTransfersLoading] = useState(false)
  const [pendingTransfersHasLoaded, setPendingTransfersHasLoaded] = useState(false)
  const [modal, setModal] = useState<ModalState>(defaultModal)
  const [openSendSymbol, setOpenSendSymbol] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const refreshStatus = useCallback(async () => {
    if (!window.api?.wallet?.status) return
    try {
      const s = await window.api.wallet.status()
      if (!mounted.current) return
      setStatus(s)
      const next = s.exists ? 'present' : 'absent'
      setLoadStatus(next)
      // When the wallet is gone, cached holdings + pending lists are
      // stale; clear them and reset "has loaded" so the next mount of
      // a wallet re-runs the full first-paint loading sequence.
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
    if (!window.api?.wallet?.holdings) return
    setHoldingsLoading(true)
    try {
      const h = await window.api.wallet.holdings()
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
    if (!window.api?.wallet?.pendingTransfers) return
    setPendingTransfersLoading(true)
    try {
      const list = await window.api.wallet.pendingTransfers()
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

    const off = window.api.wallet.onChange(() => {
      if (!mounted.current) return
      refreshStatus()
      // Holdings + pending transfers only need to be in sync while the
      // app is mounted (i.e. past the company / model gates). Skipping
      // them here avoids burning Canton SDK round-trips during boot.
      if (enabled) {
        refreshHoldings()
        refreshPendingTransfers()
      }
    })

    return () => {
      mounted.current = false
      off()
    }
  }, [refreshStatus, refreshHoldings, refreshPendingTransfers, enabled])

  // When a wallet becomes present for the first time AND we're in the
  // routed app, fetch holdings. Skipping the fetch during boot avoids
  // initialising the Canton SDK (network round-trip to the validator)
  // before the user is even past the company / model gates.
  useEffect(() => {
    if (loadStatus === 'present' && enabled) {
      refreshHoldings()
      refreshPendingTransfers()
    }
  }, [loadStatus, enabled, refreshHoldings, refreshPendingTransfers])

  // Periodic auto-refresh of holdings + pending transfers. The delay is
  // `null` while the wallet isn't ready OR the app isn't mounted, so
  // the timer pauses — never fires during the boot gates. Centralised
  // here so every page that reads from this context gets fresh data
  // without each mounting its own setInterval.
  const walletReady = loadStatus === 'present' && enabled
  useInterval(
    () => {
      void refreshHoldings()
      void refreshPendingTransfers()
    },
    walletReady ? REFRESH_INTERVAL_MS : null,
  )

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

  const transfer = useCallback(
    async (params: TransferParams): Promise<TransferResult> => {

      console.log("at use context...")

      if (!window.api?.wallet?.transfer) {
        return { success: false, error: 'Not available' }
      }

       console.log("before api wallet ...")

      setError(null)
      const r = await window.api.wallet.transfer(params)

      console.log("r:", r)

      if (!mounted.current) return r
      if (!r.success) setError(r.error ?? 'Transfer failed')
      return r
    },
    [],
  )

  const acceptPending = useCallback(
    async (contractId: string): Promise<RecipientResult> => {
      if (!window.api?.wallet?.accept) {
        return { success: false, error: 'Not available' }
      }
      setError(null)
      const r = await window.api.wallet.accept(contractId)
      if (!mounted.current) return r
      if (!r.success) {
        setError(r.error ?? 'Accept failed')
      } else {
        // Refresh both the pending list (row disappears) and holdings
        // (the accepted CC lands in the wallet).
        refreshPendingTransfers()
        refreshHoldings()
      }
      return r
    },
    [refreshHoldings, refreshPendingTransfers],
  )

  const rejectPending = useCallback(
    async (contractId: string): Promise<RecipientResult> => {
      if (!window.api?.wallet?.reject) {
        return { success: false, error: 'Not available' }
      }
      setError(null)
      const r = await window.api.wallet.reject(contractId)
      if (!mounted.current) return r
      if (!r.success) {
        setError(r.error ?? 'Reject failed')
      } else {
        // Refresh the pending list only — reject doesn't change our balance.
        refreshPendingTransfers()
      }
      return r
    },
    [refreshPendingTransfers],
  )

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
  const openReceive = useCallback(
    () => setModal((m) => ({ ...m, receiveOpen: true })),
    [],
  )
  const closeReceive = useCallback(
    () => setModal((m) => ({ ...m, receiveOpen: false })),
    [],
  )
  const openSend = useCallback((symbol: string) => {
    setOpenSendSymbol(symbol)
    setModal((m) => ({ ...m, sendOpen: true }))
  }, [])
  const closeSend = useCallback(() => {
    setModal((m) => ({ ...m, sendOpen: false }))
    setOpenSendSymbol(null)
  }, [])
  const clearError = useCallback(() => setError(null), [])

  // Provide safe no-op defaults for the rare Server-Component reach.
  const value: WalletContextValue = {
    status,
    loadStatus,
    holdings,
    holdingsLoading,
    holdingsHasLoaded,
    pendingTransfers,
    pendingTransfersLoading,
    pendingTransfersHasLoaded,
    modal,
    openSendSymbol,
    error,
    refreshStatus,
    refreshHoldings,
    refreshPendingTransfers,
    setup,
    destroy,
    runFaucet,
    transfer,
    acceptPending,
    rejectPending,
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
    openReceive: openReceive ?? NOOP,
    closeReceive: closeReceive ?? NOOP,
    openSend: openSend ?? NOOP,
    closeSend: closeSend ?? NOOP,
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
