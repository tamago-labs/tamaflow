// IPC handlers for the payroll flow builder.
//
// Mirrors the company/employee patterns:
//   - one registerFlowIpcHandlers function called from main/index.js
//   - save/remove/start/stop push flows:onChange so every
//     subscribed renderer reacts in lock-step

const { ipcMain, BrowserWindow } = require('electron')
const { FlowStore } = require('./flowStore')
const { RouteStore } = require('./routeStore')

let flowStore = null
let routeStore = null

function notifyChange(list) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('flows:onChange', list)
  }
}

function notifyProgress(flowId, routes) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('flows:onProgress', flowId, routes)
  }
}

function registerFlowIpcHandlers() {
  flowStore = new FlowStore()
  routeStore = new RouteStore()

  ipcMain.handle('flows:list', () => {
    return flowStore.listWithRoutes(routeStore)
  })

  ipcMain.handle('flows:get', (_e, id) => {
    return flowStore.get(id)
  })

  ipcMain.handle('flows:save', (_e, raw) => {
    const file = flowStore.save(raw)
    notifyChange(flowStore.listWithRoutes(routeStore))
    return file
  })

  ipcMain.handle('flows:remove', (_e, id) => {
    routeStore.removeAllForFlow(id)
    flowStore.remove(id)
    notifyChange(flowStore.listWithRoutes(routeStore))
    return { success: true }
  })

  ipcMain.handle('flows:start', async (_e, id) => {
    const file = flowStore.get(id)
    if (!file) return { ok: false, error: 'Flow not found' }
    if (file.flow.status === 'active') {
      return { ok: false, error: 'Flow is already active' }
    }
    if (file.flow.status === 'completed') {
      return {
        ok: false,
        error: 'Flow already completed — delete it and create a new one to re-run.',
      }
    }

    const cards = file.flow.cards || []
    const connections = file.flow.connections || []

    // Load employees to look up cantonPartyId
    let employees = []
    try {
      const empPath = require('path').join(require('electron').app.getPath('userData'), 'employees.json')
      const empData = JSON.parse(require('fs').readFileSync(empPath, 'utf-8'))
      employees = Array.isArray(empData?.employees) ? empData.employees : []
    } catch { employees = [] }
    const empById = new Map(employees.map(e => [e.id, e]))

    // Build lookup maps
    const incoming = new Map()
    for (const conn of connections) {
      const arr = incoming.get(conn.to) || []
      arr.push(conn.from)
      incoming.set(conn.to, arr)
    }
    const outgoing = new Map()
    for (const conn of connections) {
      const arr = outgoing.get(conn.from) || []
      arr.push(conn.to)
      outgoing.set(conn.from, arr)
    }

    const cardsById = new Map(cards.map(c => [c.placementId, c]))

    // Prime routes: create one pending route per payee card
    const payeeCards = cards.filter((c) => c.category === 'payee')
    for (const card of payeeCards) {
      // Find connected source (incoming edge)
      const upstreamIds = incoming.get(card.placementId) || []
      const sourceCard = upstreamIds.length > 0 ? cardsById.get(upstreamIds[0]) : null
      // Find connected payment (outgoing edge)
      const downstreamIds = outgoing.get(card.placementId) || []
      const paymentCard = downstreamIds.length > 0 ? cardsById.get(downstreamIds[0]) : null

      const employeeId = card.payeeFields?.employeeId || ''
      const employee = empById.get(employeeId)
      const recipientPartyId = employee?.cantonPartyId || ''

      routeStore.upsert({
        flowId: id,
        status: 'pending',
        employeeId: employeeId,
        payeePlacementId: card.placementId,
        sourcePlacementId: sourceCard ? sourceCard.placementId : card.placementId,
        paymentPlacementId: paymentCard ? paymentCard.placementId : card.placementId,
        amountCC: '0',
        payCurrency: 'USD',
        grossPay: '0',
        recipientPartyId: recipientPartyId,
        memo: '',
      })
    }
    flowStore.setStatus(id, 'active')
    notifyChange(flowStore.listWithRoutes(routeStore))
    notifyProgress(id, routeStore.list(id))
    return { ok: true }
  })

  ipcMain.handle('flows:stop', (_e, id) => {
    const file = flowStore.get(id)
    if (!file) return { ok: false, error: 'Flow not found' }
    if (file.flow.status !== 'active') {
      return { ok: false, error: 'Flow is not active' }
    }
    // Mark in-flight routes as failed
    const routes = routeStore.list(id)
    for (const route of routes) {
      if (route.status !== 'settled' && route.status !== 'failed') {
        routeStore.upsert({
          ...route,
          status: 'failed',
          error: 'Stopped by user',
        })
      }
    }
    flowStore.setStatus(id, 'draft')
    notifyChange(flowStore.listWithRoutes(routeStore))
    notifyProgress(id, routeStore.list(id))
    return { ok: true }
  })

  ipcMain.handle('flows:routes:list', (_e, flowId) => {
    return routeStore.list(flowId)
  })

  ipcMain.handle('flows:routes:listAll', () => {
    return routeStore.listAll()
  })

  ipcMain.handle('flows:routes:get', (_e, flowId, routeId) => {
    return routeStore.get(flowId, routeId)
  })

  console.log('[flows] IPC handlers registered')
}

module.exports = { registerFlowIpcHandlers, FlowStore, getFlowStore: () => flowStore, getRouteStore: () => routeStore }
