// AI chat chokepoint. Owns the @qvac/sdk `completion()` call and
// forwards streaming events to the renderer over IPC push channels.
// Ported from v2/electron/aiChat.js to TypeScript.

import { completion, cancel as sdkCancel } from '@qvac/sdk'
import { mapError, getActiveModelId, setStreamingNow } from './qvac'
import type { BrowserWindow } from 'electron'

let mainWindowRef: BrowserWindow | null = null
let currentRequestId: string | null = null
let startedAt: number | null = null

function send(channel: string, payload: unknown): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload)
  }
}

function setMainWindow(window: BrowserWindow | null): void {
  mainWindowRef = window
}

function getStatus() {
  return {
    isStreaming: currentRequestId !== null,
    requestId: currentRequestId,
    startedAt
  }
}

function setAccepting(_value: boolean): void {
  // No-op — `accepting` is derived in qvac.getLocalAiStateSnapshot()
}

async function sendMessage({ messages }: { messages: Array<{ role: string; content: string }> }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: 'messages must be a non-empty array' }
  }
  if (currentRequestId !== null) {
    return { success: false, error: 'BUSY' }
  }
  const modelId = getActiveModelId()
  if (!modelId) {
    return { success: false, error: 'No model loaded. Pick one in Settings → AI Model.' }
  }

  const history = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  if (history.length === 0) {
    return { success: false, error: 'No user/assistant messages to send' }
  }

  startedAt = Date.now()
  setStreamingNow(true)

  const run = completion({
    modelId,
    history,
    stream: true,
    kvCache: true,
    captureThinking: true
  })
  currentRequestId = run.requestId
  setAccepting(false)
  send('ai:chat:status', getStatus())

  driveStream(run).catch((err) => {
    console.error('[aiChat] driveStream unhandled error:', err)
  })

  return { success: true, requestId: run.requestId }
}

async function cancelMessage() {
  if (currentRequestId === null) {
    return { success: true, error: 'Nothing to cancel' }
  }
  const id = currentRequestId
  try {
    await sdkCancel({ requestId: id })
  } catch (err: unknown) {
    if (err && (err as { name?: string }).name === 'InferenceCancelledError') {
      // Expected
    } else {
      console.warn('[aiChat] cancel failed:', err)
    }
  }
  return { success: true, requestId: id }
}

async function driveStream(run: { requestId: string; events: AsyncIterable<unknown> }) {
  let settled = false
  function settle(kind: string, payload: Record<string, unknown>) {
    if (settled) return
    settled = true
    currentRequestId = null
    startedAt = null
    setStreamingNow(false)
    setAccepting(true)
    send('ai:chat:status', getStatus())
    send(kind, { requestId: run.requestId, ...payload })
  }

  try {
    for await (const event of run.events as AsyncIterable<{
      type: string
      text?: string
      stats?: unknown
      stopReason?: string
      error?: { message: string }
    }>) {
      if (event.type === 'contentDelta') {
        send('ai:chat:token', { requestId: run.requestId, text: event.text })
      } else if (event.type === 'thinkingDelta') {
        send('ai:chat:thinking', { requestId: run.requestId, text: event.text })
      } else if (event.type === 'completionStats') {
        send('ai:chat:stats', { requestId: run.requestId, stats: event.stats })
      } else if (event.type === 'completionDone') {
        if (event.stopReason === 'error' && event.error) {
          settle('ai:chat:error', {
            error: {
              code: 'COMPLETION_ERROR',
              message: event.error.message,
              retryable: true
            }
          })
        } else {
          settle('ai:chat:done', {
            stopReason: event.stopReason ?? 'eos'
          })
        }
      }
    }
    settle('ai:chat:done', { stopReason: 'eos' })
  } catch (err) {
    const mapped = mapError(err)
    settle('ai:chat:error', { error: mapped })
  }
}

export { setMainWindow, getStatus, sendMessage, cancelMessage }
