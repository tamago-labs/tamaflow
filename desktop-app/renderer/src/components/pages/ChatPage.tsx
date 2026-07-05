// Chat page — three panels side-by-side (collapse to a single
// column on narrow viewports):
//
//   ┌─────────────────┬─────────────────┬──────────────────┐
//   │ Team chat       │ AI assistant     │ Workspace          │
//   │ (P2P history     │ (local model /   │ (invite code +     │
//   │ + send input)   │  relay-to-peer)  │  AI source picker) │
//   └─────────────────┴─────────────────┴──────────────────┘
//
// All three panels are full-height flex columns so the chat input
// stays pinned at the bottom of the chat surface and the peer list
// stays scrollable in the Workspace rail.
//
// Replaces the old RightDrawer (which had 3 tabs — Workspace / Team
// chat / AI assistant — sitting inside the Flow Builder's canvas).
// The right column on the Flow Builder is now removed; chat + AI
// source picker live here on the Chat page since they're closely
// related to peer-to-peer messaging.

import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  X
} from 'lucide-react'
import { PageHeader } from '../PageHeader'
import { useAI } from '../../hooks/useAI'
import { useAIChat } from '../../hooks/useAIChat'
import { useRoom } from '../../hooks/useRoom'
import { useWallet } from '../../context/WalletContext'
import type { ChatMessage } from '../../lib/chat'

// ============================================
// 3-column responsive grid
// ============================================
// xl / 2xl viewport → 3 columns (team | AI | workspace).
// lg            → 2 columns (team + AI), workspace wraps below.
// md and below  → single column (team → AI → workspace stacked).
function ChatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_320px]'>
      {children}
    </div>
  )
}

// Shared panel chrome — white card with brand-border + sticky header.
function Panel({
  title,
  icon: Icon,
  badge,
  children,
  footer
}: {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <section className='flex h-[calc(100vh-13rem)] min-h-[480px] flex-col overflow-hidden rounded-md border border-brand-border bg-white'>
      <header className='flex flex-shrink-0 items-center justify-between border-b border-brand-border bg-brand-light px-4 py-2.5'>
        <div className='flex items-center gap-2'>
          <Icon size={14} className='text-brand-navy' />
          <h2 className='font-mono text-[11px] font-bold uppercase tracking-wider2 text-brand-navy'>
            {title}
          </h2>
          {badge}
        </div>
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

// ============================================
// Team chat panel
// ============================================
function TeamChatPanel() {
  const room = useRoom()
  const { status, openSetup } = useWallet()
  const writable = !!status?.exists
  const [draft, setDraft] = useState('')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const messages = room.chat
  const me = room.me

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
    <Panel
      title='Team chat'
      icon={MessageSquare}
      badge={
        <span className='font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
          {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
        </span>
      }
      footer={
        !writable ? (
          <div className='flex items-center gap-2 rounded-md border border-brand-border bg-brand-light px-3 py-2 text-xs text-brand-muted'>
            <Wallet size={12} />
            Set up a wallet to send messages.{' '}
            <button
              type='button'
              onClick={openSetup}
              className='font-semibold text-brand-blue hover:underline'
            >
              Setup
            </button>
          </div>
        ) : (
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
              placeholder={writable ? 'Message the team…' : ''}
              rows={1}
              disabled={!writable}
              className='flex-1 resize-none rounded-md border border-brand-border bg-white px-3 py-2 font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:opacity-60'
            />
            <button
              type='submit'
              disabled={!writable || !draft.trim()}
              className='inline-flex h-9 items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50'
            >
              <Send size={12} />
              Send
            </button>
          </form>
        )
      }
    >
      <div
        ref={listRef}
        className='flex-1 overflow-y-auto p-4'
      >
        {messages.length === 0 ? (
          <EmptyChat label='No messages yet. Say hi to the team.' />
        ) : (
          <ul className='flex flex-col gap-3'>
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                isFromMe={!!me && m.info?.key === me.key}
                canRemove={writable}
                onRemove={() => room.removeChats([m.id])}
              />
            ))}
          </ul>
        )}
      </div>
      {messages.length > 0 && writable && (
        <div className='flex flex-shrink-0 items-center justify-between border-t border-brand-border bg-brand-light px-3 py-2'>
          {confirmingClear ? (
            <div className='flex w-full items-center justify-between gap-2'>
              <p className='text-xs text-brand-err'>Clear all messages?</p>
              <div className='flex items-center gap-1.5'>
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
          )}
        </div>
      )}
    </Panel>
  )
}

function MessageRow({
  message,
  isFromMe,
  canRemove,
  onRemove
}: {
  message: ChatMessage
  isFromMe: boolean
  canRemove: boolean
  onRemove: () => void
}) {
  return (
    <li
      className={`flex flex-col gap-0.5 rounded-md border px-3 py-2 ${
        isFromMe
          ? 'border-brand-blue/30 bg-brand-blue/5'
          : 'border-brand-border bg-brand-light/50'
      }`}
    >
      <div className='flex items-baseline justify-between gap-2'>
        <span
          className={`truncate font-sans text-xs font-semibold ${
            isFromMe ? 'text-brand-blue' : 'text-brand-navy'
          }`}
          title={message.info?.name ?? 'Peer'}
        >
          {message.info?.name ?? 'Peer'}
        </span>
        <div className='flex items-center gap-2'>
          <span className='font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
            {message.info?.at
              ? new Date(message.info.at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : ''}
          </span>
          {canRemove && (
            <button
              type='button'
              onClick={onRemove}
              aria-label='Delete message'
              className='text-brand-muted hover:text-brand-err'
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>
      <p className='m-0 break-words font-sans text-sm text-brand-navy'>
        {message.text}
      </p>
    </li>
  )
}

function EmptyChat({ label }: { label: string }) {
  return (
    <div className='flex h-full flex-col items-center justify-center text-center'>
      <div className='mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-brand-light'>
        <MessageSquare size={18} className='text-brand-muted' />
      </div>
      <p className='m-0 max-w-xs font-sans text-sm text-brand-muted'>{label}</p>
    </div>
  )
}

// ============================================
// AI chat panel
// ============================================
function AIChatPanel() {
  const ai = useAI()
  const chat = useAIChat()
  const room = useRoom()
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const messages = chat.messages
  const isStreaming = chat.isStreaming
  const aiSource = chat.aiSource
  const modelName = chat.aiSource?.modelName ?? null
  const isRelay = aiSource?.kind === 'peer'

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const handleSend = () => {
    const text = draft.trim()
    if (!text || isStreaming) return
    chat.send(text)
    setDraft('')
  }

  return (
    <Panel
      title='AI assistant'
      icon={Sparkles}
      badge={
        <span
          className={`font-mono text-[10px] font-semibold uppercase tracking-wider2 ${
            isStreaming ? 'text-brand-teal' : 'text-brand-muted'
          }`}
        >
          {isStreaming ? 'streaming…' : modelName ? `· ${modelName}` : '· no source'}
        </span>
      }
      footer={
        <div className='flex flex-col gap-2'>
          {!aiSource && (
            <div className='flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900'>
              <Sparkles size={12} className='mt-0.5 flex-shrink-0 text-amber-700' />
              <span>
                Pick an AI source in the Workspace panel → the chat
                surface will stream responses from there.
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
            <button
              type='submit'
              disabled={!aiSource || isStreaming || !draft.trim()}
              className='inline-flex h-9 items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50'
            >
              {isStreaming ? <Loader2 size={12} className='animate-spin' /> : <Send size={12} />}
              {isStreaming ? 'Sending…' : 'Ask'}
            </button>
          </form>
        </div>
      }
    >
      <div ref={listRef} className='flex-1 overflow-y-auto p-4'>
        {messages.length === 0 ? (
          <EmptyChat
            label={
              aiSource
                ? `Ask ${modelName} anything — the response streams into this panel.`
                : 'No source selected. Pick one in the Workspace panel to start.'
            }
          />
        ) : (
          <ul className='flex flex-col gap-3'>
            {messages.map((m, i) => (
              <li
                key={i}
                className={`flex flex-col gap-0.5 rounded-md border px-3 py-2 ${
                  m.role === 'user'
                    ? 'border-brand-blue/30 bg-brand-blue/5'
                    : 'border-brand-border bg-brand-light/50'
                }`}
              >
                <span
                  className={`font-mono text-[10px] font-bold uppercase tracking-wider2 ${
                    m.role === 'user' ? 'text-brand-blue' : 'text-brand-teal'
                  }`}
                >
                  {m.role === 'user' ? 'You' : modelName ?? 'AI'}
                </span>
                <p className='m-0 whitespace-pre-wrap break-words font-sans text-sm text-brand-navy'>
                  {m.content}
                </p>
              </li>
            ))}
            {isStreaming && (
              <li className='flex items-center gap-2 text-brand-muted'>
                <Loader2 size={12} className='animate-spin' />
                <span className='font-mono text-[10px] uppercase tracking-wider2'>
                  {modelName} is thinking…
                </span>
              </li>
            )}
          </ul>
        )}
        {chat.error && (
          <div className='mt-3 rounded-md border border-brand-errBorder bg-brand-errBg px-3 py-2 text-xs text-brand-errDark'>
            <p className='m-0 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err'>
              {isRelay ? 'Relay error' : 'AI error'}
            </p>
            <p className='m-0 mt-1'>{chat.error.message}</p>
          </div>
        )}
      </div>
    </Panel>
  )
}

// ============================================
// Workspace panel (invite + AI source picker)
// ============================================
function WorkspacePanel() {
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

  return (
    <Panel title='Workspace' icon={Users}>
      <div className='flex flex-1 flex-col gap-5 overflow-y-auto p-4'>
        {/* ── Invite code ── */}
        <section>
          <h3 className='mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
            Invite code
          </h3>
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
          <p className='m-0 mt-2 text-[10px] text-brand-muted'>
            {room.role === 'host'
              ? 'Share this code so peers can join the teamspace.'
              : room.role === 'guest'
                ? 'You joined using a host-shared code.'
                : 'Preparing room…'}
          </p>
        </section>

        {/* ── Peers ── */}
        <section>
          <h3 className='mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
            Peers
          </h3>
          <p className='m-0 text-xs text-brand-navy'>
            {room.peers === 0 ? 'No peers connected' : `${room.peers} peer${room.peers > 1 ? 's' : ''}`}
          </p>
        </section>

        {/* ── AI source picker ── */}
        <section>
          <div className='mb-2 flex items-center justify-between'>
            <h3 className='font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              AI source
            </h3>
            {chat.aiSource && (
              <button
                type='button'
                onClick={clearSource}
                title='Clear the current source'
                className='inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted transition hover:text-brand-err'
              >
                <X size={10} />
                Clear
              </button>
            )}
          </div>
          <p className='m-0 mb-2 text-[10px] text-brand-muted'>
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
              subtitle={hostState ? shortWriterKey(hostState.writerKey) : 'Waiting for host…'}
              modelName={hostHasModel ? (hostState?.modelName ?? null) : null}
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

        {/* ── Wallet state ── */}
        <section>
          <h3 className='mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
            Wallet
          </h3>
          {status?.exists ? (
            <p className='m-0 text-xs text-brand-navy'>
              {status.partyHint}::{status.fingerprint?.slice(0, 8)}…
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

        {err && (
          <div className='rounded-md border border-brand-errBorder bg-brand-errBg px-2.5 py-1.5 text-[10px] text-brand-errDark'>
            {err}
          </div>
        )}
      </div>
    </Panel>
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
          {modelName ?? (kind === 'local' ? 'No model loaded' : 'No model loaded on host')}
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
  return (
    <div className='flex h-full flex-col gap-4'>
      <PageHeader
        label='Teamspace'
        title='Chat'
        subtitle='Team messages, AI assistant, and teamspace config in one place.'
      />
      <ChatGrid>
        <TeamChatPanel />
        <AIChatPanel />
        <WorkspacePanel />
      </ChatGrid>
    </div>
  )
}

export default ChatPage
