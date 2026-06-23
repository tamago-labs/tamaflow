import { useState } from 'react'
import PageHeader from '../components/PageHeader'

/**
 * Active Flows placeholder — the unified flow list. Shows every flow
 * with a status pill. Filter chips at the top scope the list to a
 * single state (Draft / Review / Approved / Netting / Settled).
 *
 * The data is in-memory placeholder for now; a future pass will wire
 * this to the real flows store.
 */

type FlowStatus = 'Draft' | 'Review' | 'Approved' | 'Netting' | 'Settled'

const FILTERS: Array<FlowStatus | 'All'> = [
  'All',
  'Draft',
  'Review',
  'Approved',
  'Netting',
  'Settled',
]

const statusColors: Record<FlowStatus, { bg: string; fg: string; border: string }> = {
  Draft: { bg: '#f7f7fc', fg: '#9999bb', border: '#e0e0f0' },
  Review: { bg: '#eafaf8', fg: '#085041', border: '#3EC4C0' },
  Approved: { bg: '#eaeefc', fg: '#1A1AE8', border: '#1A1AE8' },
  Netting: { bg: '#fff4e0', fg: '#8a5a00', border: '#e0b070' },
  Settled: { bg: '#e6f7ee', fg: '#0a8463', border: '#0a8463' },
}

export default function ActiveFlows() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')

  return (
    <div>
      <PageHeader
        label="Workflow"
        title="Active Flows"
        subtitle="Every payroll flow in one place. Filter by status to focus on what needs you next."
      />

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`py-1 px-3 rounded-full border font-mono text-[10px] tracking-wider2 uppercase cursor-pointer ${
              filter === f
                ? 'bg-brand-blue text-white border-brand-blue font-bold'
                : 'bg-white text-brand-muted border-brand-border font-normal hover:border-brand-blue hover:text-brand-navy'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white border border-brand-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 py-3 px-4 border-b border-brand-border bg-brand-light">
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Flow
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Period
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Employees
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Total
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Status
          </span>
        </div>
        <div className="py-12 text-center font-sans text-sm text-brand-muted">
          No flows yet — start one from{' '}
          <a href="#/flows/new" className="text-brand-blue font-medium">
            New Flow
          </a>
          .
        </div>
      </div>

      {/* Reference for the status colour map (kept here so devs know the palette) */}
      <details className="mt-6 text-xs text-brand-muted font-mono">
        <summary className="cursor-pointer">status palette (dev ref)</summary>
        <div className="mt-2 grid grid-cols-5 gap-2 max-w-2xl">
          {(Object.keys(statusColors) as FlowStatus[]).map((s) => (
            <div
              key={s}
              className="px-2 py-1 border rounded text-center"
              style={{
                background: statusColors[s].bg,
                color: statusColors[s].fg,
                borderColor: statusColors[s].border,
              }}
            >
              {s}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
