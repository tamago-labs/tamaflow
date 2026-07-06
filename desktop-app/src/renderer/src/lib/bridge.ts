// Electron bridge wrapper. In production the renderer is hosted inside
// Electron and `window.bridge` is set by `electron/preload.ts`. When the
// renderer is loaded standalone (vite dev server), `window.bridge` is
// undefined; we fall back to a no-op stub so the UI still mounts.

import type { BridgeAPI } from '../../../preload/index.d'

// Worker specifiers. Must match the paths in src/main/index.ts.
export const MAIN_WORKER = '/workers/main.js'
export const ROOM_WORKER = '/workers/tamaflow-room-entry.js'

const noopBridge: BridgeAPI = {
  startWorker: () => Promise.resolve(false),
  joinWithInvite: () => Promise.resolve({ success: false }),
  writeWorkerIPC: () => Promise.resolve(),
  onWorkerIPC: () => () => {},
  onWorkerExit: () => () => {},
  onWorkerStdout: () => () => {},
  onWorkerStderr: () => () => {},
}

export const bridge: BridgeAPI =
  typeof window !== 'undefined' && window.bridge ? window.bridge : noopBridge

if (typeof window !== 'undefined' && !window.bridge) {
  console.warn('[tamaflow] bridge: window.bridge missing, using no-op stub')
}
