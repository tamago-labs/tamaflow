import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Loader2, LogIn, Pencil } from 'lucide-react'
import type { Me, RoomRole } from '../hooks/useRoom'
import { InviteJoinModal } from './InviteJoinModal'
import { NameEditModal } from './NameEditModal'

interface SplashPageProps {
  role: RoomRole | null
  invite: string | null
  writable: boolean
  error: string | null
  me: Me | null
  onOpenCanvas: () => void
  onJoinInvite: (invite: string) => void
  onRenameSelf: (name: string) => void
}

export function SplashPage({
  role,
  invite,
  writable,
  error,
  me,
  onOpenCanvas,
  onJoinInvite,
  onRenameSelf
}: SplashPageProps) {
  const [copied, setCopied] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showNameEdit, setShowNameEdit] = useState(false)

  function handleCopy() {
    if (!invite) return
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(invite)
        .then(() => setCopied(true))
        .catch(() => {})
    }
  }

  const ready = role !== null && writable
  const joining = !ready && showJoin && role === null

  return (
    <div className="min-h-screen bg-white flex items-center justify-start pl-14 relative overflow-hidden font-sans">
      {/* Top-right geometric blocks — teal + blue accent */}
      <div className="absolute top-0 right-[180px] w-[200px] h-[160px] bg-[#3EC4C0] z-[1]" />
      <div className="absolute top-0 right-0 w-[180px] h-[80px] bg-[#1A1AE8] z-[3]" />
      <div className="absolute top-[80px] right-0 w-[320px] h-[240px] bg-[#1A1AE8] z-[2]" />
      {/* Teal left-edge accent */}
      <div className="absolute bottom-0 left-0 w-1 h-[100px] bg-[#3EC4C0] z-[5]" />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-[10] bg-white border border-gray-200 w-full max-w-[420px] overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(10,10,92,0.08)' }}
      >
        {/* Teal bar */}
        <div className="h-2 bg-[#3EC4C0]" />

        <div className="px-8 pt-7 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-2xl font-extrabold tracking-tight text-[#0a0a5c]">
              Tama<span className="text-[#1A1AE8]">flow</span>
            </span>
            <span className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase">
              Canton L1 • Local AI • P2P
            </span>
          </div>

          {ready && (
            <h1 className="font-sans text-sm text-gray-600 mb-6 leading-relaxed m-0">
              You're in. Your team can now <span className="font-semibold text-gray-900">chat and collaborate</span> through Hyperswarm, and run <span className="font-semibold text-gray-900">AI-powered payroll flows</span> that settle on <span className="font-semibold text-[#1A1AE8]">Canton</span>
            </h1>
          )}

          {/* Signed in as */}
          {me && (
            <button
              type="button"
              onClick={() => setShowNameEdit(true)}
              className="mb-6 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 cursor-pointer hover:bg-gray-100 transition"
            >
              <span className="text-gray-400">Signed in as</span>
              <span className="font-semibold text-gray-900">{me.name}</span>
              <Pencil className="h-3 w-3 text-gray-400" />
            </button>
          )}

          {/* Loading state */}
          {!ready && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-[#3EC4C0]" />
              <span className="font-sans text-sm text-gray-600">
                {error
                  ? `Failed to start: ${error}`
                  : joining
                    ? `Joining with invite…`
                    : role === null
                      ? 'Preparing teamspace…'
                      : 'Starting Tamaflow…'}
              </span>
            </div>
          )}

          {/* Ready state */}
          {ready && (
            <div className="space-y-4">
              {role === 'host' && invite ? (
                <>
                  <p className="font-sans text-sm text-gray-500 m-0">
                    Send this code to a co-worker to bring them in
                  </p>
                  <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                    <code className="max-w-xs truncate font-mono text-xs text-gray-900" title={invite}>
                      {invite}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 transition"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-[#3EC4C0]" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenCanvas}
                    className="w-full inline-flex h-10 items-center justify-center rounded-md bg-[#1A1AE8] text-sm font-semibold text-white hover:bg-[#1515c0] transition"
                  >
                    Open teamspace
                  </button>
                </>
              ) : (
                <p className="font-sans text-sm text-gray-500 m-0">
                  Joined. Loading teamspace…
                </p>
              )}
            </div>
          )}

          {/* Join existing */}
          {ready && (
            <button
              type="button"
              onClick={() => setShowJoin(true)}
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition cursor-pointer bg-transparent border-0 p-0"
            >
              <LogIn className="h-3.5 w-3.5" />
              Join existing teamspace
            </button>
          )}
        </div>
      </motion.div>

      <InviteJoinModal
        open={showJoin}
        onClose={() => setShowJoin(false)}
        onSubmit={(code) => {
          setShowJoin(false)
          onJoinInvite(code)
        }}
        busy={joining}
      />

      <NameEditModal
        open={showNameEdit}
        currentName={me?.name ?? ''}
        onClose={() => setShowNameEdit(false)}
        onSubmit={(name) => {
          onRenameSelf(name)
          setShowNameEdit(false)
        }}
      />
    </div>
  )
}
