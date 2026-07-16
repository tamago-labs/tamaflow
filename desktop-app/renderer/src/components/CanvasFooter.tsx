import { useWorkerStatus, type WorkerStatus } from '../hooks/useWorkerStatus'
import { useAI } from '../hooks/useAI'
import { useAIModal } from '../context/AIModalContext'

// Global status footer. Rendered once at the AppShell level so it
// shows on every page (was previously only inside the Flow Builder
// canvas, hidden when the user navigated to Chat / Employees /
// Settlements / etc.). Renders two pills:
//
//   • AI model pill (left)  — clickable, opens AIModelModal
//   • Worker status (right) — read-only, reflects the P2P worker
//
// Tamaflow rebrand: the old tamarind-green / neutral-gray palette
// is gone — the footer is a persistent global element so it uses
// the brand tokens (brand-light bg, brand-border top, brand-blue
// focus ring, brand-ok / brand-err / brand-warn accent dots).

const STATUS_META = {
  starting: { label: 'P2P worker starting…', dot: 'bg-yellow-500', text: 'text-brand-navy' },
  running: { label: 'P2P worker online', dot: 'bg-brand-ok', text: 'text-brand-ok' },
  exited: { label: 'P2P worker stopped', dot: 'bg-gray-400', text: 'text-brand-muted' },
  error: { label: 'P2P worker error', dot: 'bg-brand-err', text: 'text-brand-err' }
} as const satisfies Record<WorkerStatus, { label: string; dot: string; text: string }>

export function CanvasFooter() {
  return (
    <footer className='flex h-8 w-full items-center justify-between border-t border-brand-border bg-brand-light px-4'>
      <AIModelPill />
      <WorkerStatusPill />
    </footer>
  )
}

// Left pill — AI model status. Clicking opens AIModelModal so the
// employer can swap / reload / unload the local model from any page.
// The dot color follows the same logic as before (loaded / error /
// loading / idle) but uses the brand palette.
function AIModelPill() {
  const { isReady, activeModel, progress, error } = useAI()
  const { openAIModel } = useAIModal()

  const meta = isReady
    ? {
        text: `AI: ${activeModel?.name ?? 'loaded'}`,
        dot: 'bg-brand-ok',
        textColor: 'text-brand-ok'
      }
    : error
      ? { text: 'AI: error — click to retry', dot: 'bg-brand-err', textColor: 'text-brand-err' }
      : progress
        ? {
            text: `AI: loading… ${Math.round(progress.percentage)}%`,
            dot: 'bg-yellow-500',
            textColor: 'text-brand-navy'
          }
        : { text: 'AI: not loaded', dot: 'bg-gray-400', textColor: 'text-brand-muted' }

  return (
    <button
      type='button'
      onClick={openAIModel}
      title='Click to manage AI model'
      aria-label='Manage AI model'
      className='inline-flex h-6 items-center gap-2 rounded-md px-2 text-xs font-semibold text-brand-navy transition hover:bg-brand-border focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden='true' />
      <span className={meta.textColor}>{meta.text}</span>
    </button>
  )
}

// Right pill — read-only worker status. The dot pulses when the
// worker is online so the employer can see at a glance whether
// Hyperswarm replication is live.
function WorkerStatusPill() {
  const status = useWorkerStatus()
  const { label, dot, text } = STATUS_META[status]
  return (
    <div className='flex items-center gap-2 text-xs font-semibold' aria-live='polite'>
      <span
        className={`relative inline-flex h-1.5 w-1.5 ${
          status === 'running' ? '' : ''
        }`}
      >
        {status === 'running' && (
          <span className={`absolute inset-0 rounded-full ${dot} animate-ping opacity-60`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden='true' />
      </span>
      <span className={text}>{label}</span>
    </div>
  )
}
