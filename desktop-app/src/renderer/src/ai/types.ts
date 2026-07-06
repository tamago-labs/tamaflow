// Shared types for AI chat. Adapted from v2/ai/types.ts — only the
// types needed by useAIChat and the ChatPage AI panel.

export interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  thinking?: string
  modelId?: string
  modelName?: string
}

export interface SessionMeta {
  slug: string
  createdAt: number
  lastActive: number
  messageCount: number
  pinned: boolean
}

export interface ChatTokenEvent {
  requestId: string
  text: string
}

export interface ChatThinkingEvent {
  requestId: string
  text: string
}

export interface ChatStatsEvent {
  requestId: string
  stats: Record<string, unknown>
}

export interface ChatDoneEvent {
  requestId: string
  stopReason: string
}

export interface ChatErrorEvent {
  requestId: string
  error: {
    code: string
    message: string
    retryable: boolean
  }
}

export interface ChatStatusEvent {
  isStreaming: boolean
  requestId: string | null
  startedAt: number | null
}

export interface AiSource {
  kind: 'local'
  modelId: string
  modelName: string
}
