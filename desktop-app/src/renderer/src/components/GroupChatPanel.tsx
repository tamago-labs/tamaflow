// Team chat panel — P2P chat history + send input.
// Ported from v2 and adapted to v1's Tailwind brand tokens.

import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import type { ChatMessage } from '../lib/chat'
import type { RoomRole } from '../hooks/useRoom'

interface GroupChatPanelProps {
  invite: string | null
  peers: number
  messages: ChatMessage[]
  role: RoomRole | null
  writable: boolean
  me: { key: string; name: string } | null
  onSendChat: (text: string) => void
  onRemoveChat: (id: string) => void
  onClearChat: () => void
  onCopyInvite: () => void
}

export function GroupChatPanel({
  invite: _invite,
  peers: _peers,
  messages,
  role: _role,
  writable,
  me,
  onSendChat,
  onRemoveChat,
  onClearChat
}: GroupChatPanelProps) {
  const [draft, setDraft] = useState('')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  useEffect(() => {
    if (!confirmingClear) return
    const handle = setTimeout(() => setConfirmingClear(false), 4000)
    return () => clearTimeout(handle)
  }, [confirmingClear])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!writable) return
    const text = draft.trim()
    if (!text) return
    onSendChat(text)
    setDraft('')
  }

  function handleClearAll() {
    if (!writable) return
    if (messages.length === 0) return
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
    onClearChat()
    setConfirmingClear(false)
  }

  return (
    <div className='flex h-full min-h-0 flex-1 flex-col gap-2'>
      <div className='flex items-center justify-between'>
        <h3 className='font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-muted'>Chat</h3>
        <button
          type='button'
          onClick={handleClearAll}
          disabled={!writable || messages.length === 0}
          aria-label={confirmingClear ? 'Confirm clear all messages' : 'Clear all messages'}
          title={
            confirmingClear
              ? 'Click again to confirm'
              : writable
                ? 'Remove every message in this room'
                : 'Joining…'
          }
          className={`inline-flex h-6 items-center gap-1 rounded px-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider2 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:cursor-not-allowed ${
            confirmingClear
              ? 'bg-brand-err text-white hover:bg-red-700 disabled:bg-brand-border'
              : 'text-brand-muted hover:bg-brand-light disabled:text-brand-border'
          }`}
        >
          <Trash2 className='h-3 w-3' aria-hidden='true' />
          {confirmingClear ? 'Confirm clear' : 'Clear all'}
        </button>
      </div>
      <div
        ref={listRef}
        className='flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-brand-border bg-white p-2'
      >
        {messages.length === 0 ? (
          <div className='m-auto flex max-w-[16rem] flex-col items-center gap-2 px-2 py-6 text-center'>
            <div className='rounded-full bg-brand-light p-2'>
              <MessageSquare className='h-4 w-4 text-brand-muted' aria-hidden='true' />
            </div>
            <p className='text-xs font-medium text-brand-navy'>No messages yet</p>
            <p className='text-[10px] text-brand-muted'>
              Say hello to your team to get the conversation started.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = me && m.info?.key === me.key
            const label = isMe ? 'You' : (m.info?.name ?? m.info?.key?.slice(0, 6) ?? 'anonymous')
            return (
              <div key={m.id} className='group flex flex-col gap-0.5'>
                <div className='flex items-center justify-between'>
                  <span className='font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
                    {label}
                  </span>
                  {isMe && writable && (
                    <button
                      type='button'
                      onClick={() => onRemoveChat(m.id)}
                      aria-label={`Remove message ${m.id}`}
                      title='Remove this message'
                      className='invisible inline-flex h-4 w-4 items-center justify-center rounded text-brand-muted transition hover:bg-brand-light hover:text-brand-err focus:outline-none focus:ring-2 focus:ring-brand-teal/60 group-hover:visible focus:visible'
                    >
                      <Trash2 className='h-3 w-3' aria-hidden='true' />
                    </button>
                  )}
                </div>
                <p className='whitespace-pre-wrap break-words font-sans text-xs text-brand-navy'>{m.text}</p>
              </div>
            )
          })
        )}
      </div>
      <form
        onSubmit={handleSubmit}
        className='flex items-center gap-1'
        aria-label='Send a chat message'
      >
        <input
          type='text'
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={writable ? 'Type a message…' : 'Joining…'}
          disabled={!writable}
          aria-label='Chat message'
          className='h-8 flex-1 rounded-md border border-brand-border bg-white px-2 font-sans text-xs text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:cursor-not-allowed disabled:bg-brand-light'
        />
        <button
          type='submit'
          disabled={!writable || draft.trim().length === 0}
          aria-label='Send message'
          className='inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-blue text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-brand-border'
        >
          <Send className='h-3.5 w-3.5' aria-hidden='true' />
        </button>
      </form>
    </div>
  )
}
