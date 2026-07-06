// `/chat` route — Team Chat + AI Chat page.
// Team chat on the left, AI chat panel toggled via "Ask AI" button.
// Ported from v2 ChatPage.tsx, adapted for v1's brand tokens.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  X
} from 'lucide-react'
import { useAI } from '../context/AIContext'
import { useAIChat } from '../hooks/useAIChat'
import { useRoom } from '../hooks/useRoom'
import { GroupChatPanel } from '../components/GroupChatPanel'

// ─── ChatPage entry ─────────────────────────────────────────────────

export default function ChatPage() {
  const room = useRoom()
  const [showAi, setShowAi] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopyInvite() {
    if (!room.invite) return
    try {
      await navigator.clipboard.writeText(room.invite)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const messages = useMemo(() => room.chat, [room.chat])

  return (
    <div className='flex h-full min-h-0 flex-1 flex-col'>
      {/* Top bar — invite code left, Ask AI right */}
      <div className='flex h-10 flex-shrink-0 items-center justify-between border-b border-brand-border bg-white px-4'>
        {room.invite ? (
          <button
            type='button'
            onClick={handleCopyInvite}
            className='inline-flex items-center gap-2 rounded-md px-2 py-1 font-mono text-xs text-brand-muted transition hover:bg-brand-light hover:text-brand-navy'
            title='Click to copy invite code'
          >
            <code className='text-brand-navy'>{room.invite.slice(0, 12)}…</code>
            {copied ? (
              <span className='text-brand-teal text-[10px]'>✓</span>
            ) : (
              <span className='text-[10px] opacity-50'>copy</span>
            )}
          </button>
        ) : (
          <span className='font-mono text-xs text-brand-muted'>
            {room.status === 'ready' ? 'Workspace' : 'Starting…'}
          </span>
        )}
        <button
          type='button'
          onClick={() => setShowAi((v) => !v)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-mono text-[11px] font-bold uppercase tracking-wider2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-teal/60 ${
            showAi
              ? 'bg-brand-blue text-white'
              : 'text-brand-muted hover:bg-brand-light hover:text-brand-navy'
          }`}
        >
          <Sparkles size={13} />
          Ask AI
        </button>
      </div>

      {/* Content area */}
      <div className='flex min-h-0 flex-1 overflow-hidden'>
        {/* Team chat — full width when AI is hidden, flex-1 when shown */}
        <div className='flex min-h-0 flex-1 flex-col p-4'>
          <GroupChatPanel
            invite={room.invite}
            peers={room.peers}
            messages={messages}
            role={room.role}
            writable={room.writable}
            me={room.me}
            onSendChat={room.sendChat}
            onRemoveChat={(id) => room.removeChats([id])}
            onClearChat={room.clearChat}
            onCopyInvite={handleCopyInvite}
          />
        </div>

        {/* AI chat panel — slides in from right */}
        <AnimatePresence>
          {showAi && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className='flex-shrink-0 overflow-hidden'
            >
              <AIChatPanel onClose={() => setShowAi(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── AI Chat Panel ──────────────────────────────────────────────────

function AIChatPanel({ onClose }: { onClose: () => void }) {
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
  const modelName = chat.aiSource?.modelName ?? null

  const currentSession = useMemo(
    () => chat.sessions.find((s) => s.slug === chat.currentSessionSlug) ?? null,
    [chat.sessions, chat.currentSessionSlug]
  )
  const sessionLabel =
    currentSession?.slug === 'main'
      ? 'Main'
      : currentSession?.slug ?? '…'

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, isStreaming, streamingContent, streamingThinking])

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
    <section className='flex h-full w-[400px] flex-shrink-0 flex-col border-l border-brand-border bg-white'>
      <header className='flex h-8 flex-shrink-0 items-center justify-between border-b border-brand-border bg-brand-light px-4'>
        <div className='flex items-center gap-2'>
          <span className='font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-muted'>
            AI
          </span>
          <span
            className={`font-mono text-[10px] ${
              isStreaming ? 'text-brand-teal' : modelName ? 'text-brand-navy' : 'text-brand-err'
            }`}
          >
            {isStreaming ? 'streaming…' : modelName ?? 'no source'}
          </span>
          <div className='relative'>
            <button
              type='button'
              onClick={() => setShowSessionMenu((v) => !v)}
              className='inline-flex items-center gap-1 rounded border border-brand-border bg-white px-1.5 py-0.5 text-[10px] font-medium text-brand-navy transition hover:bg-brand-light'
            >
              <FileText size={9} className='text-brand-muted' />
              <span className='max-w-[80px] truncate'>{sessionLabel}</span>
              {currentSession && currentSession.messageCount > 0 && (
                <span className='rounded bg-brand-light px-1 py-0.5 text-[8px] text-brand-muted'>
                  {currentSession.messageCount}
                </span>
              )}
              <ChevronDown size={8} className='text-brand-muted' />
            </button>
            {showSessionMenu && (
              <SessionMenu
                current={chat.currentSessionSlug}
                sessions={chat.sessions}
                onSelect={handleSwitchSession}
                onCreate={handleNewSession}
                onDelete={handleDeleteSession}
                onClose={() => setShowSessionMenu(false)}
              />
            )}
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {messages.length > 0 ? (
            confirmingClear ? (
              <div className='flex items-center gap-1'>
                <button
                  type='button'
                  onClick={() => setConfirmingClear(false)}
                  className='rounded border border-brand-border bg-white px-1 py-0.5 font-mono text-[9px] text-brand-navy hover:bg-brand-light'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={handleClear}
                  className='rounded border border-brand-err bg-white px-1 py-0.5 font-mono text-[9px] text-brand-err hover:bg-red-50'
                >
                  Confirm
                </button>
              </div>
            ) : (
              <button
                type='button'
                onClick={handleClear}
                className='inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-muted hover:text-brand-err'
              >
                <Trash2 size={10} />
                Clear
              </button>
            )
          ) : null}
          <button
            type='button'
            onClick={onClose}
            className='inline-flex h-6 w-6 items-center justify-center rounded text-brand-muted transition-colors hover:bg-brand-light hover:text-brand-navy'
          >
            <X size={13} />
          </button>
        </div>
      </header>

      {!chat.aiSource && (
        <div className='flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] text-amber-900'>
          <Sparkles size={11} className='flex-shrink-0 text-amber-700' />
          <span>
            Load a model in <span className='font-mono'>Settings → AI Model</span> to start.
          </span>
        </div>
      )}

      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <div ref={listRef} className='flex-1 overflow-y-auto px-4 py-3'>
          {messages.length === 0 ? (
            <AIEmptyState hasSource={!!chat.aiSource} hasModel={ai.isReady} />
          ) : (
            <ul className='flex flex-col gap-3'>
              {messages.map((m, i) => (
                <AIMessageRow key={i} message={m} modelName={modelName ?? 'AI'} />
              ))}
              {isStreaming && (
                <StreamingBubble
                  content={streamingContent}
                  thinking={streamingThinking}
                  modelName={modelName ?? 'AI'}
                  onCancel={() => void chat.cancel()}
                />
              )}
            </ul>
          )}
          {chat.error && (
            <div className='mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900'>
              <div className='flex items-start gap-2'>
                <span className='font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err'>
                  {chat.error.code}
                </span>
                <span className='flex-1'>{chat.error.message}</span>
              </div>
              {chat.error.retryable && (
                <div className='mt-2'>
                  <button
                    type='button'
                    onClick={() => void chat.cancel().then(() => chat.retry())}
                    className='inline-flex items-center gap-1 rounded-md border border-brand-err px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err hover:bg-red-50'
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className='flex-shrink-0 border-t border-brand-border bg-white p-3'>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className='flex items-end gap-2'
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={chat.aiSource ? `Ask ${modelName}…` : 'Pick a source first'}
            rows={1}
            disabled={!chat.aiSource || isStreaming}
            className='flex-1 resize-none rounded-md border border-brand-border bg-white px-3 py-2 font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:opacity-60'
          />
          {isStreaming ? (
            <button
              type='button'
              onClick={() => void chat.cancel()}
              className='inline-flex h-9 items-center gap-1.5 rounded-md border-0 bg-brand-err px-4 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90'
            >
              <Square size={12} />
              Stop
            </button>
          ) : (
            <button
              type='submit'
              disabled={!chat.aiSource || !draft.trim()}
              className='inline-flex h-9 items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50'
            >
              <Send size={12} />
              Ask
            </button>
          )}
        </form>
      </div>
    </section>
  )
}

// ─── AI message rendering ──────────────────────────────────────────

function AIMessageRow({
  message,
  modelName
}: {
  message: { role: 'user' | 'assistant'; content: string; thinking?: string }
  modelName: string
}) {
  const isUser = message.role === 'user'
  const hasThinking = !isUser && typeof message.thinking === 'string' && message.thinking.length > 0
  const [showThinking, setShowThinking] = useState(false)

  return (
    <li className={`flex gap-3 rounded-md px-2 py-1 ${isUser ? 'bg-brand-blue/5' : ''}`}>
      <div className='flex w-9 flex-shrink-0 flex-col items-center pt-0.5'>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
            isUser ? 'bg-brand-navy text-white' : 'bg-brand-blue text-white'
          }`}
        >
          {isUser ? 'You' : initialsOf(modelName)}
        </div>
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-baseline gap-2'>
          <span
            className={`font-sans text-[13px] font-semibold ${
              isUser ? 'text-brand-navy' : 'text-brand-blue'
            }`}
          >
            {isUser ? 'You' : modelName}
          </span>
        </div>
        {hasThinking && (
          <ThinkingCard thinking={message.thinking!} open={showThinking} onToggle={() => setShowThinking((v) => !v)} />
        )}
        {isUser ? (
          <p className='m-0 mt-0.5 whitespace-pre-wrap break-words font-sans text-sm text-brand-navy'>
            {message.content}
          </p>
        ) : (
          <div className='prose prose-xs mt-0.5 max-w-none text-sm text-brand-navy prose-headings:text-brand-navy prose-p:text-brand-navy prose-a:text-brand-blue prose-strong:text-brand-navy prose-code:text-brand-navy prose-li:text-brand-navy'>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content.trimStart()}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </li>
  )
}

function StreamingBubble({
  content,
  thinking,
  modelName,
  onCancel
}: {
  content: string
  thinking: string
  modelName: string
  onCancel: () => void
}) {
  const hasThinking = typeof thinking === 'string' && thinking.length > 0
  const [showThinking, setShowThinking] = useState(true)
  return (
    <li className='flex gap-3 rounded-md px-2 py-1'>
      <div className='flex w-9 flex-shrink-0 flex-col items-center pt-0.5'>
        <div className='flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue font-mono text-[11px] font-bold text-white'>
          {initialsOf(modelName)}
        </div>
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-1.5'>
          <span className='font-sans text-[13px] font-semibold text-brand-blue'>{modelName}</span>
          <span className='inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-teal'>
            <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-brand-teal' />
            streaming
          </span>
          {content && (
            <button
              type='button'
              onClick={onCancel}
              className='ml-auto inline-flex items-center gap-1 rounded-md border border-brand-err bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err hover:bg-red-50'
            >
              <Square size={10} />
              Stop
            </button>
          )}
        </div>
        {hasThinking && <ThinkingCard thinking={thinking} open={showThinking} onToggle={() => setShowThinking((v) => !v)} streaming />}
        {content ? (
          <div className='prose prose-xs mt-0.5 max-w-none text-sm text-brand-navy prose-headings:text-brand-navy prose-p:text-brand-navy prose-a:text-brand-blue prose-strong:text-brand-navy prose-code:text-brand-navy prose-li:text-brand-navy'>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content.trimStart()}
            </ReactMarkdown>
          </div>
        ) : (
          !thinking && <p className='m-0 mt-0.5 text-[10px] italic text-brand-muted'>Thinking…</p>
        )}
      </div>
    </li>
  )
}

function ThinkingCard({
  thinking,
  open,
  onToggle,
  streaming = false
}: {
  thinking: string
  open: boolean
  onToggle: () => void
  streaming?: boolean
}) {
  return (
    <div className='mt-0.5'>
      <button
        type='button'
        onClick={onToggle}
        className='inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-amber-800 transition hover:bg-amber-100'
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        Thinking
        {streaming && (
          <span className='ml-1 inline-flex items-center gap-1 text-amber-600'>
            <span className='h-1 w-1 animate-pulse rounded-full bg-amber-500' />
            live
          </span>
        )}
      </button>
      {open && (
        <div className='mt-1 whitespace-pre-wrap break-words rounded-md border border-amber-100 bg-amber-50/50 px-2 py-1.5 font-mono text-[11px] text-amber-900'>
          {thinking}
        </div>
      )}
    </div>
  )
}

// ─── Session menu ──────────────────────────────────────────────────

function SessionMenu({
  current,
  sessions,
  onSelect,
  onCreate,
  onDelete,
  onClose
}: {
  current: string
  sessions: { slug: string; pinned: boolean; messageCount: number }[]
  onSelect: (slug: string) => void
  onCreate: () => void
  onDelete: (slug: string) => void
  onClose: () => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (!t || !t.closest('[data-session-menu]')) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    }
  }, [])

  function handleDeleteClick(slug: string) {
    if (confirmingDelete === slug) {
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current)
        confirmTimerRef.current = null
      }
      setConfirmingDelete(null)
      void onDelete(slug)
      return
    }
    setConfirmingDelete(slug)
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = setTimeout(() => {
      confirmTimerRef.current = null
      setConfirmingDelete(null)
    }, 4000)
  }

  return (
    <div
      data-session-menu
      className='absolute left-0 top-full z-30 mt-1 max-h-64 w-80 overflow-y-auto rounded-md border border-brand-border bg-white shadow-[0_18px_50px_-12px_rgba(10,10,92,0.25)]'
    >
      {sessions.map((s) => {
        const isCurrent = s.slug === current
        const isConfirming = confirmingDelete === s.slug
        return (
          <div
            key={s.slug}
            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs ${
              isCurrent ? 'bg-brand-blue/10 text-brand-navy' : 'text-brand-navy hover:bg-brand-light'
            }`}
          >
            <button type='button' onClick={() => onSelect(s.slug)} className='min-w-0 flex-1 truncate text-left'>
              {s.pinned ? 'Main (default)' : s.slug}
            </button>
            {s.messageCount > 0 && (
              <span className='shrink-0 rounded bg-brand-light px-1.5 py-0.5 text-[10px] text-brand-muted'>
                {s.messageCount}
              </span>
            )}
            {!s.pinned && (
              <button
                type='button'
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteClick(s.slug)
                }}
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider2 transition ${
                  isConfirming
                    ? 'bg-brand-err text-white hover:opacity-90'
                    : 'text-brand-muted hover:bg-red-50 hover:text-brand-err'
                }`}
              >
                {isConfirming ? 'Confirm' : 'Delete'}
              </button>
            )}
          </div>
        )
      })}
      <button
        type='button'
        onClick={onCreate}
        className='flex w-full items-center gap-1.5 border-t border-brand-border px-2 py-1.5 text-left text-xs text-brand-navy hover:bg-brand-light'
      >
        <Plus size={11} />
        New session
      </button>
    </div>
  )
}

// ─── Empty states ──────────────────────────────────────────────────

function AIEmptyState({ hasSource, hasModel }: { hasSource: boolean; hasModel: boolean }) {
  let title: string
  let body: string
  if (!hasSource) {
    title = 'No model loaded'
    body = 'Load a model in Settings → AI Model first.'
  } else if (!hasModel) {
    title = 'Model loading…'
    body = 'Wait for the model to finish loading.'
  } else {
    title = 'Start a conversation'
    body = 'Your messages are streamed from the local model. Responses are markdown-aware.'
  }
  return (
    <div className='flex h-full flex-col items-center justify-center px-6 text-center'>
      <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-brand-border bg-brand-light'>
        <Sparkles size={20} className='text-brand-muted' />
      </div>
      <h3 className='m-0 font-sans text-base font-medium text-brand-navy'>{title}</h3>
      <p className='m-0 mt-1.5 max-w-sm text-xs leading-relaxed text-brand-muted'>{body}</p>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const markdownComponents = {
  a({ href, children, ...rest }: { href?: string; children?: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    return (
      <a href={href} target='_blank' rel='noreferrer' className='text-brand-blue underline hover:text-brand-navy' {...rest}>
        {children}
      </a>
    )
  },
  code({ className, children, ...rest }: { className?: string; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
    const isBlock = typeof className === 'string' && className.startsWith('language-')
    if (isBlock) {
      return (
        <pre className='my-1 overflow-x-auto rounded-md bg-brand-navy p-2 font-mono text-[11px] text-white'>
          <code className={className} {...rest}>{children}</code>
        </pre>
      )
    }
    return (
      <code className='rounded bg-brand-light px-1 py-0.5 font-mono text-[11px] text-brand-navy' {...rest}>
        {children}
      </code>
    )
  },
  pre({ children }: { children?: React.ReactNode }) {
    return <>{children}</>
  },
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className='mb-1 text-sm font-semibold text-brand-navy'>{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className='mb-1 text-sm font-semibold text-brand-navy'>{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className='mb-1 text-xs font-semibold text-brand-navy'>{children}</h3>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className='my-1 list-disc pl-4'>{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className='my-1 list-decimal pl-4'>{children}</ol>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className='my-1 border-l-2 border-brand-border pl-2 text-brand-muted'>{children}</blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => <table className='my-1 w-full border-collapse text-[11px]'>{children}</table>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className='border border-brand-border bg-brand-light px-1 py-0.5 text-left font-medium text-brand-navy'>{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className='border border-brand-border px-1 py-0.5 text-brand-navy'>{children}</td>
  )
}
