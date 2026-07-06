// Payroll flows persisted as one JSON file per flow under
// userData/flows/<flowId>.json.
//
// Atomic write via .tmp + rename. Same pattern as employeeStore.js.

const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const FLOWS_DIR = 'flows'
const FILE_VERSION = 1

const VALID_CATEGORIES = new Set(['source', 'payee', 'payment'])
const VALID_TONES = new Set(['blue', 'teal', 'navy', 'muted'])
const VALID_STATUSES = new Set(['draft', 'active', 'completed'])

function newId() {
  return `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const ID_REGEX = /^flow_[a-z0-9]+_[a-z0-9]+$/

class FlowStore {
  constructor() {
    const userDataPath = app.getPath('userData')
    this.flowsDir = path.join(userDataPath, FLOWS_DIR)
    if (!fs.existsSync(this.flowsDir)) {
      fs.mkdirSync(this.flowsDir, { recursive: true })
    }
  }

  list() {
    const summaries = []
    if (!fs.existsSync(this.flowsDir)) return summaries
    const names = fs.readdirSync(this.flowsDir).filter((n) => n.endsWith('.json'))
    const flows = []
    const flowById = new Map()
    for (const name of names) {
      try {
        const file = this.readOne(path.join(this.flowsDir, name))
        if (!file) continue
        flows.push(file.flow)
        flowById.set(file.flow.id, file.flow)
      } catch (err) {
        console.error('[FlowStore] Skipping corrupt flow file:', name, err)
      }
    }
    // Route counts will be computed by the IPC handler using routeStore
    for (const flow of flows) {
      summaries.push(toSummary(flow, []))
    }
    summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    return summaries
  }

  listWithRoutes(routeStore) {
    const summaries = []
    if (!fs.existsSync(this.flowsDir)) return summaries
    const names = fs.readdirSync(this.flowsDir).filter((n) => n.endsWith('.json'))
    const flows = []
    for (const name of names) {
      try {
        const file = this.readOne(path.join(this.flowsDir, name))
        if (!file) continue
        flows.push(file.flow)
      } catch (err) {
        console.error('[FlowStore] Skipping corrupt flow file:', name, err)
      }
    }
    const routesByFlow = routeStore.listForFlows(flows.map((f) => f.id))
    for (const flow of flows) {
      summaries.push(toSummary(flow, routesByFlow[flow.id] ?? []))
    }
    summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    return summaries
  }

  get(id) {
    if (!ID_REGEX.test(id)) return null
    const filePath = path.join(this.flowsDir, `${id}.json`)
    if (!fs.existsSync(filePath)) return null
    return this.readOne(filePath)
  }

  save(input) {
    const now = new Date().toISOString()
    const id = input.id && ID_REGEX.test(input.id) ? input.id : newId()
    const file = FlowStore.validate(input, id)
    // Lock guard
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
    const next = {
      ...file.flow,
      id,
      createdAt: file.flow.createdAt || now,
      updatedAt: now,
    }
    const nextFile = { version: FILE_VERSION, flow: next }
    this.atomicWrite(path.join(this.flowsDir, `${id}.json`), nextFile)
    return nextFile
  }

  setStatus(id, status) {
    if (!ID_REGEX.test(id)) return null
    const file = this.get(id)
    if (!file) return null
    if (file.flow.status === status) return file
    const next = {
      ...file.flow,
      status,
      updatedAt: new Date().toISOString(),
    }
    const nextFile = { version: FILE_VERSION, flow: next }
    this.atomicWrite(path.join(this.flowsDir, `${id}.json`), nextFile)
    return nextFile
  }

  remove(id) {
    if (ID_REGEX.test(id)) {
      const filePath = path.join(this.flowsDir, `${id}.json`)
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch (err) {
        console.error('[FlowStore] Failed to delete flow:', id, err)
      }
    }
  }

  reset() {
    if (!fs.existsSync(this.flowsDir)) return
    const names = fs.readdirSync(this.flowsDir).filter((n) => n.endsWith('.json'))
    for (const name of names) {
      try {
        fs.unlinkSync(path.join(this.flowsDir, name))
      } catch (err) {
        console.error('[FlowStore] Failed to delete file:', name, err)
      }
    }
  }

  readOne(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(data)
      return FlowStore.validateEnvelope(parsed)
    } catch (err) {
      console.error('[FlowStore] Failed to read flow file:', filePath, err)
      return null
    }
  }

  atomicWrite(filePath, file) {
    const tmpPath = `${filePath}.tmp`
    fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2), 'utf-8')
    fs.renameSync(tmpPath, filePath)
  }

  static validate(input, id) {
    if (!input || typeof input !== 'object') {
      throw new Error('Flow must be a JSON object')
    }
    const f = input
    const name = String(f.name ?? '').trim()
    if (!name) throw new Error('Flow name is required')
    if (name.length > 200) {
      throw new Error('Flow name must be 200 characters or fewer')
    }
    const statusRaw = typeof f.status === 'string' ? f.status : 'draft'
    if (!VALID_STATUSES.has(statusRaw)) {
      throw new Error(`Invalid status: ${statusRaw}`)
    }
    const status = statusRaw
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
    const flow = {
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

  static validateEnvelope(input) {
    if (!input || typeof input !== 'object') {
      throw new Error('Flow file must be a JSON object')
    }
    const obj = input
    if (obj.version !== FILE_VERSION) {
      throw new Error(`Unsupported file version: ${String(obj.version)}`)
    }
    if (!obj.flow || typeof obj.flow !== 'object') {
      throw new Error('Missing `flow` field')
    }
    const flow = obj.flow
    const id = String(flow.id ?? '')
    if (!ID_REGEX.test(id)) {
      throw new Error(`Invalid flow id: "${id}"`)
    }
    return FlowStore.validate(flow, id)
  }

  static validateCard(input) {
    if (!input || typeof input !== 'object') {
      throw new Error('Card must be an object')
    }
    const c = input

    const placementId = String(c.placementId ?? '').trim()
    if (!placementId) throw new Error('Missing placementId')
    if (placementId.length > 100) {
      throw new Error('placementId must be 100 characters or fewer')
    }

    const category = String(c.category ?? '')
    if (!VALID_CATEGORIES.has(category)) {
      throw new Error(`Invalid category: ${String(c.category)}`)
    }

    const title = String(c.title ?? '').trim()
    if (!title) throw new Error('Card title is required')
    if (title.length > 200) {
      throw new Error('Card title must be 200 characters or fewer')
    }

    const tone = String(c.tone ?? 'muted')
    if (!VALID_TONES.has(tone)) {
      throw new Error(`Invalid tone: ${String(c.tone)}`)
    }

    const x = Number.isFinite(Number(c.x)) ? Math.max(0, Number(c.x)) : 0
    const y = Number.isFinite(Number(c.y)) ? Math.max(0, Number(c.y)) : 0
    const collapsed = Boolean(c.collapsed)

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

  static validateFields(input, fieldName) {
    if (input === undefined || input === null) return undefined
    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new Error(`${fieldName} must be a plain object`)
    }
    return input
  }

  static validateConnection(input, cards) {
    if (!input || typeof input !== 'object') {
      throw new Error('Connection must be an object')
    }
    const c = input
    const id = String(c.id ?? '').trim()
    if (!id) throw new Error('Connection id is required')
    if (id.length > 100) {
      throw new Error('Connection id must be 100 characters or fewer')
    }
    const from = String(c.from ?? '').trim()
    const to = String(c.to ?? '').trim()
    if (!from) throw new Error('Connection `from` is required')
    if (!to) throw new Error('Connection `to` is required')
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

function toSummary(flow, routes) {
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

function shapesEqual(a, b) {
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

module.exports = { FlowStore }
