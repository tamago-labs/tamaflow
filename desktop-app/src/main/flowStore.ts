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
  FlowSchedule,
  FlowSummary,
} from '../preload/index.d'

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
 *   (categories, transfer variants, tones, schedule mode).
 * - **Not secret** — flow definitions are non-confidential
 *   business records. No `safeStorage` wrapping.
 */
const FLOWS_DIR = 'flows'
const FILE_VERSION = 1

const VALID_CATEGORIES = new Set(['source', 'payee', 'transfer'])
const VALID_TRANSFER_VARIANTS = new Set(['contractor', 'employee'])
const VALID_TONES = new Set(['blue', 'teal', 'navy', 'muted'])
const VALID_SCHEDULE_MODES = new Set(['manual', 'scheduled'])

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
   * renderer memory; only counts are surfaced.
   */
  list(): FlowSummary[] {
    const summaries: FlowSummary[] = []
    if (!existsSync(this.flowsDir)) return summaries
    const names = readdirSync(this.flowsDir).filter((n) => n.endsWith('.json'))
    for (const name of names) {
      try {
        const file = this.readOne(join(this.flowsDir, name))
        if (!file) continue
        summaries.push(toSummary(file.flow))
      } catch (err) {
        // A corrupt file should not poison the whole list — log and
        // skip. The user can recover via reset() or manual file edit.
        console.error('[FlowStore] Skipping corrupt flow file:', name, err)
      }
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
   * Returns the persisted file so the IPC handler can hand the post-
   * save state back to the renderer.
   */
  save(input: Partial<FlowDefinition> & { name?: string }): FlowFile {
    const now = new Date().toISOString()
    const id = input.id && ID_REGEX.test(input.id) ? input.id : newId()
    const file = FlowStore.validate(input, id)
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

  /** Delete the on-disk file. Returns the post-removal summary list. */
  remove(id: string): FlowSummary[] {
    if (ID_REGEX.test(id)) {
      const path = join(this.flowsDir, `${id}.json`)
      try {
        if (existsSync(path)) unlinkSync(path)
      } catch (err) {
        console.error('[FlowStore] Failed to delete flow:', id, err)
      }
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
    const schedule = FlowStore.validateSchedule(f.schedule)
    const createdAt = typeof f.createdAt === 'string' ? f.createdAt : ''
    const updatedAt = typeof f.updatedAt === 'string' ? f.updatedAt : ''
    const flow: FlowDefinition = {
      id,
      name,
      cards,
      connections,
      schedule,
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

    let transferVariant: CanvasCard['transferVariant']
    if (c.transferVariant !== undefined) {
      const v = String(c.transferVariant)
      if (!VALID_TRANSFER_VARIANTS.has(v)) {
        throw new Error(`Invalid transfer variant: ${v}`)
      }
      if (category !== 'transfer') {
        throw new Error('transferVariant is only valid on transfer cards')
      }
      transferVariant = v as CanvasCard['transferVariant']
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
    const contractorTransferFields = FlowStore.validateFields(
      c.contractorTransferFields,
      'contractorTransferFields',
    )
    const employeeTransferFields = FlowStore.validateFields(
      c.employeeTransferFields,
      'employeeTransferFields',
    )

    return {
      placementId,
      category,
      transferVariant,
      title,
      tone,
      x,
      y,
      collapsed,
      sourceFields,
      payeeFields,
      contractorTransferFields,
      employeeTransferFields,
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

  private static validateSchedule(
    input: unknown,
  ): FlowSchedule | undefined {
    if (input === undefined || input === null) return undefined
    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Schedule must be a plain object')
    }
    const s = input as Record<string, unknown>
    const mode = String(s.mode ?? '')
    if (!VALID_SCHEDULE_MODES.has(mode)) {
      throw new Error(`Invalid schedule mode: ${String(s.mode)}`)
    }
    let runAt: string | undefined
    if (s.runAt !== undefined) {
      runAt = String(s.runAt)
      if (Number.isNaN(Date.parse(runAt))) {
        throw new Error(`Invalid runAt: ${runAt}`)
      }
    }
    if (mode === 'scheduled' && !runAt) {
      throw new Error('runAt is required when mode is "scheduled"')
    }
    return { mode: mode as FlowSchedule['mode'], runAt }
  }
}

/** Reduce a `FlowDefinition` to a `FlowSummary` (Active Flows list). */
function toSummary(flow: FlowDefinition): FlowSummary {
  let payeeCount = 0
  let transferCount = 0
  for (const card of flow.cards) {
    if (card.category === 'payee') payeeCount++
    else if (card.category === 'transfer') transferCount++
  }
  return {
    id: flow.id,
    name: flow.name,
    cardCount: flow.cards.length,
    payeeCount,
    transferCount,
    schedule: flow.schedule,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  }
}

export const flowStore = new FlowStore()