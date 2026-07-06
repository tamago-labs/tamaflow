import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  ArrowRight,
  ArrowDownToLine,
  CheckCircle2,
  Circle,
  ListTodo,
  Plus,
  Power,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useAI } from '../context/AIContext'
import { useCompany } from '../context/CompanyContext'
import { useEmployees } from '../context/EmployeeContext'
import { useFlows } from '../context/FlowContext'
import { usePrice } from '../context/PriceContext'
import { useWallet } from '../context/WalletContext'
import RouteStatusPill from '../components/RouteStatusPill'
import type { Employee, RouteSummary } from '../../../preload/index.d'

/**
 * Dashboard — employer overview (v.1).
 *
 * Workflow-First layout (v.4 — hero is a single-column bullet list):
 *
 *   1. Hero card       — "Get set up / All set up" + 3-step bullet
 *                        list (Add employees → Build a flow → Run a
 *                        settlement). Single-column rows with status
 *                        markers on the left; only entries that can be
 *                        actually incomplete appear here.
 *   2. 4-tile KPI strip — Wallet CC, Active flows, Settled 30d, Pending offers
 *   3. Recent settlements — last 5 settled routes, click → /flows/:id
 *   4. AI footer chip   — model status + "no functional features yet — stay tuned"
 *
 * All numbers come from real renderer state (no mocks). The AI is shown
 * as loaded but framed as not-yet-functional so users don't expect
 * features that aren't wired up yet. Settlements row click drops the
 * user into the per-flow detail page where the live RoutesPanel lives.
 */

interface OutletCtx {
  onChangeModel: () => void
}

const RECENT_LIMIT = 5
const THIRTY_D_MS = 30 * 24 * 60 * 60 * 1000

/** Sum the on-ledger CC amount across every CC holding (decimal strings). */
function sumCcHoldings(amounts: Array<{ symbol: string; amount: string }>): number | null {
  let total = 0
  for (const h of amounts) {
    if (h.symbol !== 'CC') continue
    const n = parseFloat(h.amount)
    if (!Number.isFinite(n)) continue
    total += n
  }
  return total
}

/** US-locale string formatter that trims trailing zeros after the decimal point. */
function formatDisplay(value: number, maxFractionDigits = 4): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits })
}

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value >= 100) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
  return `$${value.toFixed(3)}`
}

/** Compact "5m / 2h / 3d" relative timestamp, relative to now. */
function formatRelative(iso: string | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const ms = t - Date.now()
  const absMs = Math.abs(ms)
  const future = ms > 0
  const minutes = Math.round(absMs / 60_000)
  if (minutes < 1) return future ? 'imminent' : 'just now'
  if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`
  const months = Math.round(days / 30)
  return future ? `in ${months}mo` : `${months}mo ago`
}

export default function Dashboard() {
  const { profile: companyProfile } = useCompany()
  const { employees } = useEmployees()
  const { holdings, pendingTransfers, holdingsHasLoaded, pendingTransfersHasLoaded } = useWallet()
  const { flows, listAllRoutes } = useFlows()
  const { isReady, activeModel, unload } = useAI()
  const { convert } = usePrice()
  const { onChangeModel } = useOutletContext<OutletCtx>()

  // Recent settlements — last 5 settled routes across all flows. Pulled
  // straight from `routeStore.listAll()` (same source as the
  // SettlementHistory page) so the dashboard surfaces real activity
  // the moment a flow transitions to settled.
  const [recentRoutes, setRecentRoutes] = useState<RouteSummary[]>([])

  const reloadRecent = useCallback(async () => {
    try {
      const list = await listAllRoutes()
      // Sorted by completedAt desc by routeStore.listAll(); for the
      // dashboard we want only settled ones, latest 5.
      setRecentRoutes(
        list.filter((r) => r.status === 'settled' || r.status === 'failed').slice(0, RECENT_LIMIT),
      )
    } catch (e) {
      console.error('[Dashboard] reloadRecent failed:', e)
    }
  }, [listAllRoutes])

  useEffect(() => {
    void reloadRecent()
  }, [reloadRecent])

  // Live updates — when the worker transitions any route, refresh.
  const { onProgress } = useFlows()
  useEffect(() => {
    const off = onProgress(() => void reloadRecent())
    return () => off?.()
  }, [onProgress, reloadRecent])

  // ─── Derived KPIs ──────────────────────────────────────────────────
  // Ordering matters here: every block below depends on something
  // earlier in the chain, and React hooks (useMemo) evaluate their
  // dep array at the call site, so TDZ errors would fire if we
  // referenced something further down. The chain is:
  //   recentRoutes → settled30dCount
  //   …plus other leaves (employees, flows, holdings) that everything
  //   below just reads.

  const settled30dCount = useMemo(() => {
    const cutoff = Date.now() - THIRTY_D_MS
    return recentRoutes.filter((r) => {
      if (r.status !== 'settled') return false
      const t = r.completedAt ? Date.parse(r.completedAt) : NaN
      return Number.isFinite(t) && t >= cutoff
    }).length
  }, [recentRoutes])

  const totalCc = useMemo(() => sumCcHoldings(holdings), [holdings])
  const walletUsd = useMemo(() => {
    if (totalCc === null) return null
    const v = convert(totalCc, 'CC', 'USD')
    return v !== null && Number.isFinite(v) ? v : null
  }, [totalCc, convert])

  const employeeCount = employees.length
  const activeFlowCount = useMemo(
    () => flows.filter((f) => f.status === 'active').length,
    [flows],
  )
  const pendingOfferCount = pendingTransfers.length

  const showWalletHint = holdings.length === 0 && !!companyProfile

  // Onboarding tracker — three steps the user can actually work through
  // after the CompanyGate has been passed. The hero renders these as a
  // single-column bullet list (see <OnboardingBulletRow/>), so done
  // steps are faded status rows and pending rows are clickable. The
  // first non-done row is the "next" step and gets a blue marker.
  const onboardingSteps = useMemo(
    () => [
      {
        key: 'employees',
        title: 'Add employees',
        detail:
          employees.length === 0
            ? 'None added yet'
            : employees.length === 1
            ? '1 employee'
            : `${employees.length} employees`,
        done: employees.length > 0,
        to: '/employees',
      },
      {
        key: 'flow',
        title: 'Build a flow',
        detail:
          flows.length === 0
            ? 'None built yet'
            : flows.length === 1
            ? '1 flow'
            : `${flows.length} flows`,
        done: flows.length > 0,
        to: '/flows/new',
      },
      {
        key: 'settle',
        title: 'Run a settlement',
        detail:
          settled30dCount === 0
            ? 'None settled yet'
            : settled30dCount === 1
            ? '1 settled (30d)'
            : `${settled30dCount} settled (30d)`,
        done: settled30dCount > 0,
        to: '/settlements',
      },
    ],
    [employees.length, flows.length, settled30dCount],
  )
  const allOnboardingDone = onboardingSteps.every((s) => s.done)
  const nextStepIdx = onboardingSteps.findIndex((s) => !s.done)

  // Latest flow — newest by updatedAt desc.
  const latestFlow = useMemo(() => {
    if (flows.length === 0) return null
    const sorted = [...flows].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    return sorted[0]
  }, [flows])

  // Indexes for the settlements rows.
  const flowNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of flows) m.set(f.id, f.name)
    return m
  }, [flows])

  const employeeById = useMemo(() => {
    const m = new Map<string, Employee>()
    for (const e of employees) m.set(e.id, e)
    return m
  }, [employees])

  return (
    <div>
      {/* ── Hero card — onboarding tracker ─────────────────────────── */}
      <div className="bg-white border border-brand-border rounded-md p-6 lg:p-8 mb-4">
        <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0 mb-3">
              Employer Overview
            </p>
            <h1 className="font-sans text-2xl md:text-3xl font-light text-brand-navy leading-tight m-0">
              {allOnboardingDone ? 'All set up' : 'Get set up'}
            </h1>
            <p className="font-sans text-sm text-brand-muted mt-1 mb-0 leading-relaxed">
              {allOnboardingDone
                ? 'Tamaflow is ready — payroll runs end-to-end on Canton.'
                : 'Settle payroll on Canton in three steps. Complete each to unlock the next.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start">
            {latestFlow ? (
              <Link
                to={`/flows/${latestFlow.id}`}
                className="inline-flex items-center gap-1.5 py-2 px-4 bg-white border border-brand-border text-brand-navy rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase no-underline hover:bg-brand-light"
              >
                Open Latest
                <ArrowRight size={12} />
              </Link>
            ) : null}
            <Link
              to="/flows/new"
              className="inline-flex items-center gap-1.5 py-2 px-4 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase no-underline hover:opacity-90"
            >
              <Plus size={12} />
              New Flow
            </Link>
          </div>
        </div>

        <ul className="divide-y divide-brand-border border border-brand-border rounded-md overflow-hidden bg-white">
          {onboardingSteps.map((s, i) => {
            const state: 'done' | 'next' | 'pending' = s.done
              ? 'done'
              : i === nextStepIdx
                ? 'next'
                : 'pending'
            return <OnboardingBulletRow key={s.key} step={s} state={state} />
          })}
        </ul>
      </div>

      {/* ── 4-tile KPI strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiTile
          label="Wallet"
          value={holdingsHasLoaded ? `${formatDisplay(totalCc ?? 0)} CC` : '—'}
          hint={
            !holdingsHasLoaded
              ? 'Loading…'
              : (totalCc ?? 0) > 0
              ? formatUsd(walletUsd)
              : showWalletHint
              ? 'Set up in Assets'
              : 'On Canton'
          }
          icon={Wallet}
          accent={holdingsHasLoaded && (totalCc ?? 0) > 0 ? 'blue' : 'muted'}
        />
        <KpiTile
          label="Active Flows"
          value={String(activeFlowCount)}
          hint={
            activeFlowCount === 0
              ? 'None running'
              : `${activeFlowCount} ${activeFlowCount === 1 ? 'flow' : 'flows'} settling`
          }
          icon={ListTodo}
          accent="muted"
        />
        <KpiTile
          label="Settled (30d)"
          value={String(settled30dCount)}
          hint="On Canton"
          icon={CheckCircle2}
          accent="ok"
        />
        <KpiTile
          label="Pending Offers"
          value={pendingTransfersHasLoaded ? String(pendingOfferCount) : '—'}
          hint={pendingTransfersHasLoaded ? 'Awaiting accept' : 'Loading…'}
          icon={ArrowDownToLine}
          accent={pendingTransfersHasLoaded && pendingOfferCount > 0 ? 'blue' : 'muted'}
        />
      </div>

      {/* ── Recent settlements ──────────────────────────────────────── */}
      <div className="bg-white border border-brand-border rounded-md overflow-hidden mb-4">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-brand-border bg-brand-light">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0">
            Recent Settlements
          </p>
          <Link
            to="/settlements"
            className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider2 text-brand-blue font-semibold uppercase no-underline hover:underline"
          >
            View all
            <Receipt size={11} />
          </Link>
        </div>
        {recentRoutes.length === 0 ? (
          <div className="py-10 text-center font-sans text-sm text-brand-muted">
            No settled routes yet — start a flow to see payments here.
          </div>
        ) : (
          <ul className="divide-y divide-brand-border">
            {recentRoutes.map((r) => {
              const flowName = flowNameById.get(r.flowId) ?? '—'
              const employee = employeeById.get(r.employeeId)
              const recipient = employee?.displayName ?? '—'
              const time = formatRelative(r.completedAt ?? r.createdAt)
              return (
                <li key={r.id}>
                  <Link
                    to={`/flows/${r.flowId}`}
                    className="grid gap-4 py-3 px-5 items-center hover:bg-brand-light/40 transition-colors no-underline"
                    style={{ gridTemplateColumns: '0.8fr 1.4fr 1.4fr 1fr auto' }}
                  >
                    <span className="font-mono text-[11px] text-brand-muted">{time}</span>
                    <span className="font-sans text-sm text-brand-navy truncate" title={flowName}>
                      {flowName}
                    </span>
                    <span className="font-sans text-sm text-brand-navy truncate">{recipient}</span>
                    <span className="text-right font-mono text-sm text-brand-navy">
                      {formatDisplay(parseFloat(r.amountCC))}{' '}
                      <span className="text-brand-muted text-xs">CC</span>
                    </span>
                    <RouteStatusPill status={r.status} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── AI status footer chip ───────────────────────────────────── */}
      <div className="bg-white border border-brand-border rounded-md p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: isReady ? '#3EC4C0' : '#9999bb' }}
            aria-hidden
          />
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0">
            AI · {isReady && activeModel ? `${activeModel.name} loaded` : 'No model loaded'}
          </p>
          <p className="font-sans text-xs text-brand-muted m-0 truncate">
            No functional features yet — stay tuned.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isReady && activeModel ? (
            <button
              type="button"
              onClick={() => void unload()}
              title="Unload the model and free memory"
              className="inline-flex items-center gap-1.5 py-1 px-2.5 bg-white border border-brand-border text-brand-navy rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
            >
              <Power size={11} />
              Unload
            </button>
          ) : (
            <button
              type="button"
              onClick={onChangeModel}
              className="inline-flex items-center gap-1.5 py-1 px-2.5 bg-white border border-brand-border text-brand-navy rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
            >
              Select Model
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── KPI tile ────────────────────────────────────────────────────────

const kpiAccentIconWrap: Record<'ok' | 'blue' | 'muted', string> = {
  ok: 'bg-[#e6f7ee] text-brand-ok border-brand-ok',
  blue: 'bg-[#eaeefc] text-brand-blue border-brand-blue',
  muted: 'bg-brand-light text-brand-muted border-brand-border',
}

const kpiAccentDot: Record<'ok' | 'blue' | 'muted', string> = {
  ok: 'bg-brand-ok',
  blue: 'bg-brand-blue',
  muted: 'bg-brand-muted',
}

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  hint: string
  icon: typeof TrendingUp
  accent: 'ok' | 'blue' | 'muted'
}) {
  return (
    <div className="bg-white border border-brand-border rounded-md p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`flex items-center justify-center w-7 h-7 rounded-md border ${kpiAccentIconWrap[accent]}`}
            aria-hidden
          >
            <Icon size={14} />
          </span>
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0 truncate">
            {label}
          </p>
        </div>
        <span className={`w-1.5 h-1.5 rounded-full ${kpiAccentDot[accent]}`} aria-hidden />
      </div>
      <p className="font-sans text-2xl font-light text-brand-navy m-0 truncate">{value}</p>
      <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mt-1 truncate">
        {hint}
      </p>
    </div>
  )
}

// ─── Onboarding bullet row (hero card) ────────────────────────────────

interface OnboardingStepData {
  key: string
  title: string
  detail: string
  done: boolean
  to: string
}

/**
 * One row of the hero's onboarding bullet list.
 *
 * Layout (left → right):
 *   status marker · title · spacer · detail · trailing arrow
 *
 * Three visual states:
 *   • done     — green check, the whole row fades (opacity-60) so the
 *                user sees it as completed status; no link, no trailing
 *                arrow (the row "stops" visually)
 *   • next     — solid blue arrow marker, bold title, faint blue tint
 *                background; the row is the primary CTA right now
 *   • pending  — outlined circle marker, muted text, click target
 *                (lets the user skip ahead if they want)
 */
function OnboardingBulletRow({
  step,
  state,
}: {
  step: OnboardingStepData
  state: 'done' | 'next' | 'pending'
}) {
  const Icon = state === 'done' ? CheckCircle2 : state === 'next' ? ArrowRight : Circle
  const rowClass =
    state === 'done'
      ? 'opacity-60'
      : state === 'next'
        ? 'bg-[#eaeefc]/60'
        : 'hover:bg-brand-light transition-colors'
  const iconClass =
    state === 'done'
      ? 'text-brand-ok'
      : state === 'next'
        ? 'text-brand-blue'
        : 'text-brand-muted'
  const titleClass = state === 'pending' ? 'text-brand-muted' : 'text-brand-navy'
  const titleWeight = state === 'next' ? 'font-semibold' : 'font-medium'

  const inner = (
    <div className={`flex items-center gap-3 px-4 py-3 ${rowClass}`}>
      <Icon
        size={state === 'next' ? 18 : 16}
        className={`${iconClass} flex-shrink-0`}
        strokeWidth={state === 'pending' ? 2 : 2.5}
      />
      <span
        className={`font-sans text-sm ${titleWeight} ${titleClass} flex-1 min-w-0 truncate`}
      >
        {step.title}
      </span>
      <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold whitespace-nowrap">
        {step.detail}
      </span>
      {state !== 'done' && (
        <ArrowRight size={12} className="text-brand-muted flex-shrink-0" />
      )}
    </div>
  )

  // Done rows are pure status — no link, no hover affordance.
  return state === 'done' ? (
    <li>{inner}</li>
  ) : (
    <li>
      <Link to={step.to} className="block no-underline">
        {inner}
      </Link>
    </li>
  )
}
