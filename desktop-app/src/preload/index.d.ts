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
}

export interface FaucetResult {
  success: boolean
  txHash?: string
  amount?: string
  error?: string
}

/** Parameters for a CC (Canton Coin) transfer. */
export interface TransferParams {
  /** Recipient partyId (e.g. "other-party::1220abcd…"). */
  recipient: string
  /** Human-readable amount, e.g. "100" (will be padded to 10 decimals). */
  amount: string
  /** Optional memo / reconciliation tag. */
  memo?: string
}

/** Result of a transfer attempt. */
export interface TransferResult {
  success: boolean
  /** Ledger updateId of the committed transaction, if successful. */
  updateId?: string
  /** Decimal-string amount that was sent, e.g. "100.0000000000". */
  amount?: string
  recipient?: string
  error?: string
}

/**
 * A pending incoming CC transfer visible to the wallet's party.
 * The `contractId` is the `TransferInstruction` contract id; the wallet
 * exercises `TransferInstruction_Accept` on it to claim the funds.
 */
export interface PendingTransfer {
  contractId: string
  sender: string
  receiver: string
  /** Numeric(10) decimal string (initial amount). */
  amount: string
  /** Instrument id (e.g. "Amulet"). */
  instrumentId: string
  /** ISO-8601 expiry — recipient must accept before this time. */
  executeBefore: string
  /** Optional reconciliation memo from the sender. */
  memo?: string
}

/**
 * Result of a recipient-side transfer action (accept or reject).
 */
export interface RecipientResult {
  success: boolean
  /** Ledger updateId of the committed transaction, if successful. */
  updateId?: string
  /** The `TransferInstruction` contract id we accepted / rejected. */
  contractId?: string
  error?: string
}

export interface WalletAPI {
  status: () => Promise<WalletStatus>
  create: (opts?: { partyHint?: string }) => Promise<WalletCreateResult>
  destroy: () => Promise<{ success: boolean }>
  exportKey: () => Promise<{ success: boolean; privateKey?: string; error?: string }>
  holdings: () => Promise<Holding[]>
  faucet: (amount?: string) => Promise<FaucetResult>
  transfer: (params: TransferParams) => Promise<TransferResult>
  pendingTransfers: () => Promise<PendingTransfer[]>
  accept: (contractId: string) => Promise<RecipientResult>
  reject: (contractId: string) => Promise<RecipientResult>
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
