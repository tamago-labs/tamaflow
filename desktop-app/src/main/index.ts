import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, resolve } from 'path'
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

// ─── Pear-runtime worker plumbing ──────────────────────────────────────
const os = require('os') as typeof import('os')
const FramedStream = require('framed-stream')
const { command, flag } = require('paparam')

app.commandLine.appendSwitch('no-sandbox')

// ─── CLI flags (mirrors v2's electron/main.js) ─────────────────────────

const mainWorkerSpecifier = '/workers/main.js'
const roomWorkerSpecifier = '/workers/tamaflow-room-entry.js'

const pkg = require('../../package.json') as { name: string; productName?: string; version: string }
const appName = pkg.productName ?? pkg.name

const cmd = command(
  appName,
  flag('--storage <dir>', 'pass custom storage to pear-runtime'),
  flag('--no-updates', 'start without OTA updates'),
  flag('--no-sandbox', 'start without Chromium sandbox').hide(),
  flag('--name <name>', 'Your display name (shown in chat)'),
  flag('--invite <invite>', 'Join an existing Tamaflow room via invite code'),
  flag('--writer <hex>', 'Override the writer key (hex) for testing'),
)

cmd.parse(process.argv.slice(2))

const pearStore = cmd.flags.storage ? resolve(cmd.flags.storage) : null
const displayName = (cmd.flags as Record<string, unknown>).name as string | null || null
let currentJoinInvite = (cmd.flags as Record<string, unknown>).invite as string | null || null
const writerKey = (cmd.flags as Record<string, unknown>).writer as string | null || null

if (pearStore) app.setPath('userData', pearStore)

// ─── Worker pipe management ────────────────────────────────────────────

interface WorkerEntry {
  pipe: ReturnType<typeof FramedStream>
  torn: boolean
}

const workers = new Map<string, WorkerEntry>()

function getWorkerDir(): string {
  if (app.isPackaged) {
    // In production with electron-builder + asar: workers are unpacked
    // to `<resources>/app.asar.unpacked/workers/`.
    return join(process.resourcesPath, 'app.asar.unpacked')
  }
  // In dev, workers are at the project root.
  return process.cwd()
}

function sendToAll(name: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(name, data)
  }
}

function getWorker(specifier: string): ReturnType<typeof FramedStream> {
  if (workers.has(specifier)) return workers.get(specifier)!.pipe

  const pearDir = pearStore
    ? pearStore
    : join(os.homedir(), 'AppData', 'Roaming', appName)

  const argv = [pearDir, process.execPath, 'false', pkg.version, '', appName + '.exe']
  if (specifier === roomWorkerSpecifier) {
    if (displayName) argv.push('--name', displayName)
    if (currentJoinInvite) argv.push('--invite', currentJoinInvite)
    if (writerKey) argv.push('--writer', writerKey)
  }

  const workerPath = join(getWorkerDir(), specifier.slice(1))
  const PearRuntime = require('pear-runtime')
  const worker = PearRuntime.run(workerPath, argv)
  const pipe = new FramedStream(worker)

  function sendWorkerStdout(data: Buffer): void {
    process.stdout.write(data)
    sendToAll('pear:worker:stdout:' + specifier, data)
  }
  function sendWorkerStderr(data: Buffer): void {
    process.stderr.write(data)
    sendToAll('pear:worker:stderr:' + specifier, data)
  }
  function sendWorkerIPC(data: Buffer): void {
    if (specifier === roomWorkerSpecifier) {
      const text = data.toString()
      try {
        const frame = JSON.parse(text)
        if (frame && typeof frame === 'object') {
          if (frame.type === 'me' && typeof frame.key === 'string') {
            setLocalWriterKey(frame.key)
          }
        }
      } catch {
        // Not JSON or unparseable — forward as-is.
      }
    }
    sendToAll('pear:worker:ipc:' + specifier, data)
  }
  function onBeforeQuit(): void {
    pipe.destroy()
  }
  ipcMain.handle('pear:worker:writeIPC:' + specifier, (_evt, data) => {
    return pipe.write(data)
  })
  const entry: WorkerEntry = { pipe, torn: false }
  workers.set(specifier, entry)
  pipe.on('data', sendWorkerIPC)
  worker.stdout.on('data', sendWorkerStdout)
  worker.stderr.on('data', sendWorkerStderr)
  worker.once('exit', (code: number) => {
    if (entry.torn) return
    entry.torn = true
    app.removeListener('before-quit', onBeforeQuit)
    ipcMain.removeHandler('pear:worker:writeIPC:' + specifier)
    pipe.removeListener('data', sendWorkerIPC)
    worker.stdout.removeListener('data', sendWorkerStdout)
    worker.stderr.removeListener('data', sendWorkerStderr)
    sendToAll('pear:worker:exit:' + specifier, code)
    workers.delete(specifier)
  })
  app.on('before-quit', onBeforeQuit)
  return pipe
}

function restartRoomWorker(invite: string | null): ReturnType<typeof FramedStream> {
  const existing = workers.get(roomWorkerSpecifier)
  if (existing) {
    existing.torn = true
    ipcMain.removeHandler('pear:worker:writeIPC:' + roomWorkerSpecifier)
    existing.pipe.removeAllListeners('data')
    workers.delete(roomWorkerSpecifier)
    sendToAll('pear:worker:exit:' + roomWorkerSpecifier, null)
    existing.pipe.destroy()
  }
  currentJoinInvite = invite || null
  return getWorker(roomWorkerSpecifier)
}

// ─── Local writer key (z32) ────────────────────────────────────────────

function setLocalWriterKey(_z32key: string): void {
  // Phase 4: will be stored and used for relay routing.
}

// ─── Worker lifecycle IPC ──────────────────────────────────────────────

function registerWorkerIpc(): void {
  ipcMain.handle('pear:startWorker', (_evt, specifier: string) => {
    getWorker(specifier)
    return true
  })
  ipcMain.handle('pear:joinWithInvite', (_evt, invite: string) => {
    restartRoomWorker(invite)
    return { success: true }
  })
  console.log('Worker IPC handlers registered')
}

// ─── Existing v1 code ─────────────────────────────────────────────────

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

  ipcMain.handle('models:select', async (_, id: string) => {
    const entry = modelStore.getById(id)
    if (!entry) {
      return { success: false, error: 'Unknown model id' }
    }

    try {
      await cancelCurrentRequest()
      const prevId = getActiveModelId()
      if (prevId) {
        await unloadCurrent(prevId)
      }
      modelStore.setLastSelected(entry.id)
      await ensureModel(entry)
      return { success: true }
    } catch (err) {
      const mapped = mapError(err)
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
  electronApp.setAppUserModelId('com.tamagolabs.flow')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ensureQvacConfig()

  // Register IPC handlers
  registerModelsIpcHandlers()
  registerWalletIpcHandlers()
  registerCompanyIpcHandlers()
  registerEmployeeIpcHandlers()
  registerFlowIpcHandlers()
  registerWorkerIpc()

  createWindow()

  setMainWindow(win)

  flowWorker.start()

  // Start the updater worker immediately (same as v2).
  try {
    getWorker(mainWorkerSpecifier)
  } catch (err) {
    console.warn('[App] failed to start updater worker:', err)
  }

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
  flowWorker.stop()

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

export { getActiveEntry }
