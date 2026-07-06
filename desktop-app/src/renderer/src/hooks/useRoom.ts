// Minimal useRoom hook for Phase 1 — subscribes to the room worker IPC
// and exposes a reactive view of its current state. Full chat + relay
// comes in Phase 3.

import { useCallback, useEffect, useState } from 'react'
import { bridge, ROOM_WORKER } from '../lib/bridge'

export type RoomStatus = 'starting' | 'ready' | 'error'
export type RoomRole = 'host' | 'guest'

export interface Me {
  key: string
  name: string
}

export interface RoomState {
  status: RoomStatus
  role: RoomRole | null
  writable: boolean
  invite: string | null
  peers: number
  me: Me | null
  error: string | null
}

const initialState: RoomState = {
  status: 'starting',
  role: null,
  writable: false,
  invite: null,
  peers: 0,
  me: null,
  error: null,
}

let startPromise: Promise<boolean> | null = null
let unsubscribe: (() => void) | null = null

export function useRoom(): RoomState & {
  joinInvite: (invite: string) => void
} {
  const [state, setState] = useState<RoomState>(initialState)

  useEffect(() => {
    let cancelled = false

    if (!startPromise) {
      startPromise = bridge.startWorker(ROOM_WORKER).catch((err) => {
        console.error('[tamaflow] failed to start room worker:', err)
        startPromise = null
        throw err
      })
    }

    startPromise.then(() => {
      if (cancelled) return
      if (!unsubscribe) {
        unsubscribe = bridge.onWorkerIPC(ROOM_WORKER, (data) => {
          const text =
            typeof data === 'string'
              ? data
              : typeof TextDecoder !== 'undefined'
                ? new TextDecoder().decode(data)
                : Buffer.from(data).toString('utf-8')
          try {
            const event = JSON.parse(text)
            if (!cancelled) {
              console.log('[tamaflow] room event:', event.type, JSON.stringify(event).slice(0, 160))
              setState((prev) => {
                const next = { ...prev }
                switch (event.type) {
                  case 'status':
                    next.status =
                      event.phase === 'starting' ? 'starting' : event.phase === 'ready' ? 'ready' : 'error'
                    next.error = event.error ?? null
                    break
                  case 'role':
                    next.role = event.role
                    next.writable = Boolean(event.writable)
                    break
                  case 'invite':
                    next.invite = event.invite
                    break
                  case 'peers':
                    next.peers = event.count
                    break
                  case 'me':
                    next.me = { key: event.key, name: event.name }
                    break
                }
                return next
              })
            }
          } catch (err) {
            console.error('[tamaflow] failed to parse room frame:', err, text)
          }
        })
      }
    }).catch(() => {})

    return () => { cancelled = true }
  }, [])

  const joinInvite = useCallback((invite: string) => {
    bridge.joinWithInvite(invite).catch((err) => {
      console.error('[tamaflow] joinInvite failed:', err)
    })
  }, [])

  return { ...state, joinInvite }
}
