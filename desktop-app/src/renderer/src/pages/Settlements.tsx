import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import RouteStatusPill from '../components/RouteStatusPill'
import { useFlows } from '../context/FlowContext'
import { useEmployees } from '../context/EmployeeContext'
import type { Employee, RouteSummary } from '../../../preload/index.d'

/**
 * Cross-flow Settlement History.
 *
 * Powers `/settlements` (route + sidebar entry live in `App.tsx`).
 * Surfaces every settled + failed route from every flow as a single
 * ledger — useful when a user wants to audit Canton activity across
 * all their flows without opening each flow's `RoutesPanel` one by
 * one.
 *
 * Data:
 *   - `routeStore.listAll()` (main) — walks every
 *     `<userData>/flows/<id>/routes/*.json` and returns a flat list
 *     sorted by `completedAt` desc (createdAt desc fallback).
 *   - Push subscriptions: `flows:onProgress` (any route status
 *     transition → reload) + `flows:onChange` (flow added/removed
 *     → reload). No polling.
 *
 * Interaction:
 *   - Click any row → navigate to `/flows/:id` so the user lands on
 *     the canonical per-flow detail page where the live `RoutesPanel`
 *     already lives.
 *   - Filter chips (All / Settled / Failed) — counts are taken from
 *     the unfiltered list so they don't shift as the user clicks.
 *
 * v.1 row scope: settled + failed only. Live in-flight routes
 * (computing / sending / etc.) are intentionally excluded so the
 * ledger reads as a finished-history surface, not a status board.
 */

type Filter = 'all' | 'settled' | 'failed'
type LoadStatus = 'idle' | 'loading' | 'present' | 'error'

const TERMINAL_STATUSES = new Set<RouteSummary['status']>(['settled', 'failed'])

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function truncateTxHash(hash: string | undefined): string {
  if (!hash) return '—'
  return hash.length > 10 ? `${hash.slice(0, 10)}…` : hash
}

function chipClass(active: boolean): string {
  // Mirrors the Sidebar active-state classes for visual consistency.
  const base =
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-mono text-[11px] font-bold uppercase tracking-wider2 transition-colors'
  return active
    ? `${base} bg-brand-blue text-white border-brand-blue`
    : `${base} bg-white text-brand-navy border-brand-border hover:bg-brand-light`
}

export default function Settlements() {
  const { flows, onProgress, onChange, listAllRoutes } = useFlows()
  const { employees } = useEmployees()

  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoadStatus((prev) => (prev === 'idle' ? 'loading' : prev))
    try {
      const list = await listAllRoutes()
      setRoutes(list)
      setLoadStatus('present')
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setLoadStatus('error')
    }
  }, [listAllRoutes])

  // Initial load.
  useEffect(() => {
    void reload()
  }, [reload])

  // Live updates — any route status transition or flow-list change
  // re-queries the aggregator. Cheap (single directory walk) and
  // keeps the page in sync without polling.
  useEffect(() => {
    const offProgress = onProgress(() => {
      void reload()
    })
    const offChange = onChange(() => {
      void reload()
    })
    return () => {
      offProgress?.()
      offChange?.()
    }
  }, [onProgress, onChange, reload])

  // Indexes — built once per render; lookups are O(1) in the row map.
  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>()
    for (const e of employees) map.set(e.id, e)
    return map
  }, [employees])

  const flowNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of flows) map.set(f.id, f.name)
    return map
  }, [flows])

  // Only settled + failed routes are ledger-worthy — exclude the
  // in-flight statuses so the page reads as a finished-history view.
  const terminalRoutes = useMemo(
    () => routes.filter((r) => TERMINAL_STATUSES.has(r.status)),
    [routes],
  )

  // Counts for chips — computed from the unfiltered terminal list so
  // the totals stay stable as the user toggles filters.
  const counts = useMemo(() => {
    let settled = 0
    let failed = 0
    for (const r of terminalRoutes) {
      if (r.status === 'settled') settled++
      else if (r.status === 'failed') failed++
    }
    return { all: terminalRoutes.length, settled, failed }
  }, [terminalRoutes])

  const visible = useMemo(() => {
    if (filter === 'all') return terminalRoutes
    if (filter === 'settled') return terminalRoutes.filter((r) => r.status === 'settled')
    return terminalRoutes.filter((r) => r.status === 'failed')
  }, [terminalRoutes, filter])

  return (
    <div>
      <PageHeader
        label="Canton Network"
        title="Settlements"
        subtitle="All payroll settlements on the Canton network. Click a row to open the underlying flow."
      />

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={chipClass(filter === 'all')}
        >
          <span>All</span>
          <span className="opacity-80">{counts.all}</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('settled')}
          className={chipClass(filter === 'settled')}
        >
          <span>Settled</span>
          <span className="opacity-80">{counts.settled}</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('failed')}
          className={chipClass(filter === 'failed')}
        >
          <span>Failed</span>
          <span className="opacity-80">{counts.failed}</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-brand-border rounded-md overflow-hidden">
        <div
          className="grid gap-4 py-3 px-4 border-b border-brand-border bg-brand-light"
          style={{ gridTemplateColumns: '1.1fr 1.1fr 1.4fr 1fr 1fr auto 1.4fr' }}
        >
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Time
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Flow
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Recipient
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Amount
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            CC
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Status
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Result
          </span>
        </div>

        {error ? (
          <div className="py-8 px-4 text-center font-sans text-sm text-brand-red">
            {error}
          </div>
        ) : loadStatus === 'loading' && routes.length === 0 ? (
          <div className="py-12 text-center font-sans text-sm text-brand-muted">Loading…</div>
        ) : terminalRoutes.length === 0 ? (
          <div className="py-12 text-center font-sans text-sm text-brand-muted">
            No settlements yet. Settled and failed routes will appear here as you run flows.
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center font-sans text-sm text-brand-muted">
            No {filter === 'settled' ? 'settled' : 'failed'} settlements.
          </div>
        ) : (
          <div>
            {visible.map((r) => {
              const employee = employeeById.get(r.employeeId)
              const flowName = flowNameById.get(r.flowId) ?? '—'
              const time = formatTime(r.completedAt ?? r.createdAt)
              const shortHash = truncateTxHash(r.txHash)
              const isFailed = r.status === 'failed'
              return (
                <Link
                  key={r.id}
                  to={`/flows/${r.flowId}`}
                  className="grid gap-4 py-3 px-4 border-b border-brand-border last:border-b-0 hover:bg-brand-light transition-colors items-start"
                  style={{ gridTemplateColumns: '1.1fr 1.1fr 1.4fr 1fr 1fr auto 1.4fr' }}
                >
                  <span className="font-mono text-[11px] text-brand-navy">{time}</span>
                  <span className="font-sans text-sm text-brand-navy truncate" title={flowName}>
                    {flowName}
                  </span>
                  <div className="min-w-0">
                    <div className="font-sans text-sm text-brand-navy truncate">
                      {employee?.displayName ?? '—'}
                    </div>
                    <div
                      className="font-mono text-[10px] text-brand-muted truncate"
                      title={r.payeePlacementId}
                    >
                      {r.payeePlacementId}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[12px] text-brand-navy">{r.grossPay}</div>
                    <div className="font-mono text-[10px] text-brand-muted uppercase">{r.payCurrency}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[12px] text-brand-navy font-semibold">
                      {r.amountCC}
                    </div>
                    <div className="font-mono text-[10px] text-brand-muted">CC</div>
                  </div>
                  <div>
                    <RouteStatusPill status={r.status} />
                  </div>
                  <div className="min-w-0">
                    {isFailed && r.error ? (
                      <span
                        className="font-sans text-[11px] text-brand-red block truncate"
                        title={r.error}
                      >
                        {r.error}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-brand-blue">
                        {shortHash}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
            <div className="py-3 px-4 font-sans text-[11px] text-brand-muted">
              {visible.length} {visible.length === 1 ? 'settlement' : 'settlements'} · click a row
              to open the flow
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
