import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useFlows } from '../context/FlowContext'
import type { FlowSummary } from '../../../preload/index.d'

/**
 * Active Flows — the unified flow list. Each row links into the
 * `/flows/:id` builder for that flow.
 *
 * Phase 2 scope: list every persisted flow with its derived counts
 * (payees / transfers / cards). Click a row → builder. Empty state
 * directs the user to `/flows/new` to create their first flow.
 *
 * Status filtering from the original placeholder (Draft / Review /
 * Approved / Netting / Settled) is intentionally deferred — flows
 * are drafts at this stage; the other statuses will land alongside
 * the execution worker (Phase 4).
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

  return (
    <div>
      <PageHeader
        label="Workflow"
        title="Active Flows"
        subtitle="Every payroll flow in one place. Open one to edit its canvas, or start a new one."
        actions={
          <button
            type="button"
            onClick={() => navigate('/flows/new')}
            className="flex items-center gap-1.5 py-2 px-3 bg-brand-blue text-white border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
          >
            <Plus size={11} />
            New Flow
          </button>
        }
      />

      {/* Error banner — surfaces FlowContext load failures. The
          context keeps the last error around until the user clears
          it; for now we just show it inline so they can see why the
          list is empty without an extra toast surface. */}
      {error && (
        <div className="bg-white border border-[#c83030] rounded-md px-4 py-3 mb-4">
          <p className="font-mono text-[10px] tracking-wider2 uppercase text-[#c83030] font-bold m-0 mb-1">
            Couldn't load flows
          </p>
          <p className="font-sans text-sm text-brand-navy m-0">{error}</p>
        </div>
      )}

      {/* List */}
      <div className="bg-white border border-brand-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_auto] gap-4 py-3 px-4 border-b border-brand-border bg-brand-light">
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Flow
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Payees
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Transfers
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Updated
          </span>
          <span aria-hidden className="w-4" />
        </div>

        {loadStatus === 'loading' && flows.length === 0 ? (
          <div className="py-12 text-center font-sans text-sm text-brand-muted">
            Loading flows…
          </div>
        ) : flows.length === 0 ? (
          <div className="py-12 text-center font-sans text-sm text-brand-muted">
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
          <ul className="m-0 p-0 list-none">
            {flows.map((f) => (
              <FlowRow key={f.id} flow={f} onOpen={() => navigate(`/flows/${f.id}`)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function FlowRow({ flow, onOpen }: { flow: FlowSummary; onOpen: () => void }) {
  return (
    <li className="border-b border-brand-border last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left grid grid-cols-[1.6fr_1fr_1fr_1fr_auto] gap-4 py-3 px-4 items-center bg-transparent border-0 cursor-pointer hover:bg-brand-light transition-colors"
      >
        <span className="font-sans text-sm text-brand-navy font-medium truncate">
          {flow.name || <span className="italic text-brand-muted">Untitled flow</span>}
        </span>
        <span className="font-mono text-sm text-brand-navy">
          {flow.payeeCount}
          <span className="text-brand-muted"> / {flow.cardCount}</span>
        </span>
        <span className="font-mono text-sm text-brand-navy">
          {flow.transferCount}
        </span>
        <span className="font-sans text-xs text-brand-muted">
          {formatDate(flow.updatedAt)}
        </span>
        <ArrowRight size={14} className="text-brand-muted" />
      </button>
    </li>
  )
}
