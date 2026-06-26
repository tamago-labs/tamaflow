import { useAI } from '../context/AIContext'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Power, RotateCcw, TrendingUp, Coins } from 'lucide-react'

/** Outlet context shape, set by MainLayout. */
interface OutletCtx {
  onChangeModel: () => void
}

/**
 * Dashboard — employer overview.
 *
 * The AI status card adopts the welcome-banner visual style (navy +
 * teal/blue halos, light heading with teal accent) but keeps the
 * content focused on the AI model — eyebrow, heading, Canton
 * subtitle, status dot, action buttons. No 4-step grid.
 *
 *   1. AI card (left 2/3) + 2 stat cards (right 1/3)
 *   2. "Continue where you left off" — Latest Flow card
 *   3. Three small KPI tiles
 *   4. Three small KPI tiles
 */

const STATS: ReadonlyArray<{
  label: string
  value: string
  hint: string
  Icon: typeof TrendingUp
  accent: 'ok' | 'blue' | 'muted'
}> = [
  {
    label: 'Active Flows',
    value: '0',
    hint: 'Pending review',
    Icon: TrendingUp,
    accent: 'blue',
  },
  {
    label: 'Settled (30d)',
    value: '0',
    hint: 'On Canton',
    Icon: Coins,
    accent: 'ok',
  },
]

const accentDot: Record<'ok' | 'blue' | 'muted', string> = {
  ok: 'bg-brand-ok',
  blue: 'bg-brand-blue',
  muted: 'bg-brand-muted',
}
const accentIconWrap: Record<'ok' | 'blue' | 'muted', string> = {
  ok: 'bg-[#e6f7ee] text-brand-ok border-brand-ok',
  blue: 'bg-[#eaeefc] text-brand-blue border-brand-blue',
  muted: 'bg-brand-light text-brand-muted border-brand-border',
}

export default function Dashboard() {
  const { isReady, activeModel, unload } = useAI()
  const { onChangeModel } = useOutletContext<OutletCtx>()

  return (
    <div>
      {/* ── AI card + 2 stat cards (side-by-side) ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* AI card — left 2/3, welcome-banner visual style */}
        <div className="lg:col-span-2 relative bg-brand-navy text-white rounded-lg overflow-hidden p-8 lg:p-10 flex flex-col">
          {/* Teal halo (top-right) */}
          <div
            className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(62, 196, 192, 0.3) 0%, rgba(62, 196, 192, 0) 70%)',
            }}
          />
          {/* Blue halo (bottom-left) */}
          <div
            className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(26, 26, 232, 0.25) 0%, rgba(26, 26, 232, 0) 70%)',
            }}
          />

          {/* Top: eyebrow + heading + subtitle */}
          <div className="relative">
            <p className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold mb-3">
              Dashboard
            </p>
            <h1 className="text-3xl md:text-4xl font-light leading-tight">
              Automate Payroll with <span className="text-brand-teal">Local AI</span>
            </h1>
            <p className="font-sans text-base text-white/70 mt-3 mb-0 max-w-xl leading-relaxed">
              Parse payrolls, flag anomalies, and settle on{' '}
              <span className="text-white">Canton</span> — all without sending data
              to the cloud.
            </p>
          </div>

          {/* Bottom: status + actions */}
          <div className="relative mt-8 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: isReady ? '#3EC4C0' : '#9999bb' }}
              />
              <span className="font-mono text-[10px] tracking-wider2 text-white/70 uppercase">
                {isReady && activeModel
                  ? `${activeModel.name} loaded`
                  : 'No model loaded'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isReady && activeModel ? (
                <>
                  <button
                    type="button"
                    onClick={onChangeModel}
                    title="Open the model picker"
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-brand-teal text-brand-navy border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
                  >
                    <RotateCcw size={12} />
                    Change Model
                  </button>
                  <button
                    type="button"
                    onClick={() => void unload()}
                    title="Unload the model and free memory"
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-white/10 text-white border border-white/20 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-white/20"
                  >
                    <Power size={12} />
                    Unload
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onChangeModel}
                  className="inline-flex items-center gap-1 bg-transparent border-0 p-0 font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-teal hover:text-white cursor-pointer"
                >
                  <ArrowLeft size={11} />
                  Back to AI Selection
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2 stat cards stacked — right 1/3 */}
        <div className="flex flex-col gap-4">
          {STATS.map((s) => {
            const Icon = s.Icon
            return (
              <div
                key={s.label}
                className="bg-white border border-brand-border rounded-md p-5 flex-1"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-md border ${accentIconWrap[s.accent]}`}
                      aria-hidden
                    >
                      <Icon size={14} />
                    </span>
                    <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0">
                      {s.label}
                    </p>
                  </div>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${accentDot[s.accent]}`}
                    aria-hidden
                  />
                </div>
                <p className="font-sans text-2xl font-light text-brand-navy m-0">
                  {s.value}
                </p>
                <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mt-1">
                  {s.hint}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── "Continue where you left off" ─────────────────────────── */}
      <div className="bg-white border border-brand-border rounded-md p-6 mb-6 max-w-4xl">
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

      {/* ── KPI tiles ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 max-w-4xl">
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