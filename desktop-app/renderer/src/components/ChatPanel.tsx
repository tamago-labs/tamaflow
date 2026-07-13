// Floating chat panel with framer-motion animations
// Shows chat messages from desktop app via Pear P2P

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, MessageCircle } from 'lucide-react'
import { cli } from '../../lib/cli'

interface ChatMessage {
  id: string
  text: string
  info: {
    name: string
    key: string
    at: number
  }
}

interface ChatPanelProps {
  open: boolean
  onClose: () => void
}

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Poll for messages every 5 seconds
  useEffect(() => {
    if (!open) return

    const fetchMessages = async () => {
      try {
        const msgs = await cli.chat.list()
        if (Array.isArray(msgs)) {
          setMessages(msgs)
        }
      } catch (e) {
        // CLI might not be running
      }
    }

    fetchMessages()
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [open])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    // TODO: Send message via CLI
    console.log('[Chat] Send:', input)
    setInput('')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className='fixed right-4 bottom-20 z-50 w-80 rounded-lg border border-gray-200 bg-white shadow-xl'
        >
          {/* Header */}
          <div className='flex items-center justify-between border-b border-gray-200 px-4 py-3'>
            <div className='flex items-center gap-2'>
              <MessageCircle size={16} className='text-blue-600' />
              <span className='font-sans text-sm font-semibold text-gray-900'>Team Chat</span>
            </div>
            <button
              type='button'
              onClick={onClose}
              className='rounded p-1 hover:bg-gray-100 transition-colors'
            >
              <X size={14} className='text-gray-500' />
            </button>
          </div>

          {/* Messages */}
          <div className='h-64 overflow-y-auto p-3'>
            {messages.length === 0 ? (
              <div className='flex h-full items-center justify-center'>
                <p className='text-xs text-gray-400'>No messages yet</p>
              </div>
            ) : (
              <div className='space-y-2'>
                {messages.map((msg) => (
                  <div key={msg.id} className='rounded bg-gray-50 p-2'>
                    <div className='flex items-center gap-2 mb-1'>
                      <span className='text-xs font-semibold text-gray-700'>{msg.info.name}</span>
                      <span className='text-[10px] text-gray-400'>
                        {new Date(msg.info.at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className='text-sm text-gray-900'>{msg.text}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className='border-t border-gray-200 p-3'>
            <div className='flex gap-2'>
              <input
                type='text'
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder='Type a message...'
                className='flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none'
              />
              <button
                type='button'
                onClick={handleSend}
                className='rounded bg-blue-600 p-1.5 text-white hover:bg-blue-700 transition-colors'
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
