// Background worker that settles payroll routes one at a time on Canton.
//
// Lifecycle per tick (1.5s):
//   1. Walk every flow with status === 'active'.
//   2. For each, find a pending route (oldest by createdAt).
//   3. Status walk: pending → computing → converting → signing → sending → settled
//   4. On any error → status = 'failed', error message captured.
//   5. After each tick, flows with no pending / in-flight routes flip to 'completed'.

const { BrowserWindow } = require('electron')
const { existsSync, readFileSync } = require('fs')
const { join } = require('path')
const { app } = require('electron')

const TICK_MS = 1500

let flowStore = null
let routeStore = null
let walletModule = null

function loadEmployees() {
  const path = join(app.getPath('userData'), 'employees.json')
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'))
    return Array.isArray(raw?.employees) ? raw.employees : []
  } catch {
    return []
  }
}

function notifyProgress(flowId, routes) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('flows:onProgress', flowId, routes)
  }
}

function notifyChange() {
  const list = flowStore.listWithRoutes(routeStore)
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('flows:onChange', list)
  }
}

function failRoute(flowId, routeId, err, now) {
  const current = routeStore.get(flowId, routeId)
  if (!current) return
  routeStore.upsert({ ...current, status: 'failed', error: err, completedAt: now })
  notifyProgress(flowId, routeStore.list(flowId))
}

async function processOne(flow, route) {
  const now = () => new Date().toISOString()

  // computing
  routeStore.upsert({ ...route, status: 'computing', startedAt: now() })
  notifyProgress(flow.id, routeStore.list(flow.id))

  // converting
  await new Promise(r => setTimeout(r, 50))
  routeStore.upsert({ ...routeStore.get(flow.id, route.id), status: 'converting' })
  notifyProgress(flow.id, routeStore.list(flow.id))

  // signing
  await new Promise(r => setTimeout(r, 50))
  routeStore.upsert({ ...routeStore.get(flow.id, route.id), status: 'signing' })
  notifyProgress(flow.id, routeStore.list(flow.id))

  // sending
  const sending = { ...routeStore.get(flow.id, route.id), status: 'sending' }
  routeStore.upsert(sending)
  notifyProgress(flow.id, routeStore.list(flow.id))

  // Check wallet
  const wallet = await walletModule.getWalletStatus()
  if (!wallet.exists) {
    failRoute(flow.id, route.id, 'No wallet — set one up in Settings → Wallet', now())
    return
  }

  // Transfer
  const result = await walletModule.transferAmulet({
    recipient: sending.recipientPartyId,
    amount: sending.amountCC,
    memo: sending.memo || 'Payroll payment',
  })

  if (!result.success) {
    failRoute(flow.id, route.id, result.error || 'Transfer failed', now())
    return
  }

  // settled
  const settled = { ...routeStore.get(flow.id, route.id), status: 'settled', completedAt: now() }
  if (result.updateId) settled.txHash = result.updateId
  routeStore.upsert(settled)
  notifyProgress(flow.id, routeStore.list(flow.id))
}

async function tick() {
  const summaries = flowStore.listWithRoutes(routeStore)
  const activeFlows = summaries.filter(s => s.status === 'active')

  for (const summary of activeFlows) {
    const flowFile = flowStore.get(summary.id)
    if (!flowFile) continue
    const flow = flowFile.flow

    const routes = routeStore.list(flow.id)
    const pending = routes
      .filter(r => r.status === 'pending')
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))

    if (pending.length === 0) {
      const inFlight = routes.some(r => ['computing', 'converting', 'signing', 'sending'].includes(r.status))
      if (!inFlight && routes.length > 0) {
        flowStore.setStatus(flow.id, 'completed')
        notifyChange()
      }
      continue
    }

    const next = pending[0]
    try {
      await processOne(flow, next)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      failRoute(flow.id, next.id, msg, new Date().toISOString())
    }
  }
}

function recoverMidFlight() {
  const summaries = flowStore.listWithRoutes(routeStore)
  const now = new Date().toISOString()
  for (const s of summaries) {
    if (s.status !== 'active') continue
    const routes = routeStore.list(s.id)
    for (const r of routes) {
      if (r.status === 'sending') {
        routeStore.upsert({ ...r, status: 'failed', error: 'Recovered after restart — please re-submit', completedAt: now })
      }
    }
  }
  notifyChange()
}

class FlowWorker {
  constructor() {
    this.intervalHandle = null
    this.inFlight = null
  }

  start(stores, wallet) {
    if (this.intervalHandle) return
    flowStore = stores.flowStore
    routeStore = stores.routeStore
    walletModule = wallet
    recoverMidFlight()
    this.intervalHandle = setInterval(() => {
      if (this.inFlight) return
      this.inFlight = tick().finally(() => { this.inFlight = null })
    }, TICK_MS)
    console.log('[flowWorker] started')
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    console.log('[flowWorker] stopped')
  }
}

const flowWorker = new FlowWorker()

module.exports = { flowWorker }
