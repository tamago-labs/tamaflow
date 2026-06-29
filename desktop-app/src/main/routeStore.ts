import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync, readdirSync } from 'fs'
import type {
  FlowOutcomeStatus,
  RouteRecord,
  RouteSummary
} from '../preload/index.d'

/**
 * Per-route persistence for payroll flows.
 *
 * Mirrors the `FlowStore` pattern (one JSON file per record, atomic
 * write via `.tmp` + `rename`, strict validation, plain JSON) but the
 * layout is per-flow:
 *
 *   <userData>/flows/<flowId>/routes/<routeId>.json
 *
 * Rationale for the per-flow sub-directory:
 *   - Routes are only meaningful in the context of a flow (the worker
 *     reads/writes them one flow at a time during a tick).
 *   - Deleting a flow (along with all its routes) is a single
 *     `rm -rf` of the parent directory.
 *   - The summary aggregates (`routeCount / settledCount / failedCount`)
 *     can be computed in one pass without walking every flow.
 *
 * Routes are NOT secret — plain JSON, no `safeStorage` wrapping.
 */
const ROUTES_SUBDIR = 'routes'
const FILE_VERSION = 1

const VALID_STATUSES: ReadonlySet<FlowOutcomeStatus> = new Set<FlowOutcomeStatus>([
  'pending',
  'computing',
  'converting',
  'signing',
  'sending',
  'settled',
  'failed',
  'memoized',
])

/** Stable id (`r_<base36 ts>_<base36 rand>`). */
function newRouteId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const ID_REGEX = /^r_[a-z0-9]+_[a-z0-9]+$/

function flowRoutesDir(flowId: string): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'flows', flowId, ROUTES_SUBDIR)
}

export class RouteStore {
  // ─── Public API ─────────────────────────────────────────────────

  /**
   * All routes for a flow, sorted by createdAt asc. Returns [] when the
   * routes directory doesn't exist (flow has no routes yet).
   *
   * Corrupt individual files are skipped, NOT poisoned — same policy
   * as `FlowStore.list()`.
   */
  list(flowId: string): RouteSummary[] {
    const dir = flowRoutesDir(flowId)
    if (!existsSync(dir)) return []
    const names = readdirSync(dir).filter((n) => n.endsWith('.json'))
    const out: RouteSummary[] = []
    for (const name of names) {
      try {
        const record = this.readOne(flowId, join(dir, name))
        if (record) out.push(toSummary(record))
      } catch (err) {
        console.error('[RouteStore] Skipping corrupt route file:', name, err)
      }
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    return out
  }

  /** Returns the full route record (or `null` when missing / corrupt). */
  get(flowId: string, routeId: string): RouteRecord | null {
    if (!ID_REGEX.test(routeId)) return null
    const path = join(flowRoutesDir(flowId), `${routeId}.json`)
    if (!existsSync(path)) return null
    return this.readOne(flowId, path)
  }

  /**
   * Insert or update a route. Generates a fresh id when the incoming
   * record has none (first write of a brand-new pending route). Always
   * refreshes the file's mtime via the atomic write.
   */
  upsert(input: Partial<RouteRecord> & { id?: string }): RouteRecord {
    const id = input.id && ID_REGEX.test(input.id) ? input.id : newRouteId()
    const record = RouteStore.validate(input, id)
    this.atomicWrite(record.flowId, join(flowRoutesDir(record.flowId), `${id}.json`), record)
    return record
  }

  /** Delete a single route. Used when a flow is being removed. */
  remove(flowId: string, routeId: string): void {
    if (!ID_REGEX.test(routeId)) return
    const path = join(flowRoutesDir(flowId), `${routeId}.json`)
    try {
      if (existsSync(path)) unlinkSync(path)
    } catch (err) {
      console.error('[RouteStore] Failed to delete route:', routeId, err)
    }
  }

  /** Delete every route under a flow (called from FlowStore.remove). */
  removeAllForFlow(flowId: string): void {
    const dir = flowRoutesDir(flowId)
    if (!existsSync(dir)) return
    try {
      const names = readdirSync(dir).filter((n) => n.endsWith('.json'))
      for (const name of names) {
        try {
          unlinkSync(join(dir, name))
        } catch (err) {
          console.error('[RouteStore] Failed to delete file:', name, err)
        }
      }
    } catch (err) {
      console.error('[RouteStore] Failed to enumerate routes for deletion:', err)
    }
  }

  /**
   * Bulk-read summaries for a list of flows. Used by `FlowStore.toSummary`
   * to compute `routeCount / settledCount / failedCount` without
   * hitting disk per flow.
   */
  listForFlows(flowIds: string[]): Record<string, RouteSummary[]> {
    const out: Record<string, RouteSummary[]> = {}
    for (const id of flowIds) {
      out[id] = this.list(id)
    }
    return out
  }

  /**
   * Cross-flow aggregator for the Settlement History page. Walks every
   * routes/ subdirectory under userData/flows/<flowId>/ and returns a
   * flat list of all routes, sorted by completedAt desc (falling back
   * to createdAt desc for any route without a completedAt).
   *
   * No status filter here — the renderer decides which statuses to show.
   * Corrupt files are skipped, not fatal (same policy as `list()`).
   */
  listAll(): RouteSummary[] {
    const flowsRoot = join(app.getPath('userData'), 'flows')
    if (!existsSync(flowsRoot)) return []
    const out: RouteSummary[] = []
    let flowDirs: string[]
    try {
      flowDirs = readdirSync(flowsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch (err) {
      console.error('[RouteStore] Failed to enumerate flows root:', err)
      return []
    }
    for (const flowId of flowDirs) {
      const dir = flowRoutesDir(flowId)
      if (!existsSync(dir)) continue
      let names: string[]
      try {
        names = readdirSync(dir).filter((n) => n.endsWith('.json'))
      } catch (err) {
        console.error('[RouteStore] Failed to enumerate routes for', flowId, err)
        continue
      }
      for (const name of names) {
        try {
          const record = this.readOne(flowId, join(dir, name))
          if (record) out.push(toSummary(record))
        } catch (err) {
          console.error('[RouteStore] Skipping corrupt route file:', name, err)
        }
      }
    }
    // Newest completedAt first; routes without completedAt fall back to
    // createdAt desc. ISO-8601 strings sort lexicographically.
    out.sort((a, b) => {
      const aTime = a.completedAt ?? a.createdAt
      const bTime = b.completedAt ?? b.createdAt
      return aTime < bTime ? 1 : aTime > bTime ? -1 : 0
    })
    return out
  }

  // ─── I/O ───────────────────────────────────────────────────────

  private readOne(_flowId: string, path: string): RouteRecord | null {
    try {
      const data = readFileSync(path, 'utf-8')
      const parsed = JSON.parse(data) as unknown
      return RouteStore.validateEnvelope(parsed)
    } catch (err) {
      console.error('[RouteStore] Failed to read route file:', path, err)
      return null
    }
  }

  private atomicWrite(flowId: string, path: string, record: RouteRecord): void {
    const dir = flowRoutesDir(flowId)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const tmpPath = `${path}.tmp`
    writeFileSync(tmpPath, JSON.stringify({ version: FILE_VERSION, record }, null, 2), 'utf-8')
    renameSync(tmpPath, path)
  }

  // ─── Validation ────────────────────────────────────────────────

  /** Validate an untrusted record (e.g. an IPC payload) and stamp ids. */
  static validate(input: unknown, id: string): RouteRecord {
    if (!input || typeof input !== 'object') {
      throw new Error('Route must be an object')
    }
    const r = input as Record<string, unknown>
    const flowId = String(r.flowId ?? '').trim()
    if (!flowId) throw new Error('Route flowId is required')
    if (!/^flow_[a-z0-9]+_[a-z0-9]+$/.test(flowId)) {
      throw new Error(`Invalid flowId: ${flowId}`)
    }
    const status = String(r.status ?? '') as FlowOutcomeStatus
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status: ${String(r.status)}`)
    }
    const amountCC = String(r.amountCC ?? '').trim()
    if (!amountCC) throw new Error('Route amountCC is required')
    if (!/^\d+(\.\d+)?$/.test(amountCC)) {
      throw new Error(`Invalid amountCC: ${amountCC}`)
    }
    const payeePlacementId = String(r.payeePlacementId ?? '').trim()
    if (!payeePlacementId) throw new Error('Route payeePlacementId is required')
    const sourcePlacementId = String(r.sourcePlacementId ?? '').trim()
    if (!sourcePlacementId) throw new Error('Route sourcePlacementId is required')
    const paymentPlacementId = String(r.paymentPlacementId ?? '').trim()
    if (!paymentPlacementId) throw new Error('Route paymentPlacementId is required')
    const employeeId = String(r.employeeId ?? '').trim()
    if (!employeeId) throw new Error('Route employeeId is required')
    const payCurrency = String(r.payCurrency ?? '') as RouteRecord['payCurrency']
    if (!['JPY', 'THB', 'USD', 'EUR'].includes(payCurrency)) {
      throw new Error(`Invalid payCurrency: ${String(r.payCurrency)}`)
    }
    const grossPay = String(r.grossPay ?? '').trim()
    if (!grossPay) throw new Error('Route grossPay is required')
    const recipientPartyId = String(r.recipientPartyId ?? '').trim()
    const memo = String(r.memo ?? '').trim()
    const createdAt = typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString()
    const record: RouteRecord = {
      id,
      flowId,
      status,
      employeeId,
      payeePlacementId,
      sourcePlacementId,
      paymentPlacementId,
      amountCC,
      payCurrency,
      grossPay,
      recipientPartyId,
      memo,
      createdAt,
    }
    if (typeof r.fxRate === 'string' && r.fxRate.trim().length > 0) {
      record.fxRate = r.fxRate.trim()
    }
    if (typeof r.withholdingAmount === 'string' && r.withholdingAmount.trim().length > 0) {
      record.withholdingAmount = r.withholdingAmount.trim()
    }
    if (typeof r.socialSecurityAmount === 'string' && r.socialSecurityAmount.trim().length > 0) {
      record.socialSecurityAmount = r.socialSecurityAmount.trim()
    }
    if (typeof r.error === 'string' && r.error.length > 0) {
      record.error = r.error
    }
    if (typeof r.txHash === 'string' && r.txHash.length > 0) {
      record.txHash = r.txHash
    }
    if (typeof r.startedAt === 'string') record.startedAt = r.startedAt
    if (typeof r.completedAt === 'string') record.completedAt = r.completedAt
    return record
  }

  private static validateEnvelope(input: unknown): RouteRecord {
    if (!input || typeof input !== 'object') {
      throw new Error('Route file must be a JSON object')
    }
    const obj = input as Record<string, unknown>
    if (obj.version !== FILE_VERSION) {
      throw new Error(`Unsupported route file version: ${String(obj.version)}`)
    }
    if (!obj.record || typeof obj.record !== 'object') {
      throw new Error('Missing `record` field')
    }
    const id = String((obj.record as Record<string, unknown>).id ?? '')
    if (!ID_REGEX.test(id)) {
      throw new Error(`Invalid route id: "${id}"`)
    }
    return RouteStore.validate(obj.record, id)
  }
}

function toSummary(record: RouteRecord): RouteSummary {
  const { id, flowId, status, employeeId, payeePlacementId, sourcePlacementId, paymentPlacementId, amountCC, payCurrency, grossPay, recipientPartyId, memo, createdAt } = record
  const summary: RouteSummary = {
    id,
    flowId,
    status,
    employeeId,
    payeePlacementId,
    sourcePlacementId,
    paymentPlacementId,
    amountCC,
    payCurrency,
    grossPay,
    recipientPartyId,
    memo,
    createdAt,
  }
  if (record.fxRate) summary.fxRate = record.fxRate
  if (record.withholdingAmount) summary.withholdingAmount = record.withholdingAmount
  if (record.socialSecurityAmount) summary.socialSecurityAmount = record.socialSecurityAmount
  if (record.error) summary.error = record.error
  if (record.txHash) summary.txHash = record.txHash
  if (record.startedAt) summary.startedAt = record.startedAt
  if (record.completedAt) summary.completedAt = record.completedAt
  return summary
}

export const routeStore = new RouteStore()