import type { FlowOutcomeStatus } from '../ai/types'

const STATUS_MAP: Record<FlowOutcomeStatus, { label: string; bg: string; fg: string; border: string }> = {
  pending:    { label: 'Pending',    bg: '#f7f7fc', fg: '#7a7a99', border: '#e0e0f0' },
  computing:  { label: 'Computing',  bg: '#eaf0ff', fg: '#1a1ae8', border: '#1a1ae8' },
  converting: { label: 'Converting', bg: '#eaf0ff', fg: '#1a1ae8', border: '#1a1ae8' },
  signing:    { label: 'Signing',    bg: '#eaf0ff', fg: '#1a1ae8', border: '#1a1ae8' },
  sending:    { label: 'Sending',    bg: '#eaf0ff', fg: '#1a1ae8', border: '#1a1ae8' },
  settled:    { label: 'Settled',    bg: '#eafaf8', fg: '#0e7f74', border: '#0e7f74' },
  failed:     { label: 'Failed',     bg: '#fdecec', fg: '#c83030', border: '#c83030' },
  memoized:   { label: 'Memoized',   bg: '#eafaf8', fg: '#0e7f74', border: '#0e7f74' },
}

export default function RouteStatusPill({ status }: { status: FlowOutcomeStatus }) {
  const v = STATUS_MAP[status]
  return (
    <span
      className="inline-flex items-center font-mono text-[10px] font-bold rounded-full px-2 py-0.5 tracking-wider2 uppercase border"
      style={{ background: v.bg, color: v.fg, borderColor: v.border }}
    >
      {v.label}
    </span>
  )
}
