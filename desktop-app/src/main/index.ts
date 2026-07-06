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
  getLocalAiStateSnapshot,
  setStreamingNow,
} from './qvac'
import { modelStore, type ModelEntry, type ModelSourceKind } from './modelStore'
import { registerWalletIpcHandlers } from './wallet'
import { registerCompanyIpcHandlers } from './company'
import { registerEmployeeIpcHandlers } from './employee'
import { registerFlowIpcHandlers } from './flows'
import { flowWorker } from './flowWorker'
import * as aiChat from './aiChat'
import * as sessions from './sessions'

// ─── Pear-runtime worker plumbing ──────────────────────────────────────
const os = require('os') as typeof import('os')
const FramedStream = require('framed-stream')
const { command, flag } = require('paparam')

app.commandLine.appendSwitch('no-sandbox')

// ─── CLI flags (mirrors v2's electron/main.js) ─────────────────────────

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

// electron-vite uses `cac` for strict CLI parsing, so flags like
// --invite and --storage crash it before the dev server starts.
// scripts/dev.js intercepts those flags and writes them to a temp
// file we read here.
let electronCliArgs: string[] = []
const argsFile = process.env.TAMAFLOW_DEV_ARGS_FILE
if (argsFile) {
  try {
    const fs = require('fs') as typeof import('fs')
    electronCliArgs = JSON.parse(fs.readFileSync(argsFile, 'utf-8'))
  } catch {
    electronCliArgs = []
  }
}
if (electronCliArgs.length > 0) {
  cmd.parse(electronCliArgs)
}

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
          } else if (frame.type === 'relay-run') {
            handleRelayRun(frame).catch((err) => {
              console.error('[main] handleRelayRun failed:', err)
            })
            return
          } else if (frame.type === 'relay-cancel') {
            handleRelayCancel(frame)
            return
          } else if (frame.type === 'ai-states') {
            setLastPeerAiStates(frame.states)
          } else if (frame.type === 'relay-event') {
            sendToAll('ai:chat:relay-event', {
              requestId: frame.requestId,
              kind: frame.kind,
              text: frame.text ?? null,
              error: frame.error ?? null
            })
            return
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

let localWriterKey: string | null = null

function setLocalWriterKey(z32key: string): void {
  localWriterKey = z32key
}

function getLocalWriterKey(): string | null {
  return localWriterKey
}

// ─── AI state broadcast ───────────────────────────────────────────────

function pushAiStateToRoomWorker(): void {
  const pipe = workers.get(roomWorkerSpecifier)?.pipe
  if (!pipe) return
  const snapshot = getLocalAiStateSnapshot()
  try {
    pipe.write(JSON.stringify({ type: 'ai-state-snapshot', snapshot }))
  } catch (err) {
    console.warn('[main] pushAiStateToRoomWorker write failed:', err)
  }
}

// ─── Relay routing ────────────────────────────────────────────────────

const b4a = require('b4a')
const z32 = require('z32')

function z32ToHex(z32Key: string): string | null {
  if (typeof z32Key !== 'string' || z32Key.length === 0) return null
  try {
    return b4a.toString(z32.decode(z32Key), 'hex')
  } catch {
    return null
  }
}

const RELAY_COALESCE_MS = 50
const relayHandlers = new Map<string, {
  requestId: string
  fromKey: string
  toKey: string
  fromKeyHex: string
  toKeyHex: string
  pendingText: string | null
  pendingKind: string | null
  flushTimer: ReturnType<typeof setTimeout> | null
  closed: boolean
}>()

function routeChatCompletion({
  requestId,
  targetWriterKey,
  messages,
  modelId
}: {
  requestId: string
  targetWriterKey: string
  messages: unknown[]
  modelId: string
}) {
  if (!requestId || !targetWriterKey || !messages?.length || !modelId) {
    return { success: false, error: 'Missing required fields' }
  }
  const pipe = workers.get(roomWorkerSpecifier)?.pipe
  if (!pipe) return { success: false, error: 'Worker not running' }
  const myKeyZ32 = getLocalWriterKey()
  if (!myKeyZ32) return { success: false, error: 'Local writer key not ready' }
  const myKey = z32ToHex(myKeyZ32)
  const toKey = z32ToHex(targetWriterKey)
  if (!myKey || !toKey) {
    return { success: false, error: 'Writer key encoding failed' }
  }
  try {
    pipe.write(JSON.stringify({
      type: 'relay-request',
      requestId,
      fromKey: myKey,
      toKey,
      messages,
      modelId,
      createdAt: Date.now()
    }))
    return { success: true, requestId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Write failed' }
  }
}

function cancelRouteChat(requestId: string) {
  if (!requestId) return { success: false, error: 'requestId required' }
  const pipe = workers.get(roomWorkerSpecifier)?.pipe
  if (!pipe) return { success: false }
  const myKeyZ32 = getLocalWriterKey()
  if (!myKeyZ32) return { success: false }
  const myKey = z32ToHex(myKeyZ32)
  if (!myKey) return { success: false, error: 'Writer key encoding failed' }
  const handler = relayHandlers.get(requestId)
  const toKey = handler?.toKey ? z32ToHex(handler.toKey) : null
  try {
    pipe.write(JSON.stringify({
      type: 'relay-cancel',
      requestId,
      fromKey: myKey,
      toKey
    }))
  } catch { /* best-effort */ }
  return { success: true }
}

async function handleRelayRun({
  requestId,
  fromKey,
  messages,
  modelId
}: {
  requestId: string
  fromKey: string
  messages: unknown[]
  modelId: string
}) {
  if (relayHandlers.has(requestId)) return // duplicate

  const entry = {
    requestId,
    fromKey,
    toKey: getLocalWriterKey()!,
    fromKeyHex: '',
    toKeyHex: '',
    pendingText: null as string | null,
    pendingKind: null as string | null,
    flushTimer: null as ReturnType<typeof setTimeout> | null,
    closed: false
  }
  relayHandlers.set(requestId, entry)

  entry.fromKeyHex = z32ToHex(entry.fromKey)!
  entry.toKeyHex = z32ToHex(entry.toKey)!
  if (!entry.fromKeyHex || !entry.toKeyHex) {
    sendRelayError(entry, 'BAD_KEY', 'Writer key encoding failed')
    sendRelayDone(entry)
    closeRelay(entry)
    return
  }

  function flushBuffered() {
    if (entry.closed) return
    if (entry.pendingText == null && entry.pendingKind == null) return
    const pipe = workers.get(roomWorkerSpecifier)?.pipe
    if (!pipe) return
    try {
      pipe.write(JSON.stringify({
        type: 'relay-response',
        requestId: entry.requestId,
        fromKey: entry.toKeyHex,
        toKey: entry.fromKeyHex,
        kind: entry.pendingKind,
        ...(entry.pendingText != null ? { text: entry.pendingText } : {})
      }))
    } catch (err) {
      console.warn('[main] relay-response write failed:', err)
    }
    entry.pendingText = null
    entry.pendingKind = null
    entry.flushTimer = null
  }

  function buffer(kind: string, text: string) {
    if (entry.closed) return
    if (entry.pendingKind && entry.pendingKind !== kind) flushBuffered()
    entry.pendingKind = kind
    entry.pendingText = (entry.pendingText ?? '') + (text ?? '')
    if (entry.flushTimer) return
    entry.flushTimer = setTimeout(flushBuffered, RELAY_COALESCE_MS)
  }

  function sendImmediate(kind: string, extra?: Record<string, unknown>) {
    if (entry.closed) return
    flushBuffered()
    const pipe = workers.get(roomWorkerSpecifier)?.pipe
    if (!pipe) return
    try {
      pipe.write(JSON.stringify({
        type: 'relay-response',
        requestId: entry.requestId,
        fromKey: entry.toKeyHex,
        toKey: entry.fromKeyHex,
        kind,
        ...(extra || {})
      }))
    } catch (err) {
      console.warn('[main] relay-response write failed:', err)
    }
  }

  function sendRelayError(_e: typeof entry, code: string, message: string) {
    sendImmediate('error', { error: { code, message, retryable: false } })
  }

  function sendRelayDone(_e: typeof entry, extra?: Record<string, unknown>) {
    sendImmediate('done', extra)
  }

  function closeRelay(e: typeof entry) {
    if (e.closed) return
    e.closed = true
    if (e.flushTimer) { clearTimeout(e.flushTimer); e.flushTimer = null }
    flushBuffered()
    relayHandlers.delete(e.requestId)
  }

  try {
    const { completion } = require('@qvac/sdk')
    const entryIdLive = getActiveEntry()?.id ?? null
    const modelIdLive = getActiveModelId()
    if (!modelIdLive || !entryIdLive || entryIdLive !== modelId) {
      sendImmediate('error', { error: { code: 'MODEL_MISMATCH', message: 'Model not loaded here', retryable: false } })
      sendImmediate('done')
      closeRelay(entry)
      return
    }
    if (!getLocalAiStateSnapshot().accepting) {
      sendImmediate('busy')
      sendImmediate('done')
      closeRelay(entry)
      return
    }
    setStreamingNow(true)
    const history = (messages as Array<{ role: string; content: string }>)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    const run = completion({ modelId: modelIdLive, history, stream: true, kvCache: true, captureThinking: true })
    sendImmediate('started', { requestId })
    for await (const event of run.events as AsyncIterable<{ type: string; text?: string; stopReason?: string; error?: { message: string } }>) {
      if (entry.closed) break
      if (event.type === 'contentDelta') {
        buffer('token', event.text ?? '')
      } else if (event.type === 'thinkingDelta') {
        buffer('thinking', event.text ?? '')
      } else if (event.type === 'completionDone') {
        flushBuffered()
        if (event.stopReason === 'error' && event.error) {
          sendImmediate('error', { error: { code: 'COMPLETION_ERROR', message: event.error.message, retryable: true } })
        }
        sendImmediate('done', { stopReason: event.stopReason ?? 'eos' })
        break
      }
    }
    setStreamingNow(false)
    pushAiStateToRoomWorker()
  } catch (err) {
    setStreamingNow(false)
    const mapped = mapError(err)
    sendImmediate('error', { error: mapped })
    sendImmediate('done')
  } finally {
    closeRelay(entry)
  }
}

function handleRelayCancel({ requestId }: { requestId: string }) {
  const entry = relayHandlers.get(requestId)
  if (!entry) return
  entry.closed = true
  if (entry.flushTimer) { clearTimeout(entry.flushTimer); entry.flushTimer = null }
  try {
    const sdk = require('@qvac/sdk')
    sdk.cancel({}).catch(() => {})
  } catch { /* ignore */ }
  relayHandlers.delete(requestId)
}

// ─── Peer AI state cache ──────────────────────────────────────────────

let lastPeerAiStates: Array<{
  writerKey: string
  modelId: string | null
  modelName: string | null
  loadedAt: number | null
  accepting: boolean
}> = []

function setLastPeerAiStates(states: unknown): void {
  lastPeerAiStates = Array.isArray(states) ? (states as typeof lastPeerAiStates) : []
  sendToAll('ai:peerStates', lastPeerAiStates)
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
      pushAiStateToRoomWorker()
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
      pushAiStateToRoomWorker()
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
// AI Chat + Sessions IPC Handlers
// ============================================

function registerChatIpc(): void {
  ipcMain.handle('chat:send', async (_, args) => {
    return aiChat.sendMessage({ messages: args?.messages ?? [] })
  })
  ipcMain.handle('chat:cancel', () => aiChat.cancelMessage())
  ipcMain.handle('chat:status', () => aiChat.getStatus())

  // P2P relay — route a completion to a peer's model
  ipcMain.handle('chat:route', (_, args) => {
    return routeChatCompletion(args)
  })
  ipcMain.handle('chat:routeCancel', (_, args) => {
    return cancelRouteChat(args?.requestId)
  })

  ipcMain.handle('sessions:list', () => sessions.listSessions())
  ipcMain.handle('sessions:create', () => sessions.createSession())
  ipcMain.handle('sessions:delete', (_, slug: string) => sessions.deleteSession(slug))
  ipcMain.handle('sessions:clear', (_, slug: string) => sessions.clearMessages(slug))
  ipcMain.handle('sessions:load', (_, slug: string) => {
    try {
      return { success: true, messages: sessions.loadMessages(slug) }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Load failed',
        messages: []
      }
    }
  })
  ipcMain.handle('sessions:save', (_, slug: string, messages: unknown[]) => {
    return sessions.saveMessages(slug, messages)
  })

  // Peer AI states — served from the cache that the room worker populates
  ipcMain.handle('aiSourcePeers:list', () => lastPeerAiStates)

  console.log('AI chat / sessions / relay IPC handlers registered')
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
  registerChatIpc()

  createWindow()

  setMainWindow(win)
  aiChat.setMainWindow(win)

  sessions.ensureMainSession()

  flowWorker.start()

  // Phase 1: only start the room worker. The updater worker
  // (`/workers/main.js`) requires a Pear `upgrade` link in
  // package.json which v1 doesn't ship yet (we use
  // electron-builder, not Pear's OTA system). Re-enable this
  // once v1 has a real upgrade flow.
  try {
    getWorker(roomWorkerSpecifier)
  } catch (err) {
    console.warn('[App] failed to start room worker:', err)
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
