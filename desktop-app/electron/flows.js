// IPC handlers for the payroll flow builder.
//
// Mirrors the company/employee patterns:
//   - one registerFlowIpcHandlers function called from main/index.js
//   - save/remove/start/stop push flows:onChange so every
//     subscribed renderer reacts in lock-step

const { ipcMain, BrowserWindow } = require('electron')
const { FlowStore } = require('./flowStore')
const { RouteStore } = require('./routeStore')
const { enumerateRoutes } = require('./shared/flowPaths')

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
      return { ok: false, error: 'Flow already completed — delete it and create a new one to re-run.' }
    }

    // Load employees
    let employees = []
    try {
      const empPath = require('path').join(require('electron').app.getPath('userData'), 'employees.json')
      const empData = JSON.parse(require('fs').readFileSync(empPath, 'utf-8'))
      employees = Array.isArray(empData?.employees) ? empData.employees : []
    } catch { employees = [] }

    // Load company profile
    let companyProfile = null
    try {
      const compPath = require('path').join(require('electron').app.getPath('userData'), 'company.json')
      const compData = JSON.parse(require('fs').readFileSync(compPath, 'utf-8'))
      companyProfile = compData?.profile || null
    } catch { companyProfile = null }

    // Use enumerateRoutes to compute proper routes with amounts
    const result = enumerateRoutes({
      flowId: id,
      cards: file.flow.cards || [],
      connections: file.flow.connections || [],
      employees,
      companyProfile
    })

    if (result.routes.length === 0) {
      return { ok: false, error: 'No valid routes found. Make sure each Payee is connected to a Source and Payment card, and the employee has a valid salary.' }
    }

    // Persist each computed route
    for (const route of result.routes) {
      routeStore.upsert(route)
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
