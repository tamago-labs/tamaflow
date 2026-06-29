import { app } from 'electron'
import { join } from 'path'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
} from 'fs'
import type {
  CanvasCard,
  Connection,
  FlowDefinition,
  FlowFile,
  FlowStatus,
  FlowSummary,
  RouteSummary,
} from '../preload/index.d'
import { routeStore } from './routeStore'

/**
 * Payroll flows persisted as one JSON file per flow under
 * `userData/flows/<flowId>.json`.
 *
 * Mirrors the `EmployeeStore` shape (singleton, atomic write via
 * `.tmp` + `rename`, strict validation, plain JSON) but uses a
 * one-file-per-record layout so individual flows can be read,
 * written, and deleted without touching the others.
 *
 * - **Atomic write** — same rationale as the other stores: a torn
 *   JSON here would silently lose a flow's draft on the next load.
 * - **Strict validation** — incoming flows are run through
 *   `validate()` against the same allowlists as the renderer
 *   (categories, tones).
 * - **Status** — each flow has a `status` (`draft` / `active` /
 *   `completed`) that the worker (Phase 4) drives via `setStatus`.
 * - **Not secret** — flow definitions are non-confidential
 *   business records. No `safeStorage` wrapping.
 *
 * Routes per flow live in `routeStore` under
 * `<userData>/flows/<flowId>/routes/<id>.json`. `FlowStore.list()`
 * reads both to surface the per-flow progress counts.
 *
 * v.1 has no scheduling — flows settle as soon as the worker picks
 * them up after Start. A future scheduled mode would add a field on
 * `FlowDefinition` and a worker-side wait — punted.
 */
const FLOWS_DIR = 'flows'
const FILE_VERSION = 1

const VALID_CATEGORIES = new Set(['source', 'payee', 'payment'])
const VALID_TONES = new Set(['blue', 'teal', 'navy', 'muted'])
const VALID_STATUSES = new Set<FlowStatus>(['draft', 'active', 'completed'])

/** Generate a stable id (`flow_<base36 ts>_<base36 rand>`).
 *  Mirrors `EmployeeStore.newId()` shape. */
function newId(): string {
  return `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const ID_REGEX = /^flow_[a-z0-9]+_[a-z0-9]+$/

export class FlowStore {
  private flowsDir: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.flowsDir = join(userDataPath, FLOWS_DIR)
    if (!existsSync(this.flowsDir)) {
      mkdirSync(this.flowsDir, { recursive: true })
    }
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Lightweight summaries — used by the Active Flows list. Iterates
   * the directory and reads each file once. Cards are NOT loaded into
   * renderer memory; only counts are surfaced. Route counts come from
   * `routeStore.listForFlows`.
   */
  list(): FlowSummary[] {
    const summaries: FlowSummary[] = []
    if (!existsSync(this.flowsDir)) return summaries
    const names = readdirSync(this.flowsDir).filter((n) => n.endsWith('.json'))
    const flows: FlowDefinition[] = []
    const flowById = new Map<string, FlowDefinition>()
    for (const name of names) {
      try {
        const file = this.readOne(join(this.flowsDir, name))
        if (!file) continue
        flows.push(file.flow)
        flowById.set(file.flow.id, file.flow)
      } catch (err) {
        // A corrupt file should not poison the whole list — log and
        // skip. The user can recover via reset() or manual file edit.
        console.error('[FlowStore] Skipping corrupt flow file:', name, err)
      }
    }
    const routesByFlow = routeStore.listForFlows(flows.map((f) => f.id))
    for (const flow of flows) {
      summaries.push(toSummary(flow, routesByFlow[flow.id] ?? []))
    }
    // Newest first by updatedAt (ISO strings sort lexicographically).
    summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    return summaries
  }

  /** Returns the full flow file (or `null` if id is unknown / file corrupt). */
  get(id: string): FlowFile | null {
    if (!ID_REGEX.test(id)) return null
    const path = join(this.flowsDir, `${id}.json`)
    if (!existsSync(path)) return null
    return this.readOne(path)
  }

  /**
   * Validate + persist. Generates a fresh `id` when the incoming flow
   * has none (first save of a brand-new draft). Preserves `createdAt`
   * if the incoming flow already has one (subsequent saves); stamps
   * it now otherwise. Always refreshes `updatedAt`.
   *
   * Status transitions are guarded: an active or completed flow cannot
   * have its cards mutated through `save()` (use `setStatus` to flip
   * lifecycle). When the persisted flow is active/completed and the
   * incoming payload carries a different shape, we reject with a
   * clear error rather than silently rewriting the running flow.
   *
   * Returns the persisted file so the IPC handler can hand the post-
   * save state back to the renderer.
   */
  save(input: Partial<FlowDefinition> & { name?: string }): FlowFile {
    const now = new Date().toISOString()
    const id = input.id && ID_REGEX.test(input.id) ? input.id : newId()
    const file = FlowStore.validate(input, id)
    // Lock guard: refuse to mutate an active/completed flow unless the
    // incoming payload exactly matches what's on disk (cheap identity
    // check — full equality not required for the save to be a no-op).
    if (id) {
      const existing = this.get(id)
      if (existing && (existing.flow.status === 'active' || existing.flow.status === 'completed')) {
        if (!shapesEqual(existing.flow, file.flow)) {
          throw new Error(
            `Flow is ${existing.flow.status} — stop it from the Active Flow page before editing the canvas.`
          )
        }
      }
    }
    const next: FlowDefinition = {
      ...file.flow,
      id,
      createdAt: file.flow.createdAt || now,
      updatedAt: now,
    }
    const nextFile: FlowFile = { version: FILE_VERSION, flow: next }
    this.atomicWrite(join(this.flowsDir, `${id}.json`), nextFile)
    return nextFile
  }

  /**
   * Lifecycle-only mutation: flip a flow's `status` without touching
   * any other field. Used by the worker (active → completed) and by the
   * renderer's `stop` handler (active → draft). Does NOT validate
   * transitions — the caller is responsible for legal moves.
   */
  setStatus(id: string, status: FlowStatus): FlowFile | null {
    if (!ID_REGEX.test(id)) return null
    const file = this.get(id)
    if (!file) return null
    if (file.flow.status === status) return file
    const next: FlowDefinition = {
      ...file.flow,
      status,
      updatedAt: new Date().toISOString(),
    }
    const nextFile: FlowFile = { version: FILE_VERSION, flow: next }
    this.atomicWrite(join(this.flowsDir, `${id}.json`), nextFile)
    return nextFile
  }

  /** Delete the on-disk file + every route under it. Returns the post-removal summary list. */
  remove(id: string): FlowSummary[] {
    if (ID_REGEX.test(id)) {
      const path = join(this.flowsDir, `${id}.json`)
      try {
        if (existsSync(path)) unlinkSync(path)
      } catch (err) {
        console.error('[FlowStore] Failed to delete flow:', id, err)
      }
      // Drop the routes subdirectory too — otherwise a re-created flow
      // with the same id would inherit stale routes.
      routeStore.removeAllForFlow(id)
    }
    return this.list()
  }

  /** Recovery hatch — wipes every flow file. */
  reset(): void {
    if (!existsSync(this.flowsDir)) return
    const names = readdirSync(this.flowsDir).filter((n) => n.endsWith('.json'))
    for (const name of names) {
      try {
        unlinkSync(join(this.flowsDir, name))
      } catch (err) {
        console.error('[FlowStore] Failed to delete file:', name, err)
      }
    }
  }

  // ─── I/O ───────────────────────────────────────────────────────

  private readOne(path: string): FlowFile | null {
    try {
      const data = readFileSync(path, 'utf-8')
      const parsed = JSON.parse(data) as unknown
      return FlowStore.validateEnvelope(parsed)
    } catch (err) {
      console.error('[FlowStore] Failed to read flow file:', path, err)
      return null
    }
  }

  /** Write atomically via `.tmp` + `rename`. */
  private atomicWrite(path: string, file: FlowFile): void {
    const tmpPath = `${path}.tmp`
    writeFileSync(tmpPath, JSON.stringify(file, null, 2), 'utf-8')
    renameSync(tmpPath, path)
  }

  // ─── Validation ────────────────────────────────────────────────

  /**
   * Validate an untrusted object (e.g. an IPC payload) and return a
   * typed `FlowFile`. Throws on schema mismatch so the renderer can
   * surface the error to the user.
   */
  static validate(input: unknown, id: string): FlowFile {
    if (!input || typeof input !== 'object') {
      throw new Error('Flow must be a JSON object')
    }
    const f = input as Record<string, unknown>
    const name = String(f.name ?? '').trim()
    if (!name) throw new Error('Flow name is required')
    if (name.length > 200) {
      throw new Error('Flow name must be 200 characters or fewer')
    }
    // Status defaults to 'draft' when missing (legacy flows persisted
    // before the lifecycle field existed).
    const statusRaw = typeof f.status === 'string' ? f.status : 'draft'
    if (!VALID_STATUSES.has(statusRaw as FlowStatus)) {
      throw new Error(`Invalid status: ${statusRaw}`)
    }
    const status = statusRaw as FlowStatus
    const cards = Array.isArray(f.cards)
      ? f.cards.map((c, idx) => {
          try {
            return FlowStore.validateCard(c)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            throw new Error(`Card #${idx + 1}: ${msg}`)
          }
        })
      : []
    const connections = Array.isArray(f.connections)
      ? f.connections.map((c, idx) => {
          try {
            return FlowStore.validateConnection(c, cards)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            throw new Error(`Connection #${idx + 1}: ${msg}`)
          }
        })
      : []
    const createdAt = typeof f.createdAt === 'string' ? f.createdAt : ''
    const updatedAt = typeof f.updatedAt === 'string' ? f.updatedAt : ''
    const flow: FlowDefinition = {
      id,
      name,
      status,
      cards,
      connections,
      createdAt,
      updatedAt,
    }
    return { version: FILE_VERSION, flow }
  }

  private static validateEnvelope(input: unknown): FlowFile {
    if (!input || typeof input !== 'object') {
      throw new Error('Flow file must be a JSON object')
    }
    const obj = input as Record<string, unknown>
    if (obj.version !== FILE_VERSION) {
      throw new Error(`Unsupported file version: ${String(obj.version)}`)
    }
    if (!obj.flow || typeof obj.flow !== 'object') {
      throw new Error('Missing `flow` field')
    }
    const flow = obj.flow as Record<string, unknown>
    const id = String(flow.id ?? '')
    if (!ID_REGEX.test(id)) {
      throw new Error(`Invalid flow id: "${id}"`)
    }
    return FlowStore.validate(flow, id)
  }

  private static validateCard(input: unknown): CanvasCard {
    if (!input || typeof input !== 'object') {
      throw new Error('Card must be an object')
    }
    const c = input as Record<string, unknown>

    const placementId = String(c.placementId ?? '').trim()
    if (!placementId) throw new Error('Missing placementId')
    if (placementId.length > 100) {
      throw new Error('placementId must be 100 characters or fewer')
    }

    const category = String(c.category ?? '') as CanvasCard['category']
    if (!VALID_CATEGORIES.has(category)) {
      throw new Error(`Invalid category: ${String(c.category)}`)
    }

    const title = String(c.title ?? '').trim()
    if (!title) throw new Error('Card title is required')
    if (title.length > 200) {
      throw new Error('Card title must be 200 characters or fewer')
    }

    const tone = String(c.tone ?? 'muted') as CanvasCard['tone']
    if (!VALID_TONES.has(tone)) {
      throw new Error(`Invalid tone: ${String(c.tone)}`)
    }

    // Coordinates — accept anything finite; clamp to non-negative so
    // a bad import can't drop cards at -9999 and lose them off-canvas.
    const x = Number.isFinite(Number(c.x)) ? Math.max(0, Number(c.x)) : 0
    const y = Number.isFinite(Number(c.y)) ? Math.max(0, Number(c.y)) : 0

    const collapsed = Boolean(c.collapsed)

    // Field shapes — kept loose. We only require that, when present,
    // they be plain objects (so JSON.stringify won't blow up later).
    const sourceFields = FlowStore.validateFields(c.sourceFields, 'sourceFields')
    const payeeFields = FlowStore.validateFields(c.payeeFields, 'payeeFields')
    const paymentFields = FlowStore.validateFields(c.paymentFields, 'paymentFields')

    return {
      placementId,
      category,
      title,
      tone,
      x,
      y,
      collapsed,
      sourceFields,
      payeeFields,
      paymentFields,
    }
  }

  private static validateFields(
    input: unknown,
    fieldName: string,
  ): Record<string, unknown> | undefined {
    if (input === undefined || input === null) return undefined
    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new Error(`${fieldName} must be a plain object`)
    }
    return input as Record<string, unknown>
  }

  private static validateConnection(
    input: unknown,
    cards: CanvasCard[],
  ): Connection {
    if (!input || typeof input !== 'object') {
      throw new Error('Connection must be an object')
    }
    const c = input as Record<string, unknown>
    const id = String(c.id ?? '').trim()
    if (!id) throw new Error('Connection id is required')
    if (id.length > 100) {
      throw new Error('Connection id must be 100 characters or fewer')
    }
    const from = String(c.from ?? '').trim()
    const to = String(c.to ?? '').trim()
    if (!from) throw new Error('Connection `from` is required')
    if (!to) throw new Error('Connection `to` is required')
    // Verify the endpoints still resolve to existing cards (catches
    // stale references after a manual JSON edit / merge).
    const fromExists = cards.some((card) => card.placementId === from)
    const toExists = cards.some((card) => card.placementId === to)
    if (!fromExists) {
      throw new Error(`Connection endpoint not found: ${from}`)
    }
    if (!toExists) {
      throw new Error(`Connection endpoint not found: ${to}`)
    }
    return { id, from, to }
  }
}

/** Reduce a `FlowDefinition` + its routes to a `FlowSummary` (Active Flows list). */
function toSummary(flow: FlowDefinition, routes: RouteSummary[]): FlowSummary {
  let payeeCount = 0
  for (const card of flow.cards) {
    if (card.category === 'payee') payeeCount++
  }
  let settledCount = 0
  let failedCount = 0
  for (const r of routes) {
    if (r.status === 'settled') settledCount++
    else if (r.status === 'failed') failedCount++
  }
  return {
    id: flow.id,
    name: flow.name,
    status: flow.status,
    cardCount: flow.cards.length,
    payeeCount,
    routeCount: routes.length,
    settledCount,
    failedCount,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  }
}

/**
 * Identity check used by `save()` to detect "the renderer just
 * re-saved what it loaded" vs "the user actually changed something
 * while the flow is active". Compares name, cards, connections.
 * Status is excluded (the worker owns it).
 */
function shapesEqual(a: FlowDefinition, b: FlowDefinition): boolean {
  if (a.name !== b.name) return false
  if (a.cards.length !== b.cards.length) return false
  if (a.connections.length !== b.connections.length) return false
  const aCards = a.cards.map((c) => JSON.stringify(c)).sort()
  const bCards = b.cards.map((c) => JSON.stringify(c)).sort()
  for (let i = 0; i < aCards.length; i++) {
    if (aCards[i] !== bCards[i]) return false
  }
  const aConns = a.connections.map((c) => JSON.stringify(c)).sort()
  const bConns = b.connections.map((c) => JSON.stringify(c)).sort()
  for (let i = 0; i < aConns.length; i++) {
    if (aConns[i] !== bConns[i]) return false
  }
  return true
}

export const flowStore = new FlowStore()