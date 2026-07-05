// Renderer-side source of truth for the Canton wallet state.
//
// Tamaflow v1 surface: status / create / destroy / exportKey + the
// four modals (Setup, AccountInfo, ExportKey, ConfirmDestroy). The
// old payroll surface (holdings / faucet / transfer / accept) is
// dropped — the project no longer runs the flow-canvas payroll
// system.
//
// Subscribes to `wallet:onChange` push events from the main process
// (fired whenever wallet.json is created/destroyed). Exposes a small
// state machine + action API the rest of the UI consumes.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { bridge } from '../lib/bridge'
import type { WalletStatus } from '../lib/bridge'

type Status = 'absent' | 'present' | 'creating' | 'error'

interface ModalState {
  setupOpen: boolean
  accountInfoOpen: boolean
  exportKeyOpen: boolean
  destroyOpen: boolean
  /** Populated when the user opens Export; rendered by ExportKeyModal. */
  exportKeyValue: string | null
}

interface WalletContextValue {
  status: WalletStatus | null
  loadStatus: Status
  modal: ModalState
  error: string | null
  refreshStatus: () => Promise<void>
  setup: (opts?: { partyHint?: string }) => Promise<{
    success: boolean
    partyId?: string
    fingerprint?: string
    error?: string
  }>
  destroy: () => Promise<void>
  exportKey: () => Promise<void>
  openSetup: () => void
  closeSetup: () => void
  openAccountInfo: () => void
  closeAccountInfo: () => void
  openExportKey: () => void
  closeExportKey: () => void
  openDestroy: () => void
  closeDestroy: () => void
  clearError: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

const defaultModal: ModalState = {
  setupOpen: false,
  accountInfoOpen: false,
  exportKeyOpen: false,
  destroyOpen: false,
  exportKeyValue: null
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus | null>(null)
  const [loadStatus, setLoadStatus] = useState<Status>('absent')
  const [modal, setModal] = useState<ModalState>(defaultModal)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const refreshStatus = useCallback(async () => {
    try {
      const s = await bridge.wallet.status()
      if (!mounted.current) return
      setStatus(s)
      setLoadStatus(s.exists ? 'present' : 'absent')
    } catch (e) {
      console.error('[WalletContext] status failed:', e)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    refreshStatus()
    const off = bridge.wallet.onChange(() => {
      if (!mounted.current) return
      refreshStatus()
    })
    return () => {
      mounted.current = false
      off()
    }
  }, [refreshStatus])

  const setup = useCallback(async (opts?: { partyHint?: string }) => {
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
  }, [])

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

  const openSetup = useCallback(() => setModal((m) => ({ ...m, setupOpen: true })), [])
  const closeSetup = useCallback(() => setModal((m) => ({ ...m, setupOpen: false })), [])
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
  const clearError = useCallback(() => setError(null), [])

  const value: WalletContextValue = {
    status,
    loadStatus,
    modal,
    error,
    refreshStatus,
    setup,
    destroy,
    exportKey,
    openSetup,
    closeSetup,
    openAccountInfo,
    closeAccountInfo,
    openExportKey,
    closeExportKey,
    openDestroy,
    closeDestroy,
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
