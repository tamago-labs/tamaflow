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
  aiSourcePeers: () => Promise.resolve([]),
  aiChat: {
    send: () => Promise.resolve({ success: false, error: 'bridge not available' }),
    cancel: () => Promise.resolve({ success: false }),
    status: () => Promise.resolve({ isStreaming: false, requestId: null, startedAt: null }),
    onToken: () => () => {},
    onThinking: () => () => {},
    onStats: () => () => {},
    onDone: () => () => {},
    onError: () => () => {},
    onStatus: () => () => {},
  },
  sessions: {
    list: () => Promise.resolve([]),
    create: () => Promise.resolve({ slug: 'main' }),
    delete: () => Promise.resolve({ success: false }),
    clear: () => Promise.resolve({ success: false }),
    load: () => Promise.resolve({ success: true, messages: [] }),
    save: () => Promise.resolve({ success: false }),
  },
  chat: {
    route: () => Promise.resolve({ success: false, error: 'bridge not available' }),
    routeCancel: () => Promise.resolve({ success: false }),
  },
  onRelayEvent: () => () => {},
  onPeerAiStates: () => () => {},
}

export const bridge: BridgeAPI =
  typeof window !== 'undefined' && window.bridge ? window.bridge : noopBridge

if (typeof window !== 'undefined' && !window.bridge) {
  console.warn('[tamaflow] bridge: window.bridge missing, using no-op stub')
}
