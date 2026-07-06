// Module-scope singleton store for AI chat. Ported from v2/hooks/useAIChat.ts.
// Manages streaming sessions, auto-save, local model + P2P relay.

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { bridge } from '../lib/bridge'
import type {
  ChatTurn,
  SessionMeta,
  ChatDoneEvent,
  ChatErrorEvent,
  ChatThinkingEvent,
  ChatTokenEvent,
  ChatStatusEvent,
  AiSource
} from '../ai/types'

interface AIChatState {
  sessions: SessionMeta[]
  currentSessionSlug: string
  messages: ChatTurn[]
  streamingContent: string
  streamingThinking: string
  isStreaming: boolean
  streamingRequestId: string | null
  streamingModelName: string | null
  error: { code: string; message: string; retryable: boolean } | null
  lastUserText: string | null
  aiSource: AiSource | null
}

let snapshot: AIChatState = {
  sessions: [],
  currentSessionSlug: 'main',
  messages: [],
  streamingContent: '',
  streamingThinking: '',
  isStreaming: false,
  streamingRequestId: null,
  streamingModelName: null,
  error: null,
  lastUserText: null,
  aiSource: null
}

const listeners = new Set<() => void>()
function emit() { for (const l of listeners) l() }
function set(p: Partial<AIChatState>) { snapshot = { ...snapshot, ...p }; emit() }
function subscribe(cb: () => void): () => void { listeners.add(cb); return () => { listeners.delete(cb) } }

let bootstrapped = false
let saveDebounceHandle: ReturnType<typeof setTimeout> | null = null

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

async function refreshSessions() {
  try { set({ sessions: await bridge.sessions.list() }) } catch {}
}

async function loadSession(slug: string) {
  try {
    const r = await bridge.sessions.load(slug)
    set({ messages: r.success ? (r.messages as ChatTurn[]) : [], currentSessionSlug: slug })
  } catch { set({ messages: [], currentSessionSlug: slug }) }
}

function flushSaveNow() {
  if (saveDebounceHandle) { clearTimeout(saveDebounceHandle); saveDebounceHandle = null }
  const { currentSessionSlug, messages } = snapshot
  if (!currentSessionSlug) return
  void bridge.sessions.save(currentSessionSlug, messages).catch(() => {})
}

function scheduleSave() {
  if (saveDebounceHandle) clearTimeout(saveDebounceHandle)
  saveDebounceHandle = setTimeout(() => { saveDebounceHandle = null; flushSaveNow() }, 500)
}

async function bootstrapOnce() {
  if (bootstrapped) return
  bootstrapped = true

  bridge.aiChat.onStatus((e: ChatStatusEvent) => { set({ isStreaming: e.isStreaming }) })

  bridge.aiChat.onToken((e: ChatTokenEvent) => {
    if (snapshot.streamingRequestId !== null && e.requestId !== snapshot.streamingRequestId) return
    if (snapshot.streamingRequestId === null) set({ streamingRequestId: e.requestId })
    set({ streamingContent: snapshot.streamingContent + e.text })
  })

  bridge.aiChat.onThinking((e: ChatThinkingEvent) => {
    if (snapshot.streamingRequestId !== null && e.requestId !== snapshot.streamingRequestId) return
    if (snapshot.streamingRequestId === null) set({ streamingRequestId: e.requestId })
    set({ streamingThinking: snapshot.streamingThinking + e.text })
  })

  bridge.aiChat.onStats(() => {})

  bridge.aiChat.onDone((e: ChatDoneEvent) => {
    if (snapshot.streamingRequestId !== null && e.requestId !== snapshot.streamingRequestId) return
    const finished: ChatTurn = {
      id: newId(), role: 'assistant', content: snapshot.streamingContent,
      timestamp: new Date().toISOString(),
      ...(snapshot.streamingThinking ? { thinking: snapshot.streamingThinking } : {}),
      ...(snapshot.streamingModelName ? { modelName: snapshot.streamingModelName } : {})
    }
    set({
      messages: [...snapshot.messages, finished], streamingContent: '', streamingThinking: '',
      isStreaming: false, streamingRequestId: null, streamingModelName: null,
      error: e.stopReason === 'error' ? snapshot.error : null
    })
    flushSaveNow(); void refreshSessions()
  })

  bridge.aiChat.onError((e: ChatErrorEvent) => {
    if (snapshot.streamingRequestId !== null && e.requestId !== snapshot.streamingRequestId) return
    set({ error: e.error, isStreaming: false, streamingRequestId: null })
    if (snapshot.streamingContent) {
      const finished: ChatTurn = {
        id: newId(), role: 'assistant', content: snapshot.streamingContent,
        timestamp: new Date().toISOString(),
        ...(snapshot.streamingThinking ? { thinking: snapshot.streamingThinking } : {}),
        ...(snapshot.streamingModelName ? { modelName: snapshot.streamingModelName } : {})
      }
      set({ messages: [...snapshot.messages, finished], streamingContent: '', streamingThinking: '', streamingModelName: null })
      flushSaveNow(); void refreshSessions()
    }
  })

  // Phase 8: relay events from a peer's completion
  bridge.onRelayEvent((e) => {
    if (!e) return
    if (e.kind === 'token' && typeof e.text === 'string') {
      set({ streamingContent: snapshot.streamingContent + e.text })
    } else if (e.kind === 'thinking' && typeof e.text === 'string') {
      set({ streamingThinking: snapshot.streamingThinking + e.text })
    } else if (e.kind === 'error') {
      set({
        error: (e.error as { code: string; message: string; retryable: boolean }) || { code: 'RELAY_ERROR', message: 'Remote error', retryable: true },
        isStreaming: false, streamingRequestId: null
      })
    } else if (e.kind === 'done' || e.kind === 'busy') {
      if (snapshot.streamingContent || snapshot.streamingThinking) {
        const finished: ChatTurn = {
          id: newId(), role: 'assistant', content: snapshot.streamingContent,
          timestamp: new Date().toISOString(),
          ...(snapshot.streamingThinking ? { thinking: snapshot.streamingThinking } : {}),
          ...(snapshot.streamingModelName ? { modelName: snapshot.streamingModelName } : {})
        }
        set({
          messages: [...snapshot.messages, finished], streamingContent: '', streamingThinking: '',
          streamingModelName: null, isStreaming: false, streamingRequestId: null
        })
        flushSaveNow()
      } else {
        set({ isStreaming: false, streamingRequestId: null })
      }
    }
  })

  // Phase 7: peer AI states — validate peer source still exists
  bridge.onPeerAiStates((states: unknown[]) => {
    const current = snapshot.aiSource
    if (current && 'writerKey' in current) {
      const writerKey = (current as { writerKey: string }).writerKey
      const still = Array.isArray(states)
        ? states.find((s: unknown) => (s as { writerKey: string }).writerKey === writerKey)
        : null
      if (!still) set({ aiSource: null })
    }
  })

  await refreshSessions()
  await loadSession('main')
}

export interface AIChatApi {
  sessions: SessionMeta[]
  currentSessionSlug: string
  setCurrentSession(slug: string): Promise<void>
  createSession(): Promise<string>
  deleteSession(slug: string): Promise<boolean>
  clearSession(slug: string): Promise<boolean>
  messages: ChatTurn[]
  streamingContent: string
  streamingThinking: string
  streamingModelName: string | null
  isStreaming: boolean
  error: { code: string; message: string; retryable: boolean } | null
  aiSource: AiSource | null
  send(text: string): Promise<void>
  cancel(): Promise<void>
  retry(): Promise<void>
  setAiSource(source: AiSource | null): void
  refresh(): Promise<void>
}

export function useAIChat(): AIChatApi {
  const state = useSyncExternalStore(subscribe, () => snapshot)
  void bootstrapOnce()

  const messagesRef = useRef(state.messages)
  useEffect(() => {
    if (state.messages === messagesRef.current) return
    messagesRef.current = state.messages
    scheduleSave()
  }, [state.messages])

  return {
    sessions: state.sessions,
    currentSessionSlug: state.currentSessionSlug,
    setCurrentSession: async (slug) => { await loadSession(slug) },
    createSession: async () => {
      const r = await bridge.sessions.create()
      await refreshSessions(); await loadSession(r.slug); return r.slug
    },
    deleteSession: async (slug) => {
      if (slug === 'main') return false
      const r = await bridge.sessions.delete(slug)
      if (r.success) { if (snapshot.currentSessionSlug === slug) await loadSession('main'); await refreshSessions(); return true }
      return false
    },
    clearSession: async (slug) => {
      const r = await bridge.sessions.clear(slug)
      if (r.success && snapshot.currentSessionSlug === slug) set({ messages: [] })
      await refreshSessions(); return r.success
    },
    messages: state.messages,
    streamingContent: state.streamingContent,
    streamingThinking: state.streamingThinking,
    streamingModelName: state.streamingModelName,
    isStreaming: state.isStreaming,
    error: state.error,
    aiSource: state.aiSource,
    send: async (text) => {
      const trimmed = text.trim()
      if (!trimmed || state.isStreaming) return
      const source = snapshot.aiSource
      if (!source) {
        set({ error: { code: 'NO_SOURCE', message: 'Load a model in Settings → AI Model first.', retryable: false } })
        return
      }
      const userTurn: ChatTurn = { id: newId(), role: 'user', content: trimmed, timestamp: new Date().toISOString() }
      const history = [...state.messages, userTurn]
      set({ messages: history, streamingContent: '', streamingThinking: '', streamingModelName: source.modelName, lastUserText: trimmed, error: null })
      flushSaveNow()

      if ('writerKey' in source) {
        // Phase 8: relay to a peer
        const peerSource = source as { writerKey: string; modelId: string; modelName: string }
        const requestId = `relay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        set({ streamingRequestId: requestId, isStreaming: true })
        const r = await bridge.chat.route({ requestId, targetWriterKey: peerSource.writerKey, messages: history, modelId: peerSource.modelId })
        if (!r.success) {
          set({
            error: { code: 'ROUTE_FAILED', message: r.error || 'Failed to route', retryable: true },
            isStreaming: false, streamingRequestId: null
          })
        }
        return
      }

      // Local send
      const r = await bridge.aiChat.send({ messages: history })
      if (!r.success) {
        set({
          error: { code: 'SEND_FAILED', message: r.error || 'Failed to send', retryable: true },
          streamingContent: '', streamingThinking: '', streamingModelName: null, isStreaming: false, streamingRequestId: null
        })
        return
      }
      set({ streamingRequestId: r.requestId ?? null })
    },
    cancel: async () => { await bridge.aiChat.cancel() },
    retry: async () => { const last = snapshot.lastUserText; if (last) await snapshot_send(last) },
    setAiSource: (source) => { set({ aiSource: source }) },
    refresh: async () => { await refreshSessions() }
  }
}

async function snapshot_send(text: string) {
  const trimmed = text.trim()
  if (!trimmed || snapshot.isStreaming) return
  const userTurn: ChatTurn = { id: newId(), role: 'user', content: trimmed, timestamp: new Date().toISOString() }
  const history = [...snapshot.messages, userTurn]
  set({ messages: history, streamingContent: '', streamingThinking: '', streamingModelName: snapshot.aiSource?.modelName ?? null, lastUserText: trimmed, error: null })
  flushSaveNow()
  const r = await bridge.aiChat.send({ messages: history })
  if (!r.success) {
    set({ error: { code: 'SEND_FAILED', message: r.error || 'Failed to send', retryable: true }, isStreaming: false, streamingRequestId: null })
    return
  }
  set({ streamingRequestId: r.requestId ?? null })
}
