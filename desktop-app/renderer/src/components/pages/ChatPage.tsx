// Chat page — Slack/Discord-style 2-pane split with a global
// settings popover (Workspace content).
//
//   ┌──────────────────────────────────────────────────────┐
//   │  [TEAM CHAT]  [AI ASSISTANT]              [⚙ Settings]│  ← top bar
//   ├──────────────────────┬───────────────────────────────┤
//   │                      │                               │
//   │   Team chat          │   AI assistant                │
//   │                      │                               │
//   │   [input]            │   [input]                     │
//   └──────────────────────┴───────────────────────────────┘
//
// Message rendering: Slack/Discord-style. Avatar circle on the
// left, sender name + timestamp in the header row, message body
// below. Consecutive messages from the same sender share the
// avatar slot (only the first shows the name + timestamp).
//
// Settings popover (gear icon top-right) holds the Workspace
// content that used to live in the right drawer on the Flow
// Builder page: invite code + AI source picker + wallet state.

import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Square,
  Trash2,
  Users,
  Wallet,
  X
} from 'lucide-react'
import { useAI } from '../../hooks/useAI'
import { useAIChat } from '../../hooks/useAIChat'
import { useRoom } from '../../hooks/useRoom'
import { useWallet } from '../../context/WalletContext'
import type { ChatMessage } from '../../lib/chat'

// ============================================
// Page chrome — full-bleed, no padding, no header
// ============================================
//
// The AppShell normally wraps the page in a p-8 main padding.
// We opt out of that for the Chat page so the two chat panes
// can use the entire viewport height. We override the margin with
// a negative left/right to break out of the main padding.

function ChatShell({ children }: { children: React.ReactNode }) {
  return (
    <div className='-mx-8 -mt-2 flex h-[calc(100vh-7rem)] flex-col'>
      {children}
    </div>
  )
}

function ChatTopBar({
  active,
  onActive,
  rightAction
}: {
  active: 'team' | 'ai'
  onActive: (which: 'team' | 'ai') => void
  rightAction: React.ReactNode
}) {
  return (
    <div className='flex h-12 flex-shrink-0 items-center justify-between border-b border-brand-border bg-white px-4'>
      <div className='flex items-center gap-1'>
        <ChannelTab
          active={active === 'team'}
          onClick={() => onActive('team')}
          icon={MessageSquare}
          label='Team chat'
        />
        <ChannelTab
          active={active === 'ai'}
          onClick={() => onActive('ai')}
          icon={Sparkles}
          label='AI assistant'
        />
      </div>
      {rightAction}
    </div>
  )
}

function ChannelTab({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'bg-brand-blue text-white'
          : 'text-brand-navy hover:bg-brand-light'
      }`}
    >
      <Icon size={12} className={active ? 'text-white' : 'text-brand-muted'} />
      {label}
    </button>
  )
}

// ============================================
// Slack-style message list
// ============================================
//
// One MessageGroup per "burst" of consecutive messages from the
// same sender (consecutive = same `info.key`, no >5min gap in v1).
// The first message in a group renders the avatar + name + timestamp
// header; subsequent messages render just the text body indented
// to align with the first message's body.

interface MessageGroup {
  sender: string
  senderKey: string
  firstAt: number
  messages: ChatMessage[]
}

function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  if (messages.length === 0) return []
  const groups: MessageGroup[] = []
  let current: MessageGroup | null = null
  for (const m of messages) {
    const senderKey = m.info?.key ?? 'unknown'
    const sender = m.info?.name ?? 'Peer'
    if (!current || current.senderKey !== senderKey) {
      current = {
        sender,
        senderKey,
        firstAt: m.info?.at ?? Date.now(),
        messages: [m]
      }
      groups.push(current)
    } else {
      current.messages.push(m)
    }
  }
  return groups
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatTimeShort(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatTimeLong(ts: number): string {
  return new Date(ts).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Color palette for sender avatars — pick a stable color from the
// sender's writer key. A handful of brand-tinted backgrounds.
const AVATAR_PALETTE = [
  { bg: 'bg-brand-blue', text: 'text-white' },
  { bg: 'bg-brand-teal', text: 'text-brand-navy' },
  { bg: 'bg-brand-ok', text: 'text-white' },
  { bg: 'bg-brand-err', text: 'text-white' },
  { bg: 'bg-amber-500', text: 'text-white' }
]
function avatarFor(key: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

// ============================================
// Team chat panel
// ============================================
function TeamChatPanel() {
  const room = useRoom()
  const [draft, setDraft] = useState('')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const messages = room.chat
  const me = room.me
  const groups = useMemo(() => groupMessages(messages), [messages])

  // Auto-scroll to the bottom on new messages.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const handleSend = () => {
    const text = draft.trim()
    if (!text) return
    room.sendChat(text)
    setDraft('')
  }

  const handleClear = () => {
    room.clearChat()
    setConfirmingClear(false)
  }

  return (
    <ChatPane
      headerRight={
        messages.length > 0 ? (
          confirmingClear ? (
            <div className='flex items-center gap-1.5'>
              <span className='text-xs text-brand-err'>Clear all?</span>
              <button
                type='button'
                onClick={() => setConfirmingClear(false)}
                className='rounded border border-brand-border bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider2 text-brand-navy hover:bg-brand-light'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleClear}
                className='rounded border border-brand-err bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider2 text-brand-err hover:bg-brand-errBg'
              >
                Confirm
              </button>
            </div>
          ) : (
            <button
              type='button'
              onClick={() => setConfirmingClear(true)}
              className='inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-muted hover:text-brand-err'
            >
              <Trash2 size={10} />
              Clear all
            </button>
          )
        ) : null
      }
      footer={
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
            placeholder='Message the team…'
            rows={1}
            className='flex-1 resize-none rounded-md border border-brand-border bg-white px-3 py-2 font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
          />
          <button
            type='submit'
            disabled={!draft.trim()}
            className='inline-flex h-9 items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50'
          >
            <Send size={12} />
            Send
          </button>
        </form>
      }
    >
      <div ref={listRef} className='flex-1 overflow-y-auto px-4 py-3'>
        {messages.length === 0 ? (
          <EmptyPane
            icon={MessageSquare}
            title='No messages yet'
            body='Say hi to the team — your messages are P2P-encrypted and only visible to peers in this teamspace.'
          />
        ) : (
          <ul className='flex flex-col gap-3'>
            {groups.map((g, gi) => (
              <MessageGroupRow
                key={`${gi}-${g.senderKey}`}
                group={g}
                isFromMe={!!me && g.senderKey === me.key}
                canRemove={room.writable}
                onRemove={(id) => room.removeChats([id])}
              />
            ))}
          </ul>
        )}
      </div>
    </ChatPane>
  )
}

function MessageGroupRow({
  group,
  isFromMe,
  canRemove,
  onRemove
}: {
  group: MessageGroup
  isFromMe: boolean
  canRemove: boolean
  onRemove: (id: string) => void
}) {
  const av = avatarFor(group.senderKey)
  return (
    <li
      className={`group relative flex gap-3 rounded-md px-2 py-1 transition-colors ${
        isFromMe ? 'bg-brand-blue/5' : 'hover:bg-brand-light/40'
      }`}
    >
      <div className='flex w-9 flex-shrink-0 flex-col items-center pt-0.5'>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-[11px] font-bold ${av.bg} ${av.text}`}
        >
          {initialsOf(group.sender)}
        </div>
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-baseline gap-2'>
          <span
            className={`truncate font-sans text-[13px] font-semibold ${
              isFromMe ? 'text-brand-blue' : 'text-brand-navy'
            }`}
          >
            {group.sender}
          </span>
          <span
            className='font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'
            title={formatTimeLong(group.firstAt)}
          >
            {formatTimeShort(group.firstAt)}
          </span>
        </div>
        <div className='mt-0.5 space-y-0.5'>
          {group.messages.map((m, mi) => (
            <div
              key={m.id}
              className='group/msg relative break-words pr-6 font-sans text-sm text-brand-navy'
            >
              {m.text}
              {canRemove && mi === 0 && (
                <button
                  type='button'
                  onClick={() => onRemove(m.id)}
                  aria-label='Delete message'
                  className='absolute right-0 top-0 flex items-center justify-center rounded p-0.5 text-brand-muted opacity-0 transition-opacity hover:bg-brand-border hover:text-brand-err group-hover/msg:opacity-100'
                  title='Delete'
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </li>
  )
}

// ============================================
// AI chat panel
// ============================================
function AIChatPanel() {
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
  const error = chat.error

  // Current session metadata — drives the session-bar label + the
  // per-row badge in the session menu.
  const currentSession = useMemo(
    () =>
      chat.sessions.find((s) => s.slug === chat.currentSessionSlug) ?? null,
    [chat.sessions, chat.currentSessionSlug]
  )
  const sessionLabel =
    currentSession?.slug === 'main'
      ? 'Main (default)'
      : currentSession?.slug ?? '…'

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, isStreaming, streamingContent, streamingThinking])

  // Auto-dismiss the destructive Clear confirm after 4s.
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
    <ChatPane
      headerRight={
        <span
          className={`font-mono text-[10px] font-semibold uppercase tracking-wider2 ${
            isStreaming ? 'text-brand-teal' : modelName ? 'text-brand-muted' : 'text-brand-err'
          }`}
        >
          {isStreaming
            ? 'streaming…'
            : modelName
              ? modelName
              : 'no source'}
        </span>
      }
      footer={
        <div className='flex flex-col gap-2'>
          {!aiSource && (
            <div className='flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900'>
              <Sparkles
                size={12}
                className='mt-0.5 flex-shrink-0 text-amber-700'
              />
              <span>
                Pick an AI source in <span className='font-mono'>Settings → AI Model</span> or via
                the gear icon in the top bar to start.
              </span>
            </div>
          )}
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
              placeholder={aiSource ? `Ask ${modelName}…` : 'Pick a source first'}
              rows={1}
              disabled={!aiSource || isStreaming}
              className='flex-1 resize-none rounded-md border border-brand-border bg-white px-3 py-2 font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:opacity-60'
            />
            {isStreaming ? (
              <button
                type='button'
                onClick={() => void chat.cancel()}
                aria-label='Stop generation'
                className='inline-flex h-9 items-center gap-1.5 rounded-md border-0 bg-brand-err px-4 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:bg-brand-errDark focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
              >
                <Square size={12} />
                Stop
              </button>
            ) : (
              <button
                type='submit'
                disabled={!aiSource || !draft.trim()}
                className='inline-flex h-9 items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50'
              >
                <Send size={12} />
                Ask
              </button>
            )}
          </form>
        </div>
      }
    >
      {/* ── Session bar — file icon + current session + count + chevron,
         then a clear-messages trash button on the right. ── */}
      <div className='flex h-9 flex-shrink-0 items-center gap-1.5 border-b border-brand-border bg-white px-3'>
        <div className='relative flex-1'>
          <button
            type='button'
            onClick={() => setShowSessionMenu((v) => !v)}
            aria-haspopup='menu'
            aria-expanded={showSessionMenu}
            className='flex w-full items-center gap-1.5 rounded-md border border-brand-border bg-white px-2 py-1 text-left text-xs font-medium text-brand-navy transition hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
          >
            <FileText size={12} className='text-brand-muted' aria-hidden='true' />
            <span className='min-w-0 flex-1 truncate'>{sessionLabel}</span>
            {currentSession && currentSession.messageCount > 0 && (
              <span className='rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-normal text-brand-muted'>
                {currentSession.messageCount}
              </span>
            )}
            <ChevronDown size={10} className='text-brand-muted' aria-hidden='true' />
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
        <button
          type='button'
          onClick={handleClear}
          disabled={
            !currentSession ||
            currentSession.messageCount === 0 ||
            isStreaming
          }
          aria-label={
            confirmingClear ? 'Confirm clear messages' : 'Clear messages'
          }
          title={
            confirmingClear
              ? 'Click again to confirm'
              : currentSession && currentSession.messageCount > 0
                ? 'Clear all messages in this session'
                : 'No messages to clear'
          }
          className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:cursor-not-allowed ${
            confirmingClear
              ? 'border-brand-err bg-brand-err text-white hover:bg-brand-errDark'
              : 'border-brand-border bg-white text-brand-muted hover:bg-brand-light disabled:text-brand-border'
          }`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* ── Source status hint — compact line showing where AI runs. ── */}
      {chat.aiSource && (
        <p className='flex-shrink-0 border-b border-brand-border bg-white px-4 py-1 text-[10px] text-brand-muted'>
          Connected to{' '}
          <span className='font-medium text-brand-navy'>
            {chat.aiSource.kind === 'local'
              ? `This device — ${chat.aiSource.modelName || 'No model'}`
              : `${chat.aiSource.modelName || 'Peer model'} (peer)`}
          </span>
        </p>
      )}

      <div ref={listRef} className='flex-1 overflow-y-auto px-4 py-3'>
        {messages.length === 0 ? (
          <AIEmptyState
            hasSource={!!chat.aiSource}
            sourceIsLocal={chat.aiSource?.kind === 'local'}
            hasModel={ai.isReady}
          />
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
          <div className='mt-3 rounded-md border border-brand-errBorder bg-brand-errBg px-3 py-2 text-xs text-brand-errDark'>
            <div className='flex items-start gap-2'>
              <span className='font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err'>
                {chat.error.code}
              </span>
              <span className='flex-1'>{chat.error.message}</span>
            </div>
            <div className='mt-2 flex items-center gap-1.5'>
              {isRelayErrorCode(chat.error.code) && (
                <button
                  type='button'
                  onClick={() => void chat.cancel().then(() => chat.retry())}
                  className='inline-flex items-center gap-1 rounded-md border border-brand-err px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err hover:bg-brand-errBg focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
                >
                  Switch source
                </button>
              )}
              {chat.error.retryable && (
                <button
                  type='button'
                  onClick={() => void chat.retry()}
                  className='inline-flex items-center gap-1 rounded-md border border-brand-err px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err hover:bg-brand-errBg focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ChatPane>
  )
}

// ============================================
// AI message rendering
// ============================================
//
// AIMessageRow — a persisted message (user or assistant).
// Assistant messages render via ReactMarkdown + remark-gfm so the
// model can use headings / lists / code blocks / tables / links.
// The optional `thinking` field is rendered as a collapsible
// "Thinking" card, default collapsed once the message has been
// persisted (the user can expand it on hover / click). Streaming
// messages get the same treatment but with the thinking card
// default-expanded (the user is actively watching).
//
// StreamingBubble — the in-progress response. Shows the current
// streamingContent + streamingThinking + a Cancel button. Same
// markdown + thinking UX as a persisted assistant message.

function AIMessageRow({
  message,
  modelName
}: {
  message: { role: 'user' | 'assistant'; content: string; thinking?: string }
  modelName: string
}) {
  const isUser = message.role === 'user'
  const av = isUser
    ? { bg: 'bg-brand-navy', text: 'text-white' }
    : { bg: 'bg-brand-blue', text: 'text-white' }
  const hasThinking =
    !isUser && typeof message.thinking === 'string' && message.thinking.length > 0
  const [showThinking, setShowThinking] = useState(false)
  return (
    <li
      className={`flex gap-3 rounded-md px-2 py-1 ${
        isUser ? 'bg-brand-blue/5' : ''
      }`}
    >
      <div className='flex w-9 flex-shrink-0 flex-col items-center pt-0.5'>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-[11px] font-bold ${av.bg} ${av.text}`}
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
          <ThinkingCard
            thinking={message.thinking!}
            open={showThinking}
            onToggle={() => setShowThinking((v) => !v)}
          />
        )}
        {isUser ? (
          <p className='m-0 mt-0.5 whitespace-pre-wrap break-words font-sans text-sm text-brand-navy'>
            {message.content}
          </p>
        ) : (
          <div className='prose prose-xs mt-0.5 max-w-none text-sm text-brand-navy prose-headings:text-brand-navy prose-p:text-brand-navy prose-a:text-brand-blue prose-strong:text-brand-navy prose-code:text-brand-navy prose-li:text-brand-navy'>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
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
  // Default the thinking card OPEN while streaming so the user can
  // watch the model's reasoning live.
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
          <span className='font-sans text-[13px] font-semibold text-brand-blue'>
            {modelName}
          </span>
          <span className='inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-teal'>
            <span
              className='h-1.5 w-1.5 animate-pulse rounded-full bg-brand-teal'
              aria-hidden='true'
            />
            streaming
          </span>
          {content && (
            <button
              type='button'
              onClick={onCancel}
              aria-label='Stop generation'
              className='ml-auto inline-flex items-center gap-1 rounded-md border border-brand-err bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err hover:bg-brand-errBg'
            >
              <Square size={10} />
              Stop
            </button>
          )}
        </div>
        {hasThinking && (
          <ThinkingCard
            thinking={thinking}
            open={showThinking}
            onToggle={() => setShowThinking((v) => !v)}
            streaming
          />
        )}
        {content ? (
          <div className='prose prose-xs mt-0.5 max-w-none text-sm text-brand-navy prose-headings:text-brand-navy prose-p:text-brand-navy prose-a:text-brand-blue prose-strong:text-brand-navy prose-code:text-brand-navy prose-li:text-brand-navy'>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {content.trimStart()}
            </ReactMarkdown>
          </div>
        ) : (
          !thinking && (
            <p className='m-0 mt-0.5 text-[10px] italic text-brand-muted'>
              Thinking…
            </p>
          )
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
        className='inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300'
      >
        {open ? (
          <ChevronDown size={10} />
        ) : (
          <ChevronRight size={10} />
        )}
        Thinking
        {streaming && (
          <span className='ml-1 inline-flex items-center gap-1 text-amber-600'>
            <span
              className='h-1 w-1 animate-pulse rounded-full bg-amber-500'
              aria-hidden='true'
            />
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

// Minimal markdown component map. No syntax highlighting, no math —
// keep the bundle lean. Code distinction, tables, links with
// target=_blank, headings.
const markdownComponents = {
  a({
    href,
    children,
    ...rest
  }: {
    href?: string
    children?: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    return (
      <a
        href={href}
        target='_blank'
        rel='noreferrer'
        className='text-brand-blue underline hover:text-brand-navy'
        {...rest}
      >
        {children}
      </a>
    )
  },
  code({
    className,
    children,
    ...rest
  }: {
    className?: string
    children?: React.ReactNode
  } & React.HTMLAttributes<HTMLElement>) {
    const isBlock =
      typeof className === 'string' && className.startsWith('language-')
    if (isBlock) {
      return (
        <pre className='my-1 overflow-x-auto rounded-md bg-brand-navy p-2 font-mono text-[11px] text-white'>
          <code className={className} {...rest}>
            {children}
          </code>
        </pre>
      )
    }
    return (
      <code
        className='rounded bg-brand-light px-1 py-0.5 font-mono text-[11px] text-brand-navy'
        {...rest}
      >
        {children}
      </code>
    )
  },
  pre({ children }: { children?: React.ReactNode }) {
    return <>{children}</>
  },
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className='mb-1 text-sm font-semibold text-brand-navy'>{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className='mb-1 text-sm font-semibold text-brand-navy'>{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className='mb-1 text-xs font-semibold text-brand-navy'>{children}</h3>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className='my-1 list-disc pl-4'>{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className='my-1 list-decimal pl-4'>{children}</ol>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className='my-1 border-l-2 border-brand-border pl-2 text-brand-muted'>
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <table className='my-1 w-full border-collapse text-[11px]'>{children}</table>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className='border border-brand-border bg-brand-light px-1 py-0.5 text-left font-medium text-brand-navy'>
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className='border border-brand-border px-1 py-0.5 text-brand-navy'>
      {children}
    </td>
  )
}

// Codes that mean "the peer source is no longer reachable — pick a
// new one". A local SEND_FAILED doesn't qualify: the user might
// just want to Retry, not switch sources.
const RELAY_ERROR_CODES = new Set([
  'MODEL_MISMATCH',
  'RELAY_ERROR',
  'ROUTE_FAILED',
  'NO_SOURCE'
])

function isRelayErrorCode(code: string | undefined | null): boolean {
  if (!code) return false
  return RELAY_ERROR_CODES.has(code)
}

// ============================================
// Session menu — dropdown anchored to the session-bar trigger
// on the AI chat panel. Lists existing sessions, lets the user
// switch, create a new one, or delete a non-main one. The
// per-row delete uses a 4s two-step confirm so a stray click
// doesn't wipe a session.
// ============================================
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
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(
    null
  )
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Outside-click closes the menu.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (!t || !t.closest('[data-session-menu]')) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  // Auto-clear the confirm after 4s.
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
              isCurrent
                ? 'bg-brand-blue/10 text-brand-navy'
                : 'text-brand-navy hover:bg-brand-light'
            }`}
          >
            <button
              type='button'
              onClick={() => onSelect(s.slug)}
              className='min-w-0 flex-1 truncate text-left'
            >
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
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider2 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 ${
                  isConfirming
                    ? 'bg-brand-err text-white hover:bg-brand-errDark'
                    : 'text-brand-muted hover:bg-brand-errBg hover:text-brand-err'
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

// ============================================
// Shared chat-pane chrome — header + body + footer
// ============================================
function ChatPane({
  headerRight,
  footer,
  children
}: {
  headerRight?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className='flex min-h-0 flex-1 flex-col border-r border-brand-border bg-white last:border-r-0'>
      <header className='flex h-10 flex-shrink-0 items-center justify-between border-b border-brand-border bg-brand-light px-4'>
        <span className='font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-muted'>
          Messages
        </span>
        {headerRight}
      </header>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>{children}</div>
      {footer && (
        <div className='flex-shrink-0 border-t border-brand-border bg-white p-3'>
          {footer}
        </div>
      )}
    </section>
  )
}

function EmptyPane({
  icon: Icon,
  title,
  body
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  body: string
}) {
  return (
    <div className='flex h-full flex-col items-center justify-center px-6 text-center'>
      <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-brand-border bg-brand-light'>
        <Icon size={20} className='text-brand-muted' />
      </div>
      <h3 className='m-0 font-sans text-base font-medium text-brand-navy'>
        {title}
      </h3>
      <p className='m-0 mt-1.5 max-w-sm text-xs leading-relaxed text-brand-muted'>
        {body}
      </p>
    </div>
  )
}

// Three distinct empty states for the AI chat panel:
//   1. No source at all → primary "Pick a source" CTA
//   2. Source is local but no model is loaded → guide the user
//      through loading a model (via Settings > AI Model).
//   3. Source is set and a model is loaded → generic prompt.
function AIEmptyState({
  hasSource,
  sourceIsLocal,
  hasModel
}: {
  hasSource: boolean
  sourceIsLocal: boolean
  hasModel: boolean
}) {
  let title: string
  let body: string
  if (!hasSource) {
    title = 'No source selected'
    body =
      'Pick an AI source in the gear-icon popover (top-right) to start chatting. You can use a local model or a peer\'s model.'
  } else if (sourceIsLocal && !hasModel) {
    title = 'No model loaded'
    body =
      'Your source is "This device" but no model is loaded. Open Settings → AI Model to load one.'
  } else {
    title = 'Start a conversation'
    body = 'Your messages are streamed from the selected source. Responses are markdown-aware.'
  }
  return (
    <EmptyPane icon={Sparkles} title={title} body={body} />
  )
}

// ============================================
// Settings popover (Workspace content) — gear icon top-right
// ============================================
function SettingsPopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className='relative'>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-haspopup='menu'
        aria-expanded={open}
        aria-label='Workspace settings'
        title='Workspace settings'
        className='inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition-colors hover:bg-brand-light hover:text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
      >
        <SettingsIcon size={14} />
      </button>
      {open && (
        <div
          ref={ref}
          role='menu'
          className='absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-md border border-brand-border bg-white shadow-[0_18px_50px_-12px_rgba(10,10,92,0.25)]'
        >
          <WorkspacePanel compact />
        </div>
      )}
    </div>
  )
}

function WorkspacePanel({ compact = false }: { compact?: boolean }) {
  const room = useRoom()
  const ai = useAI()
  const chat = useAIChat()
  const { status, openSetup } = useWallet()
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  async function handleCopy() {
    if (!room.invite) return
    try {
      await navigator.clipboard.writeText(room.invite)
      setCopied(true)
    } catch (e) {
      setErr('Copy failed — your browser may have blocked clipboard access.')
    }
  }

  function selectLocal() {
    if (!ai.activeModel) return
    chat.setAiSource({
      kind: 'local',
      modelId: ai.activeModel.id,
      modelName: ai.activeModel.name
    })
  }
  function selectHost() {
    if (!hostState) return
    chat.setAiSource({
      kind: 'peer',
      writerKey: hostState.writerKey,
      modelId: hostState.modelId ?? '',
      modelName: hostState.modelName ?? 'Host model'
    })
  }
  function clearSource() {
    chat.setAiSource(null)
  }

  const localKey = room.me?.key
  const hostState =
    room.peerAiStates.find((s) => s.writerKey !== localKey) ?? null
  const hostHasModel = !!(hostState?.modelId && hostState?.modelName)
  const hostVisible = hostState !== null

  const sectionClass = compact ? 'p-4' : 'p-4'
  const headerClass =
    'mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-muted'

  return (
    <div className='flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-4'>
      {/* ── Invite code ── */}
      <section>
        <h3 className={headerClass}>Invite code</h3>
        {room.invite && room.role === 'host' ? (
          <div className='flex items-center gap-2 rounded-md border border-brand-border bg-white px-2.5 py-1.5'>
            <code
              className='flex-1 truncate font-mono text-xs text-brand-navy'
              title={room.invite}
            >
              {room.invite}
            </code>
            <button
              type='button'
              onClick={handleCopy}
              aria-label='Copy invite code'
              className='inline-flex h-7 w-7 items-center justify-center rounded text-brand-muted transition hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
            >
              {copied ? (
                <Check size={14} className='text-brand-teal' />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        ) : (
          <p className='m-0 text-xs text-brand-muted'>
            {room.role === 'guest'
              ? "Joined the host's room."
              : room.status === 'ready'
                ? 'Minting invite code…'
                : 'Starting room…'}
          </p>
        )}
      </section>

      {/* ── Peers ── */}
      <section>
        <h3 className={headerClass}>Peers</h3>
        <p className='m-0 text-xs text-brand-navy'>
          {room.peers === 0
            ? 'No peers connected'
            : `${room.peers} peer${room.peers > 1 ? 's' : ''}`}
        </p>
      </section>

      {/* ── AI source ── */}
      <section>
        <div className='mb-1.5 flex items-center justify-between'>
          <h3 className={headerClass}>AI source</h3>
          {chat.aiSource && (
            <button
              type='button'
              onClick={clearSource}
              className='inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted transition hover:text-brand-err'
            >
              <X size={10} />
              Clear
            </button>
          )}
        </div>
        <p className='m-0 mb-1.5 text-[10px] text-brand-muted'>
          Select where AI processing runs.
        </p>
        <div className='flex flex-col gap-1.5'>
          <SourceRow
            kind='local'
            label='Local'
            subtitle='This device'
            modelName={ai.activeModel?.name ?? null}
            selected={
              chat.aiSource?.kind === 'local' &&
              chat.aiSource.modelId === ai.activeModel?.id
            }
            onSelect={selectLocal}
            disabled={!ai.activeModel}
            disabledReason={!ai.activeModel ? 'No model loaded' : undefined}
          />
          <SourceRow
            kind='host'
            label='Host'
            subtitle={
              hostState ? shortWriterKey(hostState.writerKey) : 'Waiting for host…'
            }
            modelName={hostHasModel ? hostState?.modelName ?? null : null}
            selected={
              chat.aiSource?.kind === 'peer' &&
              chat.aiSource.writerKey === hostState?.writerKey
            }
            onSelect={selectHost}
            disabled={!hostHasModel}
            disabledReason={
              !hostVisible
                ? 'Re-checking…'
                : !hostHasModel
                  ? 'Host has no model loaded'
                  : !hostState?.accepting
                    ? 'Host is busy'
                    : undefined
            }
          />
        </div>
      </section>

      {/* ── Wallet ── */}
      <section>
        <h3 className={headerClass}>Wallet</h3>
        {status?.exists ? (
          <p className='m-0 break-all font-mono text-xs text-brand-navy'>
            {status.partyId}
          </p>
        ) : (
          <button
            type='button'
            onClick={openSetup}
            className='inline-flex items-center gap-1.5 rounded-md border border-brand-blue bg-white px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-blue hover:bg-brand-light'
          >
            <Wallet size={12} />
            Setup
          </button>
        )}
      </section>

      {/* ── Peers (AI source picker) ── */}
      {room.peers > 0 && (
        <section>
          <h3 className={headerClass}>Peers (AI source)</h3>
          <ul className='flex flex-col gap-1'>
            {room.peerAiStates.map((s) => (
              <li
                key={s.writerKey}
                className='flex items-center justify-between gap-2 rounded-md border border-brand-border bg-white px-2.5 py-1.5'
              >
                <div className='min-w-0'>
                  <p className='m-0 truncate font-mono text-[10px] text-brand-navy'>
                    {s.writerKey.slice(0, 10)}…
                  </p>
                  <p className='m-0 truncate text-[10px] text-brand-muted'>
                    {s.modelName ?? 'No model loaded'}
                  </p>
                </div>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider2 ${
                    s.accepting ? 'text-brand-ok' : 'text-brand-muted'
                  }`}
                >
                  {s.accepting ? 'Ready' : 'Busy'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {err && (
        <div className='rounded-md border border-brand-errBorder bg-brand-errBg px-2.5 py-1.5 text-[10px] text-brand-errDark'>
          {err}
        </div>
      )}

      {!compact && (
        <section>
          <h3 className={headerClass}>Team</h3>
          <p className='m-0 text-xs text-brand-muted'>
            {room.peers === 0
              ? 'Share the invite above to bring co-workers into this teamspace.'
              : 'P2P-encrypted chat + AI on the left.'}
          </p>
        </section>
      )}
    </div>
  )
}

function SourceRow({
  kind,
  label,
  subtitle,
  modelName,
  selected,
  onSelect,
  disabled,
  disabledReason
}: {
  kind: 'local' | 'host'
  label: string
  subtitle: string
  modelName: string | null
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  disabledReason?: string
}) {
  return (
    <button
      type='button'
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? 'border-brand-blue bg-brand-blue/10'
          : 'border-brand-border bg-white hover:bg-brand-light'
      }`}
    >
      <span
        aria-hidden='true'
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? 'border-brand-blue bg-brand-blue' : 'border-brand-border bg-white'
        }`}
      >
        {selected && <span className='h-1.5 w-1.5 rounded-full bg-white' />}
      </span>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-1.5 text-xs'>
          <span className='truncate font-medium text-brand-navy'>{label}</span>
          <span className='truncate text-[10px] font-normal text-brand-muted'>
            {subtitle}
          </span>
          {selected && (
            <span className='rounded bg-brand-blue/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider2 text-brand-blue'>
              Active
            </span>
          )}
        </div>
        <p className='m-0 mt-0.5 truncate text-[10px] text-brand-muted'>
          {modelName ??
            (kind === 'local' ? 'No model loaded' : 'No model loaded on host')}
          {disabled && disabledReason ? ` · ${disabledReason}` : ''}
        </p>
      </div>
    </button>
  )
}

function shortWriterKey(key: string) {
  if (typeof key !== 'string' || key.length < 6) return 'host'
  return `host-${key.slice(0, 6)}`
}

// ============================================
// Chat page entry
// ============================================
export function ChatPage() {
  // Tab state lives at the page level so the Settings popover stays
  // accessible from either pane. Default to 'team' (the first-run
  // experience starts with a teamspace, not the AI panel).
  const [active, setActive] = useState<'team' | 'ai'>('team')

  return (
    <ChatShell>
      <ChatTopBar
        active={active}
        onActive={setActive}
        rightAction={<SettingsPopover />}
      />
      <div className='flex min-h-0 flex-1'>
        {active === 'team' ? (
          <TeamChatPanel />
        ) : (
          <AIChatPanel />
        )}
      </div>
    </ChatShell>
  )
}

export default ChatPage
