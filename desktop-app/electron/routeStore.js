// Per-route persistence for payroll flows.
//
// Layout: <userData>/flows/<flowId>/routes/<routeId>.json
// Atomic write via .tmp + rename.

const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const ROUTES_SUBDIR = 'routes'
const FILE_VERSION = 1

const VALID_STATUSES = new Set([
  'pending',
  'computing',
  'converting',
  'signing',
  'sending',
  'settled',
  'failed',
  'memoized',
])

function newRouteId() {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const ID_REGEX = /^r_[a-z0-9]+_[a-z0-9]+$/

function flowRoutesDir(flowId) {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'flows', flowId, ROUTES_SUBDIR)
}

class RouteStore {
  list(flowId) {
    const dir = flowRoutesDir(flowId)
    if (!fs.existsSync(dir)) return []
    const names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'))
    const out = []
    for (const name of names) {
      try {
        const record = this.readOne(flowId, path.join(dir, name))
        if (record) out.push(toSummary(record))
      } catch (err) {
        console.error('[RouteStore] Skipping corrupt route file:', name, err)
      }
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    return out
  }

  get(flowId, routeId) {
    if (!ID_REGEX.test(routeId)) return null
    const filePath = path.join(flowRoutesDir(flowId), `${routeId}.json`)
    if (!fs.existsSync(filePath)) return null
    return this.readOne(flowId, filePath)
  }

  upsert(input) {
    const id = input.id && ID_REGEX.test(input.id) ? input.id : newRouteId()
    const record = RouteStore.validate(input, id)
    this.atomicWrite(record.flowId, path.join(flowRoutesDir(record.flowId), `${id}.json`), record)
    return record
  }

  remove(flowId, routeId) {
    if (!ID_REGEX.test(routeId)) return
    const filePath = path.join(flowRoutesDir(flowId), `${routeId}.json`)
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (err) {
      console.error('[RouteStore] Failed to delete route:', routeId, err)
    }
  }

  removeAllForFlow(flowId) {
    const dir = flowRoutesDir(flowId)
    if (!fs.existsSync(dir)) return
    try {
      const names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'))
      for (const name of names) {
        try {
          fs.unlinkSync(path.join(dir, name))
        } catch (err) {
          console.error('[RouteStore] Failed to delete file:', name, err)
        }
      }
    } catch (err) {
      console.error('[RouteStore] Failed to enumerate routes for deletion:', err)
    }
  }

  listForFlows(flowIds) {
    const out = {}
    for (const id of flowIds) {
      out[id] = this.list(id)
    }
    return out
  }

  listAll() {
    const flowsRoot = path.join(app.getPath('userData'), 'flows')
    if (!fs.existsSync(flowsRoot)) return []
    const out = []
    let flowDirs
    try {
      flowDirs = fs.readdirSync(flowsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch (err) {
      console.error('[RouteStore] Failed to enumerate flows root:', err)
      return []
    }
    for (const flowId of flowDirs) {
      const dir = flowRoutesDir(flowId)
      if (!fs.existsSync(dir)) continue
      let names
      try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'))
      } catch (err) {
        console.error('[RouteStore] Failed to enumerate routes for', flowId, err)
        continue
      }
      for (const name of names) {
        try {
          const record = this.readOne(flowId, path.join(dir, name))
          if (record) out.push(toSummary(record))
        } catch (err) {
          console.error('[RouteStore] Skipping corrupt route file:', name, err)
        }
      }
    }
    out.sort((a, b) => {
      const aTime = a.completedAt ?? a.createdAt
      const bTime = b.completedAt ?? b.createdAt
      return aTime < bTime ? 1 : aTime > bTime ? -1 : 0
    })
    return out
  }

  readOne(_flowId, filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(data)
      return RouteStore.validateEnvelope(parsed)
    } catch (err) {
      console.error('[RouteStore] Failed to read route file:', filePath, err)
      return null
    }
  }

  atomicWrite(flowId, filePath, record) {
    const dir = flowRoutesDir(flowId)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const tmpPath = `${filePath}.tmp`
    fs.writeFileSync(tmpPath, JSON.stringify({ version: FILE_VERSION, record }, null, 2), 'utf-8')
    fs.renameSync(tmpPath, filePath)
  }

  static validate(input, id) {
    if (!input || typeof input !== 'object') {
      throw new Error('Route must be an object')
    }
    const r = input
    const flowId = String(r.flowId ?? '').trim()
    if (!flowId) throw new Error('Route flowId is required')
    if (!/^flow_[a-z0-9]+_[a-z0-9]+$/.test(flowId)) {
      throw new Error(`Invalid flowId: ${flowId}`)
    }
    const status = String(r.status ?? '')
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
    const payCurrency = String(r.payCurrency ?? '')
    if (!['JPY', 'THB', 'USD', 'EUR'].includes(payCurrency)) {
      throw new Error(`Invalid payCurrency: ${String(r.payCurrency)}`)
    }
    const grossPay = String(r.grossPay ?? '').trim()
    if (!grossPay) throw new Error('Route grossPay is required')
    const recipientPartyId = String(r.recipientPartyId ?? '').trim()
    const memo = String(r.memo ?? '').trim()
    const createdAt = typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString()
    const record = {
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
    if (typeof r.taxAmount === 'string' && r.taxAmount.trim().length > 0) {
      record.taxAmount = r.taxAmount.trim()
    }
    if (typeof r.socialSecurityAmount === 'string' && r.socialSecurityAmount.trim().length > 0) {
      record.socialSecurityAmount = r.socialSecurityAmount.trim()
    }
    if (typeof r.netPay === 'string' && r.netPay.trim().length > 0) {
      record.netPay = r.netPay.trim()
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

  static validateEnvelope(input) {
    if (!input || typeof input !== 'object') {
      throw new Error('Route file must be a JSON object')
    }
    const obj = input
    if (obj.version !== FILE_VERSION) {
      throw new Error(`Unsupported route file version: ${String(obj.version)}`)
    }
    if (!obj.record || typeof obj.record !== 'object') {
      throw new Error('Missing `record` field')
    }
    const id = String(obj.record.id ?? '')
    if (!ID_REGEX.test(id)) {
      throw new Error(`Invalid route id: "${id}"`)
    }
    return RouteStore.validate(obj.record, id)
  }
}

function toSummary(record) {
  const { id, flowId, status, employeeId, payeePlacementId, sourcePlacementId, paymentPlacementId, amountCC, payCurrency, grossPay, recipientPartyId, memo, createdAt } = record
  const summary = {
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
  if (record.taxAmount) summary.taxAmount = record.taxAmount
  if (record.socialSecurityAmount) summary.socialSecurityAmount = record.socialSecurityAmount
  if (record.netPay) summary.netPay = record.netPay
  if (record.error) summary.error = record.error
  if (record.txHash) summary.txHash = record.txHash
  if (record.startedAt) summary.startedAt = record.startedAt
  if (record.completedAt) summary.completedAt = record.completedAt
  return summary
}

module.exports = { RouteStore }
