import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useFlows } from '../context/FlowContext'
import type { FlowStatus, FlowSummary } from '../../../preload/index.d'

/**
 * Active Flows — two sections:
 *   • **Active & Draft** — flows the user can still work with (status
 *     `draft` or `active`). Active rows show live route progress
 *     ("X/Y settled") so the cockpit doubles as a settlement monitor.
 *   • **Completed** — flows where every route finished (settled or
 *     failed). Read-only history; row shows completed-at timestamp.
 *
 * Click a row → `/flows/:id` builder (status drives draft / active /
 * completed view in FlowDetail).
 */

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ActiveFlows() {
  const { flows, loadStatus, error } = useFlows()
  const navigate = useNavigate()

  const active = flows.filter((f) => f.status === 'draft' || f.status === 'active')
  const completed = flows.filter((f) => f.status === 'completed')

  return (
    <div>
      <PageHeader
        label="Workflow"
        title="Active Flows"
        subtitle="Every payroll flow in one place. Open one to edit its canvas, or start a new one."
        actions={
          <button
            type="button"
            // `state.create: true` tells NewFlow to ALWAYS create a new
            // flow (skipping the "use the latest" fallback the sidebar
            // Flow Builder entry uses). The sidebar's NavLink doesn't
            // pass any state, so it still lands on the most-recent flow.
            onClick={() => navigate('/flows/new', { state: { create: true } })}
            className="flex items-center gap-1.5 py-2 px-3 bg-brand-blue text-white border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
          >
            <Plus size={11} />
            New Flow
          </button>
        }
      />

      {/* Error banner — surfaces FlowContext load failures. */}
      {error && (
        <div className="bg-white border border-[#c83030] rounded-md px-4 py-3 mb-4">
          <p className="font-mono text-[10px] tracking-wider2 uppercase text-[#c83030] font-bold m-0 mb-1">
            Couldn't load flows
          </p>
          <p className="font-sans text-sm text-brand-navy m-0">{error}</p>
        </div>
      )}

      {loadStatus === 'loading' && flows.length === 0 ? (
        <div className="bg-white border border-brand-border rounded-md py-12 text-center font-sans text-sm text-brand-muted">
          Loading flows…
        </div>
      ) : flows.length === 0 ? (
        <div className="bg-white border border-brand-border rounded-md py-12 text-center font-sans text-sm text-brand-muted">
          No flows yet — start one from{' '}
          <button
            type="button"
            onClick={() => navigate('/flows/new')}
            className="text-brand-blue font-medium underline-offset-2 hover:underline bg-transparent border-0 p-0 cursor-pointer"
          >
            New Flow
          </button>
          .
        </div>
      ) : (
        <div className="space-y-6">
          <FlowSection
            title="Active & Draft"
            subtitle="Flows you can edit, start, or stop."
            flows={active}
            emptyHint="No active or draft flows."
            onOpen={(id) => navigate(`/flows/${id}`)}
          />
          <FlowSection
            title="Completed"
            subtitle="Settled history — read-only."
            flows={completed}
            emptyHint="No completed flows yet."
            onOpen={(id) => navigate(`/flows/${id}`)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────

interface FlowSectionProps {
  title: string
  subtitle: string
  flows: FlowSummary[]
  emptyHint: string
  onOpen: (id: string) => void
}

function FlowSection({ title, subtitle, flows, emptyHint, onOpen }: FlowSectionProps) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="font-mono text-[11px] tracking-wider2 uppercase text-brand-muted font-bold m-0">
          {title}
        </h2>
        <span className="font-sans text-xs text-brand-muted">— {subtitle}</span>
        <span className="font-mono text-[10px] tracking-wider2 uppercase text-brand-muted ml-auto">
          {flows.length} {flows.length === 1 ? 'flow' : 'flows'}
        </span>
      </div>
      <div className="bg-white border border-brand-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-4 py-3 px-4 border-b border-brand-border bg-brand-light">
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Flow
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Status
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Progress
          </span>
          <span aria-hidden className="w-4" />
        </div>

        {flows.length === 0 ? (
          <div className="py-8 px-4 text-center font-sans text-xs italic text-brand-muted">
            {emptyHint}
          </div>
        ) : (
          <ul className="m-0 p-0 list-none">
            {flows.map((f) => (
              <FlowRow key={f.id} flow={f} onOpen={() => onOpen(f.id)} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────

function FlowRow({ flow, onOpen }: { flow: FlowSummary; onOpen: () => void }) {
  return (
    <li className="border-b border-brand-border last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left grid grid-cols-[1.4fr_1fr_1fr_auto] gap-4 py-3 px-4 items-center bg-transparent border-0 cursor-pointer hover:bg-brand-light transition-colors"
      >
        <div className="flex flex-col min-w-0">
          <span className="font-sans text-sm text-brand-navy font-medium truncate">
            {flow.name || <span className="italic text-brand-muted">Untitled flow</span>}
          </span>
          <span className="font-mono text-[10px] text-brand-muted uppercase tracking-wider2">
            {flow.payeeCount} payee{flow.payeeCount === 1 ? '' : 's'} ·{' '}
            {flow.cardCount} card{flow.cardCount === 1 ? '' : 's'}
          </span>
        </div>
        <StatusBadge status={flow.status} updatedAt={flow.updatedAt} />
        <ProgressBadge flow={flow} />
        <ArrowRight size={14} className="text-brand-muted" />
      </button>
    </li>
  )
}

// ─── Status / Progress pills ────────────────────────────────────────

function StatusBadge({ status, updatedAt }: { status: FlowStatus; updatedAt: string }) {
  const label =
    status === 'draft'
      ? 'Draft'
      : status === 'active'
      ? 'Active'
      : 'Completed'
  const cls =
    status === 'draft'
      ? 'text-brand-navy bg-white border-brand-navy'
      : status === 'active'
      ? 'text-white bg-brand-blue border-brand-blue'
      : 'text-brand-tealAccent bg-[#eafaf8] border-brand-teal'
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`inline-flex items-center font-mono text-[10px] font-bold rounded-full px-2 py-0.5 tracking-wider2 uppercase border w-fit ${cls}`}
      >
        {label}
      </span>
      <span className="font-sans text-[10px] text-brand-muted">
        {status === 'completed' ? 'Settled' : `Updated ${formatDate(updatedAt)}`}
      </span>
    </div>
  )
}

function ProgressBadge({ flow }: { flow: FlowSummary }) {
  // Active flows: show route progress; completed: settle ratio; draft: just payees.
  if (flow.status === 'draft') {
    return (
      <span className="font-mono text-xs text-brand-muted">
        {flow.payeeCount} payee{flow.payeeCount === 1 ? '' : 's'} ready
      </span>
    )
  }
  if (flow.routeCount === 0) {
    return (
      <span className="font-mono text-xs text-brand-muted">No routes</span>
    )
  }
  const settled = flow.settledCount + flow.failedCount
  const total = flow.routeCount
  const pct = total > 0 ? Math.round((settled / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-xs text-brand-navy">
        {settled}
        <span className="text-brand-muted"> / {total} settled</span>
        {flow.failedCount > 0 && (
          <span className="text-brand-err ml-2">· {flow.failedCount} failed</span>
        )}
      </span>
      <div className="h-1 w-28 bg-brand-light rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-blue rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}