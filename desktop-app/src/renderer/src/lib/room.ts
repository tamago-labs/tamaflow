// Room worker IPC helpers. Wraps `bridge.writeWorkerIPC(ROOM_WORKER, …)`
// with JSON framing for the P2P room protocol.

import { bridge, ROOM_WORKER } from './bridge'

// Outbound frames the renderer can send to the room worker.
export type RoomFrame =
  | { type: 'join-invite'; invite: string }
  | { type: 'create-invite' }
  | { type: 'send-chat'; text: string }
  | { type: 'remove-chats'; ids: string[] }
  | { type: 'rename-self'; name: string }

// Inbound frames the worker pushes back. Discriminated by `type`.
export type RoomEvent =
  | { type: 'status'; phase: 'starting' | 'ready' | 'error'; error?: string }
  | { type: 'role'; role: 'host' | 'guest'; writable: boolean }
  | { type: 'invite'; invite: string }
  | { type: 'chat'; messages: BoardScopedChatMessage[] }
  | { type: 'peers'; count: number }
  | { type: 'me'; key: string; name: string }
  | {
      type: 'ai-states'
      states: Array<{
        writerKey: string
        modelId: string | null
        modelName: string | null
        loadedAt: number | null
        accepting: boolean
      }>
    }

export interface BoardScopedChatMessage {
  id: string
  text: string
  info: { name: string; key: string; at: number } | null
}

export function writeRoom(frame: RoomFrame): Promise<void> {
  return bridge.writeWorkerIPC(ROOM_WORKER, JSON.stringify(frame))
}

export function onRoomEvent(listener: (event: RoomEvent) => void): () => void {
  return bridge.onWorkerIPC(ROOM_WORKER, (data) => {
    const text =
      typeof data === 'string'
        ? data
        : typeof TextDecoder !== 'undefined'
          ? new TextDecoder().decode(data)
          : Buffer.from(data).toString('utf-8')
    try {
      const event = JSON.parse(text) as RoomEvent
      console.log('[tamaflow] room event:', event.type, JSON.stringify(event).slice(0, 160))
      listener(event)
    } catch (err) {
      console.error('[tamaflow] failed to parse room frame:', err, text)
    }
  })
}
