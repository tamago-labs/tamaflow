import type { RouteSummary } from '../../../preload/index.d'

/**
 * Coloured pill that renders a `RouteSummary['status']` as a single,
 * consistent label + colour pair. Used by both the per-flow RoutesPanel
 * (`FlowDetail.tsx`) and the cross-flow Settlement History page
 * (`pages/Settlements.tsx`) — kept here so the colour map is the single
 * source of truth across the app.
 *
 * The colour palette is intentionally hex-coded (not Tailwind tokens) so
 * the pills look identical inside the densely-shaded `RoutesPanel` card
 * AND the white-background Settlements table — Tailwind's brand-* tokens
 * shift between light/dark contexts in subtle ways the raw hex avoids.
 */
const STATUS_MAP: Record<
  RouteSummary['status'],
  { label: string; bg: string; fg: string; border: string }
> = {
  pending:    { label: 'Pending',    bg: '#f7f7fc', fg: '#7a7a99', border: '#e0e0f0' },
  computing:  { label: 'Computing',  bg: '#eaf0ff', fg: '#1a1ae8', border: '#1a1ae8' },
  converting: { label: 'Converting', bg: '#eaf0ff', fg: '#1a1ae8', border: '#1a1ae8' },
  signing:    { label: 'Signing',    bg: '#eaf0ff', fg: '#1a1ae8', border: '#1a1ae8' },
  sending:    { label: 'Sending',    bg: '#eaf0ff', fg: '#1a1ae8', border: '#1a1ae8' },
  settled:    { label: 'Settled',    bg: '#eafaf8', fg: '#0e7f74', border: '#0e7f74' },
  failed:     { label: 'Failed',     bg: '#fdecec', fg: '#c83030', border: '#c83030' },
  memoized:   { label: 'Memoized',   bg: '#eafaf8', fg: '#0e7f74', border: '#0e7f74' },
}

export default function RouteStatusPill({
  status,
}: {
  status: RouteSummary['status']
}) {
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
