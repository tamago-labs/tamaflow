// useRoom — subscribes to the Tamaflow room worker IPC and exposes a
// reactive view of its current state plus idempotent mutators.
//
// Singleton design: every `useRoom()` call shares one module-level
// `roomStore`. Without the singleton, mounting this hook twice
// yields two independent React states that never converge.

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { bridge, ROOM_WORKER } from '../lib/bridge'
import { onRoomEvent, writeRoom, type RoomEvent } from '../lib/room'
import type { ChatMessage } from '../lib/chat'

export type RoomStatus = 'starting' | 'ready' | 'error'
export type RoomRole = 'host' | 'guest'
export type Me = { key: string; name: string }

export interface PeerAiState {
  writerKey: string
  modelId: string | null
  modelName: string | null
  loadedAt: number | null
  accepting: boolean
}

export interface RoomState {
  status: RoomStatus
  role: RoomRole | null
  writable: boolean
  invite: string | null
  peers: number
  me: Me | null
  chat: ChatMessage[]
  peerAiStates: PeerAiState[]
  error: string | null
}

const initialState: RoomState = {
  status: 'starting',
  role: null,
  writable: false,
  invite: null,
  peers: 0,
  me: null,
  chat: [],
  peerAiStates: [],
  error: null
}

// Module-level singleton.
const store: RoomState & { version: number } = { ...initialState, version: 0 }
const listeners = new Set<() => void>()

let startPromise: Promise<boolean> | null = null
let unsubscribe: (() => void) | null = null

function bumpAndEmit() {
  store.version++
  for (const l of listeners) l()
}

function apply(event: RoomEvent) {
  switch (event.type) {
    case 'status':
      store.status =
        event.phase === 'starting' ? 'starting' : event.phase === 'ready' ? 'ready' : 'error'
      store.error = event.error ?? null
      break
    case 'role':
      store.role = event.role
      store.writable = Boolean(event.writable)
      break
    case 'invite':
      store.invite = event.invite
      break
    case 'peers':
      store.peers = event.count
      break
    case 'me':
      store.me = { key: event.key, name: event.name }
      break
    case 'chat':
      store.chat = event.messages
      break
    case 'ai-states':
      store.peerAiStates = Array.isArray(event.states) ? event.states : []
      break
  }
  bumpAndEmit()
}

function reset() {
  stopPeerAiPolling()
  Object.assign(store, initialState)
  bumpAndEmit()
}

function ensureStarted(): Promise<boolean> {
  if (startPromise) return startPromise
  startPromise = bridge
    .startWorker(ROOM_WORKER)
    .then(() => {
      if (!unsubscribe) {
        unsubscribe = onRoomEvent((event) => apply(event))
        bridge.onWorkerExit(ROOM_WORKER, () => reset())
      }
      startPeerAiPolling()
      return true
    })
    .catch((err: unknown) => {
      console.error('[tamaflow] failed to start room worker:', err)
      startPromise = null
      throw err
    })
  return startPromise
}

async function hydratePeerAiStates() {
  try {
    const states = await bridge.aiSourcePeers()
    if (Array.isArray(states)) {
      store.peerAiStates = states
      bumpAndEmit()
    }
  } catch (err) {
    console.error('[useRoom] aiSourcePeers pull failed:', err)
  }
}

const PEER_AI_POLL_MS = 5000
let pollHandle: ReturnType<typeof setInterval> | null = null

function startPeerAiPolling() {
  if (pollHandle) return
  pollHandle = setInterval(() => {
    void hydratePeerAiStates()
  }, PEER_AI_POLL_MS)
}

function stopPeerAiPolling() {
  if (pollHandle) {
    clearInterval(pollHandle)
    pollHandle = null
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
const getSnapshot = () => store.version

export function useRoom(): RoomState & {
  sendChat: (text: string) => void
  removeChats: (ids: string[]) => void
  clearChat: () => void
  joinInvite: (invite: string) => void
  createInvite: () => void
  renameSelf: (name: string) => void
} {
  useEffect(() => {
    let cancelled = false
    ensureStarted().then(() => {
      if (cancelled) return
      void hydratePeerAiStates()
    })
    return () => {
      cancelled = true
    }
  }, [])

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    writeRoom({ type: 'send-chat', text: trimmed }).catch((err) => {
      console.error('[tamaflow] sendChat failed:', err)
    })
  }, [])

  const removeChats = useCallback((ids: string[]) => {
    if (!store.writable) return
    writeRoom({ type: 'remove-chats', ids: ids.slice() }).catch((err) => {
      console.error('[tamaflow] removeChats failed:', err)
    })
  }, [])

  const clearChat = useCallback(() => {
    if (!store.writable) return
    writeRoom({ type: 'remove-chats', ids: [] }).catch((err) => {
      console.error('[tamaflow] clearChat failed:', err)
    })
  }, [])

  const joinInvite = useCallback((invite: string) => {
    bridge.joinWithInvite(invite).catch((err) => {
      console.error('[tamaflow] joinInvite failed:', err)
    })
  }, [])

  const createInvite = useCallback(() => {
    writeRoom({ type: 'create-invite' }).catch((err) => {
      console.error('[tamaflow] createInvite failed:', err)
    })
  }, [])

  const renameSelf = useCallback((name: string) => {
    writeRoom({ type: 'rename-self', name }).catch((err) => {
      console.error('[tamaflow] renameSelf failed:', err)
    })
  }, [])

  return {
    status: store.status,
    role: store.role,
    writable: store.writable,
    invite: store.invite,
    peers: store.peers,
    me: store.me,
    chat: store.chat,
    peerAiStates: store.peerAiStates,
    error: store.error,
    sendChat,
    removeChats,
    clearChat,
    joinInvite,
    createInvite,
    renameSelf
  }
}
