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

export interface CompanyProfile {
  companyName: string
  country: CountryCode
  baseCurrency: CurrencyCode
  legalEntityType: LegalEntityType
  settlementCurrency: SettlementCurrency
  fiscalYearStart: string
  createdAt: string
  updatedAt: string
}

export interface CompanyFile {
  version: 1
  profile: CompanyProfile
}
