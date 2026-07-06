// Shared type surface for the Phase-5 local-AI feature. Imported by
// `bridge.ts`, `useAI.ts`, `AIModelModal.tsx`, and `CanvasFooter.tsx`.
//
// These mirror `electron/qvac.d.ts` and `electron/modelStore.d.ts` but
// are renderer-side: no Node-only types, all fields user-visible.

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

export interface ModelAddInput {
  name: string
  source: string
  description?: string
  quantization?: string
  params?: string
}

export interface AiStatusShim {
  isReady: boolean
  modelName: string
  uptime: number
  downloading: boolean
  downloadProgress: number
}

/**
 * Per-load model configuration. Mirrors the values shown in the
 * AIModal Config tab. `ctx_size` controls the
 * llama.cpp context window in tokens; `tools` enables Qwen's
 * tool-calling surface (gated by the SDK's `tools` flag inside
 * `buildModelConfig`).
 *
 * Persisted in `<userData>/models.json>` under the `aiConfig` key so
 * the pick survives reloads.
 */
export interface AiConfig {
  ctx_size: 2048 | 4096 | 8192
  tools: boolean
}

export const DEFAULT_AI_CONFIG: AiConfig = { ctx_size: 4096, tools: false }

export const CTX_SIZE_OPTIONS: ReadonlyArray<AiConfig['ctx_size']> = [2048, 4096, 8192]

// ──────────────────────────── Phase 6: AI chat ────────────────────────────

/**
 * A single message in an AI chat session. The shape is renderer-
 * owned; the main process stores it as JSON and the SDK sees only
 * the `role` + `content` fields.
 *
 * `thinking` is the model's reasoning (captured via the SDK's
 * `captureThinking: true` flag and surfaced as `thinkingDelta`
 * events). Persisted alongside the message so reopening a session
 * shows the reasoning again.
 *
 * `modelId` + `modelName` record which model produced the turn
 * (only set on assistant messages in a multi-model setup).
 */
export interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  thinking?: string
  modelId?: string
  modelName?: string
}

/**
 * Metadata for one AI chat session. Computed from the on-disk layout
 * (`<userData>/sessions/<slug>/messages.json`); the directory
 * listing is the index.
 *
 * `pinned: true` for the `main` session, which is auto-created on
 * app boot and cannot be deleted (but can be cleared).
 */
export interface SessionMeta {
  slug: string
  createdAt: number
  lastActive: number
  messageCount: number
  pinned: boolean
}

/** What the SDK streams back. The renderer aggregates into a turn. */
export interface ChatTokenEvent {
  requestId: string
  text: string
}

export interface ChatThinkingEvent {
  requestId: string
  text: string
}

export interface ChatStatsEvent {
  requestId: string
  stats: {
    timeToFirstToken?: number
    tokensPerSecond?: number
    cacheTokens?: number
    promptTokens?: number
    generatedTokens?: number
    backendDevice?: 'cpu' | 'gpu'
  }
}

export interface ChatDoneEvent {
  requestId: string
  stopReason: 'cancelled' | 'eos' | 'length' | 'stopSequence' | 'error'
}

export interface ChatErrorEvent {
  requestId: string
  error: {
    code: string
    message: string
    retryable: boolean
  }
}

export interface ChatStatusEvent {
  isStreaming: boolean
  requestId: string | null
  startedAt: number | null
}

/**
 * Where the active AI chat is sourcing completions. Defaults to
 * `local` (per the user's locked-in decision 2 — never persist the
 * pick across launches). Phase 2 adds `peer` for routing to a
 * remote writer.
 */
export type AiSource =
  | { kind: 'local'; modelId: string; modelName: string }
  | { kind: 'peer'; writerKey: string; modelId: string; modelName: string; displayName?: string }

// ──────────────────────────── Employee roster ────────────────────────────

export type EmployeeType = 'employee' | 'contractor' | 'other'

export type PayFrequency = 'monthly' | 'biweekly' | 'weekly' | 'hourly' | 'one-off'

export type EmployeeStatus = 'active' | 'paused' | 'terminated'

export type CurrencyCode = 'JPY' | 'THB' | 'USD' | 'EUR'

export type CountryCode = 'JP' | 'TH' | 'US-DE' | 'VG'

export type LegalEntityType =
  | 'corporation'
  | 'limited_company'
  | 'partnership'
  | 'non_profit'
  | 'other'

export type SettlementCurrency = 'CC'

export interface Employee {
  id: string
  displayName: string
  email?: string
  type: EmployeeType
  role?: string
  country: string
  payCurrency: CurrencyCode
  salaryAmount?: string
  payFrequency: PayFrequency
  hourlyRate?: string
  cantonPartyId?: string
  status: EmployeeStatus
  startDate?: string
  endDate?: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface EmployeeFile {
  version: 1
  employees: Employee[]
}

export interface EmployeeExportResult {
  success: boolean
  canceled?: boolean
  path?: string
  error?: string
}

export interface EmployeeImportDiff {
  toAdd: number
  toUpdate: number
  toSkip: number
  willBeRemoved: number
}

export interface EmployeeImportResult {
  success: boolean
  canceled?: boolean
  file?: EmployeeFile
  error?: string
  diff?: EmployeeImportDiff
}

// ──────────────────────────── Company profile ────────────────────────────

export interface PaymentTemplate {
  id: string
  name: string
  withholdingRate: string
  defaultMemo: string
  createdAt: string
  updatedAt: string
}

export interface CompanyProfile {
  companyName: string
  country: CountryCode
  baseCurrency: CurrencyCode
  legalEntityType: LegalEntityType
  settlementCurrency: SettlementCurrency
  fiscalYearStart: string
  paymentTemplates?: PaymentTemplate[]
  directPaymentDefaultMemo?: string
  createdAt: string
  updatedAt: string
}

export interface CompanyFile {
  version: 1
  profile: CompanyProfile
}

// ──────────────────────────── Flows (payroll flow builder) ────────────────────────────

/**
 * Flow lifecycle. The worker drives status transitions.
 *   draft     — editable on the canvas; no routes have been settled yet.
 *   active    — the worker is settling routes; the canvas is locked.
 *   completed — all routes settled (or stopped/failed); the canvas is
 *               still locked but the flow is no longer being processed.
 */
export type FlowStatus = 'draft' | 'active' | 'completed'

/**
 * A payroll flow definition — the canvas content plus identifying
 * metadata. Persisted at `<userData>/flows/<id>.json` inside a
 * `FlowFile` envelope.
 */
export interface FlowDefinition {
  /** Stable id (`flow_<base36 ts>_<base36 rand>`, generated by store). */
  id: string
  name: string
  /** Lifecycle — defaults to `'draft'` when the field is missing. */
  status: FlowStatus
  cards: CanvasCard[]
  connections: Connection[]
  /** ISO-8601, stamped by store on first save. */
  createdAt: string
  /** ISO-8601, restamped by store on every save. */
  updatedAt: string
}

/** Versioned on-disk envelope. */
export interface FlowFile {
  version: 1
  flow: FlowDefinition
}

/**
 * A payroll route — one per Payee card on the canvas, walked through
 * the worker one at a time. Status walk:
 * `pending → computing → converting → signing → sending → settled`
 * (or → `failed` at any step).
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

/** Lightweight row shape — used by the Active Flows page and routes table. */
export interface RouteSummary {
  id: string
  /** Flow this route belongs to. */
  flowId: string
  status: FlowOutcomeStatus
  employeeId: string
  payeePlacementId: string
  sourcePlacementId: string
  /** Payment card on the canvas that produced this route. */
  paymentPlacementId: string
  /** CC amount (10dp decimal string). */
  amountCC: string
  payCurrency: CurrencyCode
  /** Echo of the gross pay (in payCurrency) BEFORE deductions. */
  grossPay: string
  /** FX rate applied (CC per 1 unit of payCurrency). */
  fxRate?: string
  /** Withholding amount (in payCurrency, 2dp). */
  withholdingAmount?: string
  /** Social-security amount (in payCurrency, 2dp). */
  socialSecurityAmount?: string
  recipientPartyId: string
  /** Baked-in transfer memo. */
  memo: string
  /** ISO-8601 — when the worker first materialised this route. */
  createdAt: string
  error?: string
  txHash?: string
  startedAt?: string
  completedAt?: string
}

/** Full route record — persisted on disk; superset of RouteSummary. */
export interface RouteRecord extends RouteSummary {
  flowId: string
}

/** Summary row shape used by the Active Flows list. */
export interface FlowSummary {
  id: string
  name: string
  /** Lifecycle — drives the Active vs Completed split + lock state. */
  status: FlowStatus
  /** Counts derived from the stored canvas. */
  cardCount: number
  /** Payee card count — drives the "N recipients" badge. */
  payeeCount: number
  /** Total routes persisted for this flow. */
  routeCount: number
  /** Routes with status === 'settled'. */
  settledCount: number
  /** Routes with status === 'failed'. */
  failedCount: number
  createdAt: string
  updatedAt: string
}

/** Minimal canvas shapes shared with the flow-builder renderer. */
export interface CanvasCard {
  id: string
  placementId: string
  category: 'source' | 'payee' | 'payment'
  title: string
  tone: 'blue' | 'teal' | 'navy' | 'muted'
  x: number
  y: number
  collapsed: boolean
  sourceFields?: { partyId: string; [key: string]: unknown }
  payeeFields?: { employeeId: string; [key: string]: unknown }
  paymentFields?: { templateId?: string; memo?: string; [key: string]: unknown }
}

export interface Connection {
  id: string
  from: string
  to: string
}
