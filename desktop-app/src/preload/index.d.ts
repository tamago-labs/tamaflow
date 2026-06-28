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

// ============================================
// Company profile (employer onboarding)
// ============================================

/** ISO-like country code for the four supported operating jurisdictions. */
export type CountryCode = 'JP' | 'TH' | 'US-DE' | 'VG'

/** Accounting / display currency for the company. */
export type CurrencyCode = 'JPY' | 'THB' | 'USD' | 'EUR'

/** Legal entity classification used for tax form generation downstream. */
export type LegalEntityType =
  | 'corporation'
  | 'limited_company'
  | 'partnership'
  | 'non_profit'
  | 'other'

/** Settlement-currency closed allowlist. MVP is Canton Coin only —
 *  future options (stablecoins, fiat-backed tokens, etc.) will land here. */
export type SettlementCurrency = 'CC'

/**
 * The employer profile. Persisted at `<userData>/company.json` (plain JSON,
 * NOT encrypted — these are non-secret business metadata).
 */
export interface CompanyProfile {
  companyName: string
  country: CountryCode
  baseCurrency: CurrencyCode
  legalEntityType: LegalEntityType
  /** Canton Coin in MVP. See `SettlementCurrency` for future expansion. */
  settlementCurrency: SettlementCurrency
  /**
   * Recurring annual date (month + day) when the company's fiscal year
   * starts, in `MM-DD` format (e.g. "01-01" = calendar year,
   * "04-01" = Japan-style April start). Drives how payroll reports are
   * grouped for tax / accounting purposes. Optional for MVP — falls
   * back to calendar year when absent.
   */
  fiscalYearStart?: string
  /** ISO-8601. */
  createdAt: string
  /** ISO-8601. */
  updatedAt: string
}

/** Versioned on-disk envelope (mirrors `ModelRegistryFile`). */
export interface CompanyFile {
  version: 1
  profile: CompanyProfile
}

/** Result of an Export / Import operation. */
export interface CompanyExportResult {
  success: boolean
  canceled?: boolean
  path?: string
  error?: string
}

export interface CompanyImportResult {
  success: boolean
  canceled?: boolean
  file?: CompanyFile
  error?: string
}

export interface CompanyAPI {
  /** Returns the on-disk profile (or `null` if not set up). */
  get: () => Promise<CompanyFile | null>
  /** Validates + writes. Throws on validation failure. */
  save: (profile: CompanyProfile) => Promise<CompanyFile>
  /** Opens an OS save dialog and writes the profile JSON. */
  exportJson: () => Promise<CompanyExportResult>
  /** Opens an OS open dialog and parses the file (does NOT save). */
  importJson: () => Promise<CompanyImportResult>
  /** Recovery hatch for corrupt files — deletes the on-disk profile. */
  reset: () => Promise<{ success: boolean }>
  /** Fires after every `save` and `reset`. Returns an unsubscribe fn. */
  onChange: (callback: (file: CompanyFile | null) => void) => () => void
}

// ============================================
// Employees (people the employer pays)
// ============================================

/** Closed-allowlist employee relationship types. */
export type EmployeeType = 'employee' | 'contractor' | 'other'

/** Pay cadence. Drives which amount field is required. */
export type PayFrequency = 'monthly' | 'biweekly' | 'weekly' | 'hourly' | 'one-off'

/** Roster status. Drives list-row badge + filtering. */
export type EmployeeStatus = 'active' | 'paused' | 'terminated'

/**
 * Whether the employee is paid under the company's home jurisdiction
 * ("inside") or somewhere else ("outside").
 *
 *   - **inside_jurisdiction** — the employee is treated as part of the
 *     company's home country for tax / compliance purposes. Their country
 *     and compensation currency are inherited from the company profile
 *     at display time and are NOT stored on the employee. If the company
 *     later moves jurisdiction, all "inside" employees move with it.
 *
 *   - **outside_jurisdiction** — the employee is paid cross-border. Both
 *     `country` and `payCurrency` are required and stored on the
 *     employee; they do NOT track the company's home country.
 */
export type EmploymentLocation = 'inside_jurisdiction' | 'outside_jurisdiction'

/**
 * One person in the employer roster. Persisted at `<userData>/employees.json`
 * as part of an `EmployeeFile` envelope (plain JSON, NOT encrypted — these
 * are non-secret business records, same policy as the company profile).
 */
export interface Employee {
  /** Stable id (`e_<base36 ts>_<base36 rand>`, generated by store on save). */
  id: string
  /** Required, 1-200 chars. */
  displayName: string
  /** Optional, RFC-lite validation when present. */
  email?: string
  type: EmployeeType
  /** Optional free-text role (e.g. "Senior Engineer"), <=100 chars. */
  role?: string
  /**
   * Whether the employee is paid under the company's home jurisdiction
   * (country + base currency inherited from the company profile) or
   * cross-border (country + compensation currency set explicitly).
   */
  employmentLocation: EmploymentLocation
  /**
   * ISO 3166-1 alpha-2 country code (e.g. "JP", "TH", "US", "GB") where the
   * employee resides / works. ONLY set when `employmentLocation ===
   * 'outside_jurisdiction'`. For inside-jurisdiction employees the country
   * is derived from the company profile at display time. Open-ended on
   * purpose — the company may pay people anywhere in the world. The
   * renderer ships a full ISO list for the picker; the store accepts any
   * non-empty string <=64 chars.
   */
  country?: string
  /**
   * Contractual compensation currency (e.g. "JPY" for 250,000 JPY / month).
   * ONLY set when `employmentLocation === 'outside_jurisdiction'`; for
   * inside-jurisdiction employees it's inherited from `company.baseCurrency`
   * at display time. Independent of where the employee lives and of the
   * settlement currency (always CC) — payroll is converted from this amount
   * to CC at payment time. Closed allowlist in MVP; will open up alongside
   * multi-currency wallet support.
   */
  payCurrency?: CurrencyCode
  /** Decimal string ("5000.00"). Required unless `payFrequency === 'hourly'`. */
  salaryAmount?: string
  payFrequency: PayFrequency
  /** Decimal string. Required when `payFrequency === 'hourly'`. */
  hourlyRate?: string
  /** Optional recipient partyId for payroll transfers. Free-form for MVP. */
  cantonPartyId?: string
  status: EmployeeStatus
  /** ISO-8601 (YYYY-MM-DD). */
  startDate?: string
  /** ISO-8601 (YYYY-MM-DD). Required when status === 'terminated'. */
  endDate?: string
  /** Optional memo, <=500 chars. */
  note?: string
  /** ISO-8601 timestamp. Stamped by store on first save. */
  createdAt: string
  /** ISO-8601 timestamp. Restamped by store on every save. */
  updatedAt: string
}

/** Versioned on-disk envelope (mirrors `CompanyFile`). */
export interface EmployeeFile {
  version: 1
  employees: Employee[]
}

/** Result of an Export / Import operation. */
export interface EmployeeExportResult {
  success: boolean
  canceled?: boolean
  path?: string
  error?: string
}

/** Counts surfaced by the import preview so the user sees the impact. */
export interface EmployeeImportDiff {
  toAdd: number
  toUpdate: number
  toSkip: number
  /** Number of existing rows that would be removed under "Replace" mode. */
  willBeRemoved: number
}

export interface EmployeeImportResult {
  success: boolean
  canceled?: boolean
  file?: EmployeeFile
  error?: string
  diff?: EmployeeImportDiff
}

export interface EmployeeAPI {
  /** Returns the on-disk file (or `null` if no roster exists yet). */
  get: () => Promise<EmployeeFile | null>
  /** Validates + writes the WHOLE list (replace semantics). */
  save: (employees: Employee[]) => Promise<EmployeeFile>
  /** Per-employee destructive; returns the post-removal file. */
  remove: (id: string) => Promise<EmployeeFile | null>
  /** Opens an OS save dialog and writes the roster JSON. */
  exportJson: () => Promise<EmployeeExportResult>
  /** Opens an OS open dialog, parses + computes a diff against the
   *  current roster (if any). Does NOT save — caller decides. */
  importJson: () => Promise<EmployeeImportResult>
  /** Recovery hatch — deletes the on-disk roster. */
  reset: () => Promise<{ success: boolean }>
  /** Fires after every save/remove/reset. Returns an unsubscribe fn. */
  onChange: (callback: (file: EmployeeFile | null) => void) => () => void
}

export interface TamaflowAPI {
  models: ModelsAPI
  ai: {
    getStatus: () => Promise<AIStatus>
    unload: () => Promise<{ success: boolean; error?: string }>
  }
  wallet: WalletAPI
  company: CompanyAPI
  employees: EmployeeAPI
  flows: FlowAPI
}

// ============================================
// Flows (payroll flow builder)
// ============================================

/**
 * Optional run schedule attached to a flow. Phase 7 will auto-submit
 * scheduled flows; Phase 2 only persists the field — the worker ignores
 * it for now.
 */
export interface FlowSchedule {
  mode: 'manual' | 'scheduled'
  /** ISO-8601. Required when mode === 'scheduled'. */
  runAt?: string
}

/**
 * A payroll flow definition — the canvas content plus identifying
 * metadata. Persisted at `<userData>/flows/<id>.json` inside a
 * `FlowFile` envelope.
 *
 * `cards` and `connections` mirror the renderer's `CanvasState` 1:1
 * so the renderer can hydrate directly without reshaping.
 */
export interface FlowDefinition {
  /** Stable id (`flow_<base36 ts>_<base36 rand>`, generated by store). */
  id: string
  name: string
  cards: CanvasCard[]
  connections: Connection[]
  schedule?: FlowSchedule
  /** ISO-8601, stamped by store on first save. */
  createdAt: string
  /** ISO-8601, restamped by store on every save. */
  updatedAt: string
}

/** Versioned on-disk envelope (mirrors `CompanyFile`, `EmployeeFile`). */
export interface FlowFile {
  version: 1
  flow: FlowDefinition
}

/** Summary row shape used by the Active Flows list (avoid sending the
 *  full card list to the renderer just to render a table). */
export interface FlowSummary {
  id: string
  name: string
  /** Counts derived from the stored canvas. */
  cardCount: number
  /** Payee card count — drives the "N recipients" badge. */
  payeeCount: number
  /** Transfer card count — drives the "N rules" badge. */
  transferCount: number
  schedule?: FlowSchedule
  createdAt: string
  updatedAt: string
}

/**
 * Minimal canvas shapes shared with the flow-builder renderer. These
 * mirror the renderer's `CanvasCard` and `Connection` types but live
 * in the preload type surface so main-process IPC payloads stay typed.
 */
export interface CanvasCard {
  placementId: string
  category: 'source' | 'payee' | 'transfer'
  transferVariant?: 'contractor' | 'employee'
  title: string
  tone: 'blue' | 'teal' | 'navy' | 'muted'
  x: number
  y: number
  collapsed: boolean
  // Field shapes — kept loose on the wire so main never has to know
  // about the renderer's edit form. Validation is enforced on the way
  // back IN (in `FlowStore.validateCanvasCard`).
  sourceFields?: Record<string, unknown>
  payeeFields?: Record<string, unknown>
  contractorTransferFields?: Record<string, unknown>
  employeeTransferFields?: Record<string, unknown>
}

export interface Connection {
  id: string
  from: string
  to: string
}

export interface FlowAPI {
  /** Lightweight summaries for the Active Flows list. */
  list: () => Promise<FlowSummary[]>
  /** Full flow file (or `null` if the id is unknown). */
  get: (id: string) => Promise<FlowFile | null>
  /**
   * Validate + write. `id` is generated by main when the incoming flow
   * has no id (i.e. a brand-new draft). Returns the persisted file.
   */
  save: (
    flow: Omit<FlowDefinition, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string
      createdAt?: string
      updatedAt?: string
    }
  ) => Promise<FlowFile>
  /** Per-flow destructive. Returns the post-removal summary list. */
  remove: (id: string) => Promise<FlowSummary[]>
  /** Fires after every save / remove. Returns an unsubscribe fn. */
  onChange: (callback: (list: FlowSummary[]) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: TamaflowAPI
  }
}
