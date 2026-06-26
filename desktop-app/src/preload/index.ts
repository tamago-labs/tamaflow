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
    onChange: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('wallet:onChange', handler)
      return () => ipcRenderer.removeListener('wallet:onChange', handler)
    },
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
