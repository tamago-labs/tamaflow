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
 * A user-defined payment template. Each record becomes its own palette
 * tile on the flow canvas (under the fixed Direct Payment tile). The
 * Payment card on the canvas references one via `PaymentFields
 * .templateId`; if that template is deleted while a flow still uses
 * it, the route silently falls back to the built-in Direct Payment
 * (no deductions) and surfaces a stale-template warning.
 *
 * Withholding + SS are applied at compute time from the rates above.
 * There is no country-based skip rule — the flow's card composition
 * (which template is wired to which Payee) is authoritative.
 */
export interface PaymentTemplate {
  /** Stable id, generated on insert (e.g. "tpl_<uuid>"). */
  id: string
  /** Palette tile label (user-editable). */
  name: string
  /** Single combined deduction rate as a decimal string (e.g. "0.27"
   *  for 27%). Empty = no deductions applied. Absorbs the previously
   *  separate social-security rate — both halves of payroll tax now
   *  roll into this one field. */
  withholdingRate: string
  /** Required, ≤ 200 chars. Baked into the route when the Payment
   *  card's own memo is empty. */
  defaultMemo: string
  /** ISO-8601 — when the user added this template. */
  createdAt: string
  /** ISO-8601 — last edit. */
  updatedAt: string
}

/**
 * Sentinel id for the built-in Direct Payment tile. Stored in
 * `PaymentFields.templateId` only when the user explicitly wants to
 * pin it (undefined also resolves to Direct Payment — this is purely
 * a documentation aid / future-proofing hook).
 */
export const DIRECT_PAYMENT_TEMPLATE_ID = 'direct'

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
  /** User-defined payment templates — each becomes a palette tile.
   *  Direct Payment is built-in and is NOT stored here. */
  paymentTemplates: PaymentTemplate[]

  /** Optional default memo for Direct Payment cards. Empty by default
   *  — Direct Payment has no template so the user has to set the memo
   *  per-card (or here once). The Routes preview surfaces a "blank
   *  memo" warning when both are empty. */
  directPaymentDefaultMemo?: string
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
   * ISO 3166-1 alpha-2 country code (e.g. "JP", "TH", "US", "GB") where the
   * employee resides / works. Always set — required on every row, regardless
   * of whether the employee lives in the same country as the company.
   * Open-ended on purpose — the company may pay people anywhere in the
   * world. The renderer ships a full ISO list for the picker; the store
   * accepts any non-empty string <=64 chars.
   */
  country: string
  /**
   * Contractual compensation currency (e.g. "JPY" for 250,000 JPY / month).
   * Always set — required on every row. Independent of where the employee
   * lives and of the settlement currency (always CC) — payroll is converted
   * from this amount to CC at payment time. Closed allowlist in MVP; will
   * open up alongside multi-currency wallet support.
   *
   * Withholding + SS on the linked PaymentTemplate apply whenever the
   * template has non-zero rates — the user's card composition is
   * authoritative; we no longer skip deductions for cross-border
   * employees.
   */
  payCurrency: CurrencyCode
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
 * Flow lifecycle. Phase 2 ignored this; the worker drives it now.
 *   draft     — editable on the canvas; no routes have been settled yet.
 *   active    — the worker is settling routes; the canvas is locked.
 *   completed — all routes settled (or stopped/failed); the canvas is
 *               still locked but the flow is no longer being processed.
 *
 * v.1 runs flows immediately on Start (no scheduling). Adding a future
 * schedule mode would mean a new field on `FlowDefinition` and a
 * worker-side delay — punted to keep the v.1 surface minimal.
 */
export type FlowStatus = 'draft' | 'active' | 'completed'

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
  /** Lifecycle — defaults to `'draft'` when the field is missing (legacy
   *  flows persisted before this field existed). */
  status: FlowStatus
  cards: CanvasCard[]
  connections: Connection[]
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

/**
 * A payroll route — one per Payee card on the canvas, walked through
 * the worker one at a time. Persisted at
 * `<userData>/flows/<flowId>/routes/<id>.json`.
 *
 * The status walk: `pending → computing → converting → signing → sending → settled`
 * (or → `failed` at any step). `memoized` is reserved for the Phase 5
 * AI memo follow-up; the renderer/worker treat it as terminal like settled.
 */
export type FlowOutcomeStatus =
  | 'pending'
  | 'computing'
  | 'converting'
  | 'signing'
  | 'sending'
  | 'settled'
  | 'failed'
  | 'memoized'

/** Lightweight row shape — used by the Active Flows page (per-flow
 *  progress badge) and the routes table on FlowDetail. */
export interface RouteSummary {
  id: string
  /** Flow this route belongs to — convenient for the per-row label. */
  flowId: string
  status: FlowOutcomeStatus
  employeeId: string
  payeePlacementId: string
  sourcePlacementId: string
  /** Payment card on the canvas that produced this route. */
  paymentPlacementId: string
  /** CC amount (10dp decimal string) — what actually hits the ledger. */
  amountCC: string
  payCurrency: CurrencyCode
  /** Echo of the gross pay (in payCurrency) BEFORE deductions. */
  grossPay: string
  /** FX rate applied (CC per 1 unit of payCurrency). */
  fxRate?: string
  /** Withholding amount (in payCurrency, 2dp). Empty when not applied. */
  withholdingAmount?: string
  /** Social-security amount (in payCurrency, 2dp). Empty when not applied. */
  socialSecurityAmount?: string
  recipientPartyId: string
  /** Baked-in transfer memo (Payment.memo || template.defaultMemo ||
   *  company.directPaymentDefaultMemo). Empty when none of those are
   *  set — the worker surfaces this as a warning before settling. */
  memo: string
  /** ISO-8601 — when the worker first materialised this route. */
  createdAt: string
  error?: string
  txHash?: string
  startedAt?: string
  completedAt?: string
}

/** Full route record — persisted on disk; superset of RouteSummary with
 *  the flow-scoped metadata. */
export interface RouteRecord extends RouteSummary {
  flowId: string
}

/** Summary row shape used by the Active Flows list (avoid sending the
 *  full card list to the renderer just to render a table). */
export interface FlowSummary {
  id: string
  name: string
  /** Lifecycle — drives the Active vs Completed split + lock state. */
  status: FlowStatus
  /** Counts derived from the stored canvas. */
  cardCount: number
  /** Payee card count — drives the "N recipients" badge. */
  payeeCount: number
  /** Total routes persisted for this flow (from RouteStore). */
  routeCount: number
  /** Routes with status === 'settled'. Drives "2/4 settled" badge. */
  settledCount: number
  /** Routes with status === 'failed'. */
  failedCount: number
  createdAt: string
  updatedAt: string
}

/**
 * Minimal canvas shapes shared with the flow-builder renderer. These
 * mirror the renderer's `CanvasCard` and `Connection` types but live
 * in the preload type surface so main-process IPC payloads stay typed.
 *
 * Three card categories: `source` (treasury wallet), `payee` (employee
 * to be paid), `payment` (terminal node — the actual on-ledger transfer).
 * Field shapes are loose envelopes on the wire so main never has to know
 * about the renderer's edit form. Validation is enforced on the way
 * back IN (in `FlowStore.validateCanvasCard`).
 */
export interface CanvasCard {
  placementId: string
  category: 'source' | 'payee' | 'payment'
  title: string
  tone: 'blue' | 'teal' | 'navy' | 'muted'
  x: number
  y: number
  collapsed: boolean
  sourceFields?: Record<string, unknown>
  payeeFields?: Record<string, unknown>
  paymentFields?: Record<string, unknown>
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

  /**
   * Flip a draft flow to 'active' so the worker starts settling routes.
   * Persists all routes from the canvas up front (status='pending') so
   * the route table is populated even before the worker picks them up.
   * Returns `{ ok: true }` or `{ ok: false, error }` on validation /
   * missing-wallet failures.
   */
  start: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
  /**
   * Stop an active flow. Any in-flight route flips to 'failed' with
   * `error = 'Stopped by user'`; remaining 'pending' routes stay
   * pending (so re-start picks them up). Status flips back to 'draft'.
   */
  stop: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>

  routes: {
    /** All routes for a flow, sorted by createdAt asc. */
    list: (flowId: string) => Promise<RouteSummary[]>
    /**
     * Every route across every flow, sorted by `completedAt` desc
     * (fallback to `createdAt` desc). Powers the Settlement History
     * page — no status filter at the IPC layer so the renderer can
     * slice it however it needs.
     */
    listAll: () => Promise<RouteSummary[]>
    /** One full route record (or null). */
    get: (flowId: string, routeId: string) => Promise<RouteRecord | null>
  }

  /** Fires after every save / remove / start / stop / status change. */
  onChange: (callback: (list: FlowSummary[]) => void) => () => void
  /**
   * Fires on every route status transition (worker tick). The renderer
   * subscribes to keep the route table + Active Flows progress badge
   * live without polling.
   */
  onProgress: (
    callback: (flowId: string, routes: RouteSummary[]) => void
  ) => () => void
}

// ============================================
// P2P Worker bridge (mirrors v2's BridgeAPI)
// ============================================

export interface BridgeAPI {
  startWorker(specifier: string): Promise<boolean>
  joinWithInvite(invite: string): Promise<{ success: boolean }>
  writeWorkerIPC(specifier: string, data: string): Promise<void>
  onWorkerIPC(specifier: string, listener: (data: Uint8Array) => void): () => void
  onWorkerExit(specifier: string, listener: (code: number | null) => void): () => void
  onWorkerStdout(specifier: string, listener: (data: Uint8Array) => void): () => void
  onWorkerStderr(specifier: string, listener: (data: Uint8Array) => void): () => void
  aiSourcePeers(): Promise<Array<{
    writerKey: string
    modelId: string | null
    modelName: string | null
    loadedAt: number | null
    accepting: boolean
  }>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: TamaflowAPI
    bridge: BridgeAPI
  }
}
