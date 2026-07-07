import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Square, Trash2, FileText, ChevronDown, Settings as SettingsIcon, Sparkles } from 'lucide-react'
import { useAI } from '../../hooks/useAI'
import { useAIChat } from '../../hooks/useAIChat'
import Drawer from '../Drawer'

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const RELAY_ERROR_CODES = new Set(['MODEL_MISMATCH', 'RELAY_ERROR', 'ROUTE_FAILED', 'NO_SOURCE'])
function isRelayErrorCode(code: string | undefined | null): boolean {
  return code ? RELAY_ERROR_CODES.has(code) : false
}

interface AIChatDrawerProps {
  open: boolean
  onClose: () => void
}

export function AIChatDrawer({ open, onClose }: AIChatDrawerProps) {
  const ai = useAI()
  const chat = useAIChat()
  const [draft, setDraft] = useState('')
  const [showSessionMenu, setShowSessionMenu] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const messages = chat.messages
  const isStreaming = chat.isStreaming
  const streamingContent = chat.streamingContent
  const streamingThinking = chat.streamingThinking
  const aiSource = chat.aiSource
  const modelName = chat.aiSource?.modelName ?? null

  const currentSession = useMemo(
    () => chat.sessions.find((s) => s.slug === chat.currentSessionSlug) ?? null,
    [chat.sessions, chat.currentSessionSlug]
  )
  const sessionLabel = currentSession?.slug === 'main' ? 'Main' : currentSession?.slug ?? '…'

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streamingContent])

  useEffect(() => {
    if (!confirmingClear) return
    const t = setTimeout(() => setConfirmingClear(false), 4000)
    return () => clearTimeout(t)
  }, [confirmingClear])

  const handleSend = () => {
    const text = draft.trim()
    if (!text || isStreaming) return
    chat.send(text)
    setDraft('')
  }

  function handleClear() {
    if (confirmingClear) {
      setConfirmingClear(false)
      void chat.clearSession(chat.currentSessionSlug)
      return
    }
    setConfirmingClear(true)
  }

  async function handleDeleteSession(slug: string) {
    if (slug === 'main') return
    await chat.deleteSession(slug)
  }

  async function handleNewSession() {
    await chat.createSession()
    setShowSessionMenu(false)
  }

  async function handleSwitchSession(slug: string) {
    setShowSessionMenu(false)
    await chat.setCurrentSession(slug)
  }

  return (
    <Drawer open={open} onClose={onClose} title="AI Assistant" subtitle={modelName ? `Using ${modelName}` : 'No model selected'} width="520px">
      <div className="flex flex-col h-full">
        {/* Session selector + Clear */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSessionMenu((v) => !v)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition"
              >
                <FileText size={12} className="text-gray-400" />
                <span className="max-w-[80px] truncate">{sessionLabel}</span>
                {currentSession && currentSession.messageCount > 0 && (
                  <span className="px-1 py-0.5 text-[9px] bg-gray-200 rounded">{currentSession.messageCount}</span>
                )}
                <ChevronDown size={10} className="text-gray-400" />
              </button>
              {showSessionMenu && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  {chat.sessions.map((s) => (
                    <div key={s.slug} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                      <button onClick={() => handleSwitchSession(s.slug)} className="flex-1 text-left text-xs text-gray-700">
                        {s.slug === 'main' ? 'Main' : s.slug}
                      </button>
                      {s.slug !== 'main' && (
                        <button onClick={() => handleDeleteSession(s.slug)} className="text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
                      )}
                    </div>
                  ))}
                  <div className="border-t border-gray-100">
                    <button onClick={handleNewSession} className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-gray-50">+ New Session</button>
                  </div>
                </div>
              )}
            </div>
            {messages.length > 0 && (
              confirmingClear ? (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-red-500">Clear?</span>
                  <button onClick={() => setConfirmingClear(false)} className="px-1.5 py-0.5 text-gray-600 border border-gray-200 rounded hover:bg-gray-50">No</button>
                  <button onClick={handleClear} className="px-1.5 py-0.5 text-red-600 border border-red-200 rounded hover:bg-red-50">Yes</button>
                </div>
              ) : (
                <button onClick={() => setConfirmingClear(true)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500"><Trash2 size={10} />Clear</button>
              )
            )}
          </div>
        </div>

        {/* No source warning */}
        {!aiSource && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
            <Sparkles size={12} className="text-amber-600" />
            <span>Pick an AI source in Settings to start.</span>
          </div>
        )}

        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-y-auto -mx-6 px-6 py-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                <span className="text-blue-500 text-lg">🤖</span>
              </div>
              <p className="text-sm text-gray-500 m-0">Ask anything</p>
              <p className="text-xs text-gray-400 m-0 mt-1">{aiSource ? `Powered by ${modelName}` : 'Configure AI source in Settings'}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {messages.map((m, i) => {
                const isUser = m.role === 'user'
                return (
                  <li key={i} className={`flex gap-3 rounded-md px-2 py-1 ${isUser ? 'bg-blue-50' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${isUser ? 'bg-gray-700' : 'bg-blue-600'}`}>
                      {isUser ? 'You' : initialsOf(modelName ?? 'AI')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className={`text-sm font-semibold ${isUser ? 'text-gray-900' : 'text-blue-600'}`}>{isUser ? 'You' : modelName ?? 'AI'}</span>
                      {m.thinking && (
                        <details className="mt-1">
                          <summary className="text-[10px] text-gray-400 cursor-pointer">Thinking</summary>
                          <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{m.thinking}</p>
                        </details>
                      )}
                      {isUser ? (
                        <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words m-0">{m.content}</p>
                      ) : (
                        <div className="prose prose-xs mt-0.5 max-w-none text-sm text-gray-900">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content.trimStart()}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
              {isStreaming && (
                <li className="flex gap-3 rounded-md px-2 py-1">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600 flex-shrink-0">{initialsOf(modelName ?? 'AI')}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-blue-600">{modelName ?? 'AI'}</span>
                      <span className="flex items-center gap-1 text-[10px] text-teal-600 font-bold">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />streaming
                      </span>
                      <button onClick={() => void chat.cancel()} className="ml-auto px-2 py-0.5 text-[10px] font-bold text-red-600 border border-red-200 rounded hover:bg-red-50"><Square size={10} /> Stop</button>
                    </div>
                    {streamingContent && (
                      <div className="prose prose-xs mt-0.5 max-w-none text-sm text-gray-900">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </li>
              )}
            </ul>
          )}

          {chat.error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
              <div className="font-bold text-red-600 mb-1">{chat.error.code}</div>
              <div>{chat.error.message}</div>
              <div className="flex gap-2 mt-2">
                {isRelayErrorCode(chat.error.code) && (
                  <button onClick={() => void chat.cancel().then(() => chat.retry())} className="px-2 py-0.5 text-[10px] font-bold text-red-600 border border-red-200 rounded hover:bg-red-100">Switch source</button>
                )}
                {chat.error.retryable && (
                  <button onClick={() => void chat.retry()} className="px-2 py-0.5 text-[10px] font-bold text-red-600 border border-red-200 rounded hover:bg-red-100">Retry</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 pt-3 -mx-6 px-6 -mb-5 pb-5">
          <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={aiSource ? `Ask ${modelName}…` : 'Pick a source first'}
              rows={1}
              disabled={!aiSource || isStreaming}
              className="flex-1 resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
            {isStreaming ? (
              <button type="button" onClick={() => void chat.cancel()} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-500 rounded-md hover:bg-red-600"><Square size={12} />Stop</button>
            ) : (
              <button type="submit" disabled={!aiSource || !draft.trim()} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"><Send size={12} />Ask</button>
            )}
          </form>
        </div>
      </div>
    </Drawer>
  )
}

export default AIChatDrawer
