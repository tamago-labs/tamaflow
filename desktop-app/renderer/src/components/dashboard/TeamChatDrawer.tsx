import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Trash2, X } from 'lucide-react'
import { useRoom } from '../../hooks/useRoom'
import Drawer from '../Drawer'

interface MessageGroup {
  sender: string
  senderKey: string
  firstAt: number
  messages: Array<{ id: string; text: string; info?: { key?: string; name?: string; at?: number } }>
}

function groupMessages(messages: any[]): MessageGroup[] {
  if (messages.length === 0) return []
  const groups: MessageGroup[] = []
  let current: MessageGroup | null = null
  for (const m of messages) {
    const senderKey = m.info?.key ?? 'unknown'
    const sender = m.info?.name ?? 'Peer'
    if (!current || current.senderKey !== senderKey) {
      current = { sender, senderKey, firstAt: m.info?.at ?? Date.now(), messages: [m] }
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
  const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const AVATAR_COLORS = ['#1A1AE8', '#3EC4C0', '#10B981', '#F59E0B', '#EF4444']
function avatarColor(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

interface TeamChatDrawerProps {
  open: boolean
  onClose: () => void
}

export function TeamChatDrawer({ open, onClose }: TeamChatDrawerProps) {
  const room = useRoom()
  const [draft, setDraft] = useState('')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const messages = room.chat.filter((m: any) => !m.text?.startsWith('[payslip]'))
  const me = room.me
  const groups = useMemo(() => groupMessages(messages), [messages])

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
    <Drawer open={open} onClose={onClose} title="Team Chat" width="480px">
      <div className="flex flex-col h-full">
        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-y-auto -mx-6 -my-5 px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <span className="text-gray-400 text-lg">💬</span>
              </div>
              <p className="text-sm text-gray-500 m-0">No messages yet</p>
              <p className="text-xs text-gray-400 m-0 mt-1">Say hi to the team</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {groups.map((g, gi) => {
                const isFromMe = !!me && g.senderKey === me.key
                const color = avatarColor(g.senderKey)
                return (
                  <li key={`${gi}-${g.senderKey}`} className={`group relative flex gap-3 rounded-md px-2 py-1 ${isFromMe ? 'bg-blue-50' : ''}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: color }}>
                      {initialsOf(g.sender)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-semibold ${isFromMe ? 'text-blue-600' : 'text-gray-900'}`}>{g.sender}</span>
                        <span className="text-[10px] text-gray-400">{formatTimeShort(g.firstAt)}</span>
                      </div>
                      <div className="mt-0.5 space-y-0.5">
                        {g.messages.map((m, mi) => (
                          <div key={m.id} className="group/msg relative text-sm text-gray-700 break-words pr-5">
                            {m.text}
                            {room.writable && mi === 0 && (
                              <button
                                type="button"
                                onClick={() => room.removeChats([m.id])}
                                className="absolute right-0 top-0 p-0.5 text-gray-400 opacity-0 hover:text-red-500 group-hover/msg:opacity-100 transition-opacity"
                                title="Delete"
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
              })}
            </ul>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 pt-3 -mx-6 px-6 -mb-5 pb-5">
          {/* {messages.length > 0 && room.writable && (
            <div className="mb-2">
              {confirmingClear ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-red-500">Clear all?</span>
                  <button onClick={() => setConfirmingClear(false)} className="px-2 py-0.5 text-gray-600 border border-gray-200 rounded hover:bg-gray-50">Cancel</button>
                  <button onClick={handleClear} className="px-2 py-0.5 text-red-600 border border-red-200 rounded hover:bg-red-50">Confirm</button>
                </div>
              ) : (
                <button onClick={() => setConfirmingClear(true)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500"><Trash2 size={10} />Clear</button>
              )}
            </div>
          )} */}
          <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Message the team…"
              rows={1}
              className="flex-1 resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button type="submit" disabled={!draft.trim()} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
              <Send size={12} />Send
            </button>
          </form>
        </div>
      </div>
    </Drawer>
  )
}

export default TeamChatDrawer
