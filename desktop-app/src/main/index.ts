import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  ensureQvacConfig,
  setMainWindow,
  ensureModel,
  cancelCurrentRequest,
  unloadCurrent,
  getActiveModelId,
  getActiveEntry,
  buildStatus,
  resetCache,
  mapError,
} from './qvac'
import { modelStore, type ModelEntry, type ModelSourceKind } from './modelStore'
import { registerWalletIpcHandlers } from './wallet'
import { registerCompanyIpcHandlers } from './company'
import { registerEmployeeIpcHandlers } from './employee'
import { registerFlowIpcHandlers } from './flows'
import { flowWorker } from './flowWorker'

app.commandLine.appendSwitch('no-sandbox')

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win!.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

interface ModelsStatus {
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

// ============================================
// Models IPC Handlers
// ============================================

function registerModelsIpcHandlers(): void {
  // List every model in the registry.
  ipcMain.handle('models:list', () => {
    return modelStore.getAll()
  })

  ipcMain.handle(
    'models:add',
    (
      _,
      entry: { name: string; source: string; description?: string; quantization?: string; params?: string },
    ) => {
      if (!entry?.name?.trim() || !entry?.source?.trim()) {
        throw new Error('Both name and source are required')
      }
      const trimmed = entry.source.trim()
      return modelStore.add({
        name: entry.name.trim(),
        source: trimmed,
        description: entry.description?.trim(),
        quantization: entry.quantization?.trim(),
        params: entry.params?.trim(),
      })
    },
  )

  ipcMain.handle('models:remove', (_, id: string) => {
    return modelStore.remove(id)
  })

  ipcMain.handle('models:status', (): ModelsStatus => {
    return buildStatus() as ModelsStatus
  })

  // Open a file picker so the renderer can add a local .gguf model.
  ipcMain.handle('models:pickFile', async () => {
    const cur = win ?? BrowserWindow.getFocusedWindow()
    if (!cur) return null
    const result = await dialog.showOpenDialog(cur, {
      title: 'Select a GGUF model file',
      properties: ['openFile'],
      filters: [
        { name: 'GGUF Models', extensions: ['gguf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const picked = result.filePaths[0]
    if (!picked.toLowerCase().endsWith('.gguf')) {
      throw new Error('Selected file is not a .gguf model')
    }
    return picked
  })

  // Drive the actual download + load for the selected entry.
  ipcMain.handle('models:select', async (_, id: string) => {
    const entry = modelStore.getById(id)
    if (!entry) {
      return { success: false, error: 'Unknown model id' }
    }

    try {
      // Cancel any in-flight request and unload the currently-loaded model.
      await cancelCurrentRequest()
      const prevId = getActiveModelId()
      if (prevId) {
        await unloadCurrent(prevId)
      }
      // Mark this entry as the user's most recent choice.
      modelStore.setLastSelected(entry.id)
      // Drive the download + load.
      await ensureModel(entry)
      return { success: true }
    } catch (err) {
      const mapped = mapError(err)
      // Surface the error to the renderer via the push channel too.
      win?.webContents.send('models:error', mapped)
      return { success: false, error: mapped.message }
    }
  })

  ipcMain.handle('models:cancel', async (_, opts?: { clearCache?: boolean }) => {
    await cancelCurrentRequest({ clearCache: opts?.clearCache })
    return { success: true }
  })

  ipcMain.handle('models:resetCache', async (_, id: string) => {
    const entry = modelStore.getById(id)
    if (!entry) {
      return { success: false, deleted: [], error: 'Unknown model id' }
    }
    return resetCache(entry)
  })

  // ai:unload → unload current model.
  ipcMain.handle('ai:unload', async () => {
    const id = getActiveModelId()
    if (!id) return { success: true }
    try {
      await unloadCurrent(id)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unload model'
      return { success: false, error: message }
    }
  })

  // Lightweight getStatus shim that the renderer can poll if needed.
  ipcMain.handle('ai:getStatus', () => {
    const status = buildStatus()
    return {
      isReady: status.active.loaded,
      modelName: status.active.name || (status.active.loaded ? 'Model' : 'Loading'),
      uptime: status.active.loadedAt
        ? Math.floor((Date.now() - status.active.loadedAt) / 1000)
        : 0,
      downloading: status.active.requestId !== null,
      downloadProgress: 0,
    }
  })

  console.log('Models IPC handlers registered')
}

// ============================================
// App Lifecycle
// ============================================

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.tamagolabs.flow')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Write QVAC config BEFORE any loadModel call so the worker writes
  // its cache to a path we can inspect.
  ensureQvacConfig()

  // Register IPC handlers
  registerModelsIpcHandlers()
  registerWalletIpcHandlers()
  registerCompanyIpcHandlers()
  registerEmployeeIpcHandlers()
  registerFlowIpcHandlers()

  // Create window
  createWindow()

  // Hand the BrowserWindow off to the QVAC layer so it can push
  // `models:progress` / `models:error` events.
  setMainWindow(win)

  // Boot the payroll worker. It ticks every 1.5s, processes active
  // flows one route at a time, and pushes `flows:onProgress` for
  // every status transition. Started AFTER the window so the very
  // first tick has somewhere to emit to.
  flowWorker.start()

  console.log('[App] Tamaflow ready')

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  // Stop the payroll worker so it doesn't fire mid-shutdown.
  flowWorker.stop()

  // Cancel any in-flight request with clearCache so partial files
  // are unlinked at the SDK level.
  try {
    await cancelCurrentRequest({ clearCache: true })
  } catch (e) {
    console.warn('[qvac] before-quit cancel failed:', e)
  }

  const modelId = getActiveModelId()
  if (modelId) {
    try {
      await unloadCurrent(modelId)
      console.log('[qvac] Model unloaded on exit')
    } catch (error) {
      console.error('Failed to unload model:', error)
    }
  }
})

// Re-export `getActiveEntry` so the renderer preload can keep a
// reference if it ever needs to (currently unused).
export { getActiveEntry }
