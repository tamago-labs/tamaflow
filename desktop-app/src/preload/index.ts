import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ModelEntry,
  ModelLoadProgress,
  ModelErrorPayload,
  ModelStatus,
  WalletStatus,
  WalletCreateResult,
  Holding,
  FaucetResult,
  TransferParams,
  TransferResult,
  PendingTransfer,
  RecipientResult,
  CompanyProfile,
  CompanyFile,
  CompanyExportResult,
  CompanyImportResult,
  Employee,
  EmployeeFile,
  EmployeeExportResult,
  EmployeeImportResult,
  FlowDefinition,
  FlowFile,
  FlowSummary,
  RouteSummary,
  RouteRecord,
} from './index.d'

// Custom APIs for renderer
const api = {
  models: {
    list: (): Promise<ModelEntry[]> => ipcRenderer.invoke('models:list'),
    add: (entry: {
      name: string
      source: string
      description?: string
      quantization?: string
      params?: string
    }): Promise<ModelEntry> => ipcRenderer.invoke('models:add', entry),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke('models:remove', id),
    select: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('models:select', id),
    cancel: (opts?: { clearCache?: boolean }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('models:cancel', opts),
    resetCache: (id: string): Promise<{ success: boolean; deleted: string[]; error?: string }> =>
      ipcRenderer.invoke('models:resetCache', id),
    status: (): Promise<ModelStatus> => ipcRenderer.invoke('models:status'),
    pickFile: (): Promise<string | null> => ipcRenderer.invoke('models:pickFile'),
    onProgress: (callback: (progress: ModelLoadProgress) => void) => {
      const handler = (_: unknown, progress: ModelLoadProgress) => callback(progress)
      ipcRenderer.on('models:progress', handler)
      return () => ipcRenderer.removeListener('models:progress', handler)
    },
    onError: (callback: (err: ModelErrorPayload) => void) => {
      const handler = (_: unknown, err: ModelErrorPayload) => callback(err)
      ipcRenderer.on('models:error', handler)
      return () => ipcRenderer.removeListener('models:error', handler)
    },
  },

  ai: {
    getStatus: (): Promise<{
      isReady: boolean
      modelName: string
      uptime: number
      downloading: boolean
      downloadProgress: number
    }> => ipcRenderer.invoke('ai:getStatus'),
    unload: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('ai:unload'),
  },

  wallet: {
    status: (): Promise<WalletStatus> => ipcRenderer.invoke('wallet:status'),
    create: (opts?: { partyHint?: string }): Promise<WalletCreateResult> =>
      ipcRenderer.invoke('wallet:create', opts),
    destroy: (): Promise<{ success: boolean }> => ipcRenderer.invoke('wallet:destroy'),
    exportKey: (): Promise<{ success: boolean; privateKey?: string; error?: string }> =>
      ipcRenderer.invoke('wallet:exportKey'),
    holdings: (): Promise<Holding[]> => ipcRenderer.invoke('wallet:holdings'),
    faucet: (amount?: string): Promise<FaucetResult> =>
      ipcRenderer.invoke('wallet:faucet', amount),
    transfer: (params: TransferParams): Promise<TransferResult> =>
      ipcRenderer.invoke('wallet:transfer', params),
    pendingTransfers: (): Promise<PendingTransfer[]> =>
      ipcRenderer.invoke('wallet:pendingTransfers'),
    accept: (contractId: string): Promise<RecipientResult> =>
      ipcRenderer.invoke('wallet:accept', contractId),
    reject: (contractId: string): Promise<RecipientResult> =>
      ipcRenderer.invoke('wallet:reject', contractId),
    onChange: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('wallet:onChange', handler)
      return () => ipcRenderer.removeListener('wallet:onChange', handler)
    },
  },

  company: {
    get: (): Promise<CompanyFile | null> => ipcRenderer.invoke('company:get'),
    save: (profile: CompanyProfile): Promise<CompanyFile> =>
      ipcRenderer.invoke('company:save', profile),
    exportJson: (): Promise<CompanyExportResult> => ipcRenderer.invoke('company:export'),
    importJson: (): Promise<CompanyImportResult> => ipcRenderer.invoke('company:import'),
    reset: (): Promise<{ success: boolean }> => ipcRenderer.invoke('company:reset'),
    onChange: (callback: (file: CompanyFile | null) => void) => {
      const handler = (_: unknown, file: CompanyFile | null) => callback(file)
      ipcRenderer.on('company:onChange', handler)
      return () => ipcRenderer.removeListener('company:onChange', handler)
    },
  },

  employees: {
    get: (): Promise<EmployeeFile | null> => ipcRenderer.invoke('employees:get'),
    save: (employees: Employee[]): Promise<EmployeeFile> =>
      ipcRenderer.invoke('employees:save', employees),
    remove: (id: string): Promise<EmployeeFile | null> =>
      ipcRenderer.invoke('employees:remove', id),
    exportJson: (): Promise<EmployeeExportResult> => ipcRenderer.invoke('employees:export'),
    importJson: (): Promise<EmployeeImportResult> => ipcRenderer.invoke('employees:import'),
    reset: (): Promise<{ success: boolean }> => ipcRenderer.invoke('employees:reset'),
    onChange: (callback: (file: EmployeeFile | null) => void) => {
      const handler = (_: unknown, file: EmployeeFile | null) => callback(file)
      ipcRenderer.on('employees:onChange', handler)
      return () => ipcRenderer.removeListener('employees:onChange', handler)
    },
  },

  flows: {
    list: (): Promise<FlowSummary[]> => ipcRenderer.invoke('flows:list'),
    get: (id: string): Promise<FlowFile | null> =>
      ipcRenderer.invoke('flows:get', id),
    save: (
      flow: Omit<FlowDefinition, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string
        createdAt?: string
        updatedAt?: string
      },
    ): Promise<FlowFile> => ipcRenderer.invoke('flows:save', flow),
    remove: (id: string): Promise<FlowSummary[]> =>
      ipcRenderer.invoke('flows:remove', id),
    start: (id: string): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('flows:start', id),
    stop: (id: string): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('flows:stop', id),
    routes: {
      list: (flowId: string): Promise<RouteSummary[]> =>
        ipcRenderer.invoke('flows:routes:list', flowId),
      listAll: (): Promise<RouteSummary[]> =>
        ipcRenderer.invoke('flows:routes:listAll'),
      get: (flowId: string, routeId: string): Promise<RouteRecord | null> =>
        ipcRenderer.invoke('flows:routes:get', flowId, routeId),
    },
    onChange: (callback: (list: FlowSummary[]) => void) => {
      const handler = (_: unknown, list: FlowSummary[]) => callback(list)
      ipcRenderer.on('flows:onChange', handler)
      return () => ipcRenderer.removeListener('flows:onChange', handler)
    },
    onProgress: (callback: (flowId: string, routes: RouteSummary[]) => void) => {
      const handler = (_: unknown, flowId: string, routes: RouteSummary[]) =>
        callback(flowId, routes)
      ipcRenderer.on('flows:onProgress', handler)
      return () => ipcRenderer.removeListener('flows:onProgress', handler)
    },
  },
}

// P2P worker bridge — mirrors v2's electron/preload.js bridge surface.
// The renderer calls these via `window.bridge.*` (exposed below).
function toBuffer(data: unknown): unknown {
  if (data === null || data === undefined || typeof data === 'number') return data
  return Buffer.from((data as { buffer: ArrayBuffer; byteOffset: number; byteLength: number }).buffer, (data as { byteOffset: number }).byteOffset, (data as { byteLength: number }).byteLength)
}

const bridge = {
  startWorker: (specifier: string): Promise<boolean> =>
    ipcRenderer.invoke('pear:startWorker', specifier),
  joinWithInvite: (invite: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('pear:joinWithInvite', invite),
  writeWorkerIPC: (specifier: string, data: string): Promise<void> =>
    ipcRenderer.invoke('pear:worker:writeIPC:' + specifier, data),
  onWorkerIPC: (specifier: string, listener: (data: Uint8Array) => void): (() => void) => {
    const wrap = (_evt: unknown, data: unknown) => listener(toBuffer(data) as Uint8Array)
    ipcRenderer.on('pear:worker:ipc:' + specifier, wrap)
    return () => ipcRenderer.removeListener('pear:worker:ipc:' + specifier, wrap)
  },
  onWorkerExit: (specifier: string, listener: (code: number | null) => void): (() => void) => {
    const wrap = (_evt: unknown, code: unknown) => listener(code as number | null)
    ipcRenderer.on('pear:worker:exit:' + specifier, wrap)
    return () => ipcRenderer.removeListener('pear:worker:exit:' + specifier, wrap)
  },
  onWorkerStdout: (specifier: string, listener: (data: Uint8Array) => void): (() => void) => {
    const wrap = (_evt: unknown, data: unknown) => listener(toBuffer(data) as Uint8Array)
    ipcRenderer.on('pear:worker:stdout:' + specifier, wrap)
    return () => ipcRenderer.removeListener('pear:worker:stdout:' + specifier, wrap)
  },
  onWorkerStderr: (specifier: string, listener: (data: Uint8Array) => void): (() => void) => {
    const wrap = (_evt: unknown, data: unknown) => listener(toBuffer(data) as Uint8Array)
    ipcRenderer.on('pear:worker:stderr:' + specifier, wrap)
    return () => ipcRenderer.removeListener('pear:worker:stderr:' + specifier, wrap)
  },
  aiChat: {
    send: (args: { messages: unknown[] }): Promise<{ success: boolean; requestId?: string; error?: string }> =>
      ipcRenderer.invoke('chat:send', args),
    cancel: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('chat:cancel'),
    status: (): Promise<{ isStreaming: boolean; requestId: string | null; startedAt: number | null }> =>
      ipcRenderer.invoke('chat:status'),
    onToken: (cb: (e: { requestId: string; text: string }) => void) => {
      const handler = (_evt: unknown, p: unknown) => cb(p as { requestId: string; text: string })
      ipcRenderer.on('ai:chat:token', handler)
      return () => ipcRenderer.removeListener('ai:chat:token', handler)
    },
    onThinking: (cb: (e: { requestId: string; text: string }) => void) => {
      const handler = (_evt: unknown, p: unknown) => cb(p as { requestId: string; text: string })
      ipcRenderer.on('ai:chat:thinking', handler)
      return () => ipcRenderer.removeListener('ai:chat:thinking', handler)
    },
    onStats: (cb: (e: { requestId: string; stats: unknown }) => void) => {
      const handler = (_evt: unknown, p: unknown) => cb(p as { requestId: string; stats: unknown })
      ipcRenderer.on('ai:chat:stats', handler)
      return () => ipcRenderer.removeListener('ai:chat:stats', handler)
    },
    onDone: (cb: (e: { requestId: string; stopReason: string }) => void) => {
      const handler = (_evt: unknown, p: unknown) => cb(p as { requestId: string; stopReason: string })
      ipcRenderer.on('ai:chat:done', handler)
      return () => ipcRenderer.removeListener('ai:chat:done', handler)
    },
    onError: (cb: (e: { requestId: string; error: { code: string; message: string; retryable: boolean } }) => void) => {
      const handler = (_evt: unknown, p: unknown) => cb(p as { requestId: string; error: { code: string; message: string; retryable: boolean } })
      ipcRenderer.on('ai:chat:error', handler)
      return () => ipcRenderer.removeListener('ai:chat:error', handler)
    },
    onStatus: (cb: (e: { isStreaming: boolean; requestId: string | null; startedAt: number | null }) => void) => {
      const handler = (_evt: unknown, p: unknown) => cb(p as { isStreaming: boolean; requestId: string | null; startedAt: number | null })
      ipcRenderer.on('ai:chat:status', handler)
      return () => ipcRenderer.removeListener('ai:chat:status', handler)
    },
  },
  sessions: {
    list: (): Promise<Array<{ slug: string; createdAt: number; lastActive: number; messageCount: number; pinned: boolean }>> =>
      ipcRenderer.invoke('sessions:list'),
    create: (): Promise<{ slug: string }> =>
      ipcRenderer.invoke('sessions:create'),
    delete: (slug: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('sessions:delete', slug),
    clear: (slug: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('sessions:clear', slug),
    load: (slug: string): Promise<{ success: boolean; messages: unknown[]; error?: string }> =>
      ipcRenderer.invoke('sessions:load', slug),
    save: (slug: string, messages: unknown[]): Promise<{ success: boolean; count?: number; error?: string }> =>
      ipcRenderer.invoke('sessions:save', slug, messages),
  },
  // P2P relay — route a chat completion to a peer's model
  chat: {
    route: (args: { requestId: string; targetWriterKey: string; messages: unknown[]; modelId: string }) =>
      ipcRenderer.invoke('chat:route', args),
    routeCancel: (requestId: string) =>
      ipcRenderer.invoke('chat:routeCancel', { requestId }),
  },
  // Relay events from a peer's completion
  onRelayEvent: (cb: (e: { requestId: string; kind: string; text?: string | null; error?: unknown }) => void) => {
    const handler = (_evt: unknown, e: unknown) => cb(e as { requestId: string; kind: string; text?: string | null; error?: unknown })
    ipcRenderer.on('ai:chat:relay-event', handler)
    return () => ipcRenderer.removeListener('ai:chat:relay-event', handler)
  },
  // Peer AI states (updated whenever a peer loads/unloads a model)
  onPeerAiStates: (cb: (states: unknown[]) => void) => {
    const handler = (_evt: unknown, states: unknown) => cb(states as unknown[])
    ipcRenderer.on('ai:peerStates', handler)
    return () => ipcRenderer.removeListener('ai:peerStates', handler)
  },
  // Override aiSourcePeers with real IPC call
  aiSourcePeers: (): Promise<Array<{
    writerKey: string
    modelId: string | null
    modelName: string | null
    loadedAt: number | null
    accepting: boolean
  }>> => ipcRenderer.invoke('aiSourcePeers:list'),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('bridge', bridge)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.bridge = bridge
}
