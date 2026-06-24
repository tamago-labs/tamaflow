import { ElectronAPI } from '@electron-toolkit/preload'

export type ModelSourceKind = 'http' | 'https' | 'registry' | 'file'

export interface ModelEntry {
  id: string
  name: string
  source: string
  sourceKind: ModelSourceKind
  size?: number
  quantization?: string
  params?: string
  description?: string
  createdAt: string
  builtin?: boolean
}

export interface ModelLoadProgress {
  phase: 'downloading' | 'loading'
  downloaded: number
  total: number
  percentage: number
  requestId?: string
}

export interface ModelErrorPayload {
  code: string
  message: string
  retryable: boolean
}

export interface ModelStatus {
  active: {
    id: string | null
    name: string
    source: string
    sourceKind: ModelSourceKind | null
    loaded: boolean
    requestId: string | null
    loadedAt: number | null
  }
  lastSelectedId: string | null
  available: ModelEntry[]
}

export interface ModelsAPI {
  list: () => Promise<ModelEntry[]>
  add: (entry: {
    name: string
    source: string
    description?: string
    quantization?: string
    params?: string
  }) => Promise<ModelEntry>
  remove: (id: string) => Promise<boolean>
  select: (id: string) => Promise<{ success: boolean; error?: string }>
  cancel: (opts?: { clearCache?: boolean }) => Promise<{ success: boolean }>
  resetCache: (id: string) => Promise<{ success: boolean; deleted: string[]; error?: string }>
  status: () => Promise<ModelStatus>
  pickFile: () => Promise<string | null>
  onProgress: (callback: (p: ModelLoadProgress) => void) => () => void
  onError: (callback: (e: ModelErrorPayload) => void) => () => void
}

export interface AIStatus {
  isReady: boolean
  modelName: string
  uptime: number
  downloading: boolean
  downloadProgress: number
}

export interface WalletStatus {
  exists: boolean
  encryptionAvailable: boolean
  partyId?: string
  partyHint?: string
  fingerprint?: string
  publicKey?: string
  createdAt?: string
  filePath: string
}

export interface WalletCreateResult {
  success: boolean
  partyId?: string
  fingerprint?: string
  error?: string
  errorCode?: 'OS_KEYCHAIN_UNAVAILABLE' | 'SDK_ERROR' | 'AUTH_ERROR'
}

export interface Holding {
  contractId: string
  instrumentId: string
  symbol: string
  amount: string
  lockedAmount?: string
}

export interface FaucetResult {
  success: boolean
  txHash?: string
  amount?: string
  error?: string
}

export interface WalletAPI {
  status: () => Promise<WalletStatus>
  create: () => Promise<WalletCreateResult>
  destroy: () => Promise<{ success: boolean }>
  exportKey: () => Promise<{ success: boolean; privateKey?: string; error?: string }>
  holdings: () => Promise<Holding[]>
  faucet: (amount?: string) => Promise<FaucetResult>
  onChange: (callback: () => void) => () => void
}

export interface TamaflowAPI {
  models: ModelsAPI
  ai: {
    getStatus: () => Promise<AIStatus>
    unload: () => Promise<{ success: boolean; error?: string }>
  }
  wallet: WalletAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: TamaflowAPI
  }
}
