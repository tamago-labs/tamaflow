import PageHeader from '../components/PageHeader'
import { useAI } from '../context/AIContext'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, Power, RotateCcw, Cpu } from 'lucide-react'

/** Outlet context shape, set by MainLayout. */
interface OutletCtx {
  onChangeModel: () => void
}

/**
 * Dashboard placeholder — high-level overview:
 *   • AI status card with Change / Unload (or Load) actions on the right
 *   • "Continue where you left off" card pointing at the latest active flow
 *   • Three small KPI tiles (employees, active flows, settled this month)
 */
export default function Dashboard() {
  const { isReady, activeModel, unload } = useAI()
  const { onChangeModel } = useOutletContext<OutletCtx>()

  return (
    <div>
      <PageHeader
        label="Overview"
        title="TamaFlow Dashboard"
        subtitle="Privacy-first payroll on Canton. Import a flow, let the AI review it, approve, settle privately."
      />

      {/* AI status / actions card */}
      <div className="bg-white border border-brand-border rounded-md p-6 mb-6 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: isReady ? '#3EC4C0' : '#9999bb' }}
              />
              <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
                {isReady ? 'AI Ready' : 'No model loaded'}
              </p>
            </div>
            {isReady && activeModel ? (
              <p className="font-sans text-base text-brand-navy m-0">
                {activeModel.name} is loaded and ready to process payroll.
              </p>
            ) : (
              <p className="font-sans text-base text-brand-navy m-0">
                Load an AI model to start processing payroll flows.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {isReady && activeModel ? (
              <>
                <button
                  type="button"
                  onClick={onChangeModel}
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-brand-blue text-white border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
                  title="Open the model picker"
                >
                  <RotateCcw size={12} />
                  Change Model
                </button>
                <button
                  type="button"
                  onClick={() => void unload()}
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
                  title="Unload the model and free memory"
                >
                  <Power size={12} />
                  Unload
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onChangeModel}
                className="flex items-center gap-1.5 py-1.5 px-3 bg-brand-blue text-white border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
              >
                <Cpu size={12} />
                Load Model
              </button>
            )}
          </div>
        </div>
      </div>

      {/* "Continue where you left off" */}
      <div className="bg-white border border-brand-border rounded-md p-6 mb-6 max-w-3xl">
        <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-2 m-0">
          Latest Flow
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-sans text-base font-medium text-brand-navy m-0">
              No flows yet
            </p>
            <p className="font-sans text-sm text-brand-muted mt-1 mb-0">
              Create a new flow to get started.
            </p>
          </div>
          <Link
            to="/flows/new"
            className="flex items-center gap-1.5 py-2 px-4 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase no-underline hover:opacity-90"
          >
            New Flow
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-4 max-w-3xl">
        {[
          { label: 'Employees', value: '—' },
          { label: 'Active Flows', value: '0' },
          { label: 'Settled (30d)', value: '0' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-brand-border rounded-md p-5">
            <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mb-2">
              {kpi.label}
            </p>
            <p className="font-sans text-2xl font-light text-brand-navy m-0">{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
