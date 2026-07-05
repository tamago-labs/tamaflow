import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Loader2, LogIn, Pencil } from 'lucide-react'
import type { Me, RoomRole } from '../hooks/useRoom'
import { Logomark } from './Logomark'
import { InviteJoinModal } from './InviteJoinModal'
import { NameEditModal } from './NameEditModal'

interface SplashPageProps {
  role: RoomRole | null
  invite: string | null
  writable: boolean
  error: string | null
  me: Me | null
  onOpenCanvas: () => void
  // Switch host → guest mid-session. Triggers a worker restart in
  // main.js with `--invite <code>`; the splash stays mounted while the
  // new worker boots and the role flips to 'guest'.
  onJoinInvite: (invite: string) => void
  // Per-session display-name change. Pipes to `bridge.writeRoom({type:
  // 'rename-self', name})` in the worker; the worker re-emits `me` so
  // the splash label updates without waiting for a snapshot.
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
  // "joining" reflects an in-flight join attempt (modal submitted, worker
  // not yet back). The splash spinner reads this to swap its copy.
  const joining = !ready && showJoin && role === null

  return (
    <motion.div
      key='splash'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className='relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-navy via-brand-navy to-brand-blue text-white'
      role='status'
      aria-live='polite'
      aria-label='Starting TamaFlow'
    >
      {/* Ambient glows — teal top-right, blue bottom-left. Same recipe
         as the frontend Hero so the desktop boot screen feels like
         the same product as the public marketing site. */}
      <div
        className='pointer-events-none absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full'
        style={{
          background:
            'radial-gradient(circle, rgba(62, 196, 192, 0.28) 0%, rgba(62, 196, 192, 0) 70%)'
        }}
      />
      <div
        className='pointer-events-none absolute -bottom-40 -left-32 h-[480px] w-[480px] rounded-full'
        style={{
          background:
            'radial-gradient(circle, rgba(26, 26, 232, 0.25) 0%, rgba(26, 26, 232, 0) 70%)'
        }}
      />

      {/* Wordmark — "Tama" in white, "flow" in brand-blue. Mirrors
         the frontend BrandLockup split (navy/blue on light) but
         inverted for the dark splash background: the navy half
         becomes white so it reads on brand-navy, and "flow" stays
         in brand-blue — the teal/cyan is reserved for accents
         (spinner, focus rings, the Logomark icon). */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
        className='relative flex items-center gap-3'
      >
        <Logomark size={48} />
        <span
          className='text-5xl font-extrabold tracking-tight'
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <span className='text-white'>Tama</span>
          <span className='text-brand-blue'>flow</span>
        </span>
      </motion.div>

      {/* Tagline — pulled from the Tamaflow brand so the desktop
         boot screen matches the marketing copy in
         frontend/app/page.tsx. */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className='mt-3 font-mono text-[11px] uppercase tracking-wider3 text-brand-teal/90'
      >
        Employer Client v1.0
      </motion.p>

      {/* "Signed in as <name>" — clickable to open the name-edit modal.
         Sits above the spinner / invite state so the user's identity is
         visible from the moment the worker emits the `me` frame.
         Hidden until that frame arrives (the name is unknown before
         then, and the pencil affordance would be misleading). */}
      {me && (
        <button
          type='button'
          onClick={() => setShowNameEdit(true)}
          aria-label='Change display name'
          className='mt-8 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 backdrop-blur transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
        >
          <span className='text-white/60'>Signed in as</span>
          <span className='font-semibold text-white'>{me.name}</span>
          <Pencil className='h-3 w-3 text-white/60' aria-hidden='true' />
        </button>
      )}

      {!ready && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className='mt-6 flex items-center gap-3 text-sm text-white/80'
        >
          <Loader2
            className='h-4 w-4 animate-spin text-brand-teal'
            aria-hidden='true'
          />
          <span>
            {error
              ? `Failed to start TamaFlow: ${error}`
              : joining
                ? `Joining with invite\u2026`
                : role === null
                  ? 'Preparing workspace\u2026'
                  : 'Starting TamaFlow\u2026'}
          </span>
        </motion.div>
      )}

      {ready && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className='mt-8 flex flex-col items-center gap-4 px-6 text-center'
        >
          {role === 'host' && invite ? (
            <>
              <p className='text-sm text-white/80'>
                Send this code to a co-worker to bring them in
              </p>
              <div className='flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 backdrop-blur'>
                <code
                  className='max-w-xs truncate font-mono text-xs text-white'
                  title={invite}
                >
                  {invite}
                </code>
                <button
                  type='button'
                  onClick={handleCopy}
                  aria-label='Copy invite code'
                  className='inline-flex h-6 w-6 items-center justify-center rounded text-white/80 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
                >
                  {copied ? (
                    <Check
                      className='h-3.5 w-3.5 text-brand-teal'
                      aria-hidden='true'
                    />
                  ) : (
                    <Copy className='h-3.5 w-3.5' aria-hidden='true' />
                  )}
                </button>
              </div>
              <button
                type='button'
                onClick={onOpenCanvas}
                className='mt-2 inline-flex h-9 items-center rounded-md bg-white px-5 text-sm font-semibold text-brand-navy transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
              >
                Open workspace
              </button>
            </>
          ) : (
            <p className='text-sm text-white/80'>
              Joined. Loading workspace\u2026
            </p>
          )}
        </motion.div>
      )}

      {ready && (
        <button
          type='button'
          onClick={() => setShowJoin(true)}
          aria-label='Join existing workspace'
          className='mt-6 inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
        >
          <LogIn className='h-3.5 w-3.5' aria-hidden='true' />
          Join existing workspace
        </button>
      )}

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
    </motion.div>
  )
}
