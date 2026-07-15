import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import RouteStatusPill from '../RouteStatusPill'
import { useFlows } from '../../context/FlowContext'
import { useEmployees } from '../../context/EmployeeContext'
import type { Employee, RouteSummary } from '../../ai/types'

type StatusFilter = 'all' | 'settled' | 'failed'
type DateFilter = 'all' | 'today' | '7days' | '30days'

const TERMINAL_STATUSES = new Set<RouteSummary['status']>(['settled', 'failed'])

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}

function truncateTxHash(hash: string | undefined): string {
  if (!hash) return '—'
  return hash.length > 10 ? `${hash.slice(0, 10)}…` : hash
}

function getDateCutoff(dateFilter: DateFilter): Date | null {
  const now = new Date()
  if (dateFilter === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start
  }
  if (dateFilter === '7days') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
  if (dateFilter === '30days') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
  return null
}

export default function SettlementsPage() {
  const { flows, onProgress, onChange, listAllRoutes } = useFlows()
  const { employees } = useEmployees()

  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [search, setSearch] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listAllRoutes()
      setRoutes(list)
    } catch (e) {
      console.error('[SettlementsPage] reload failed:', e)
    } finally {
      setLoading(false)
    }
  }, [listAllRoutes])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    const offProgress = onProgress(() => { void reload() })
    const offChange = onChange(() => { void reload() })
    return () => { offProgress?.(); offChange?.() }
  }, [onProgress, onChange, reload])

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

  const terminalRoutes = useMemo(() => routes.filter((r) => TERMINAL_STATUSES.has(r.status)), [routes])

  const counts = useMemo(() => {
    let settled = 0; let failed = 0
    for (const r of terminalRoutes) { if (r.status === 'settled') settled++; else if (r.status === 'failed') failed++ }
    return { all: terminalRoutes.length, settled, failed }
  }, [terminalRoutes])

  const visible = useMemo(() => {
    let list = terminalRoutes

    if (statusFilter === 'settled') list = list.filter((r) => r.status === 'settled')
    else if (statusFilter === 'failed') list = list.filter((r) => r.status === 'failed')

    const cutoff = getDateCutoff(dateFilter)
    if (cutoff) {
      const cutoffMs = cutoff.getTime()
      list = list.filter((r) => {
        const ts = new Date(r.completedAt ?? r.createdAt).getTime()
        return ts >= cutoffMs
      })
    }

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const employee = employeeById.get(r.employeeId)
        const flowName = flowNameById.get(r.flowId) ?? ''
        return (
          (employee?.displayName ?? '').toLowerCase().includes(q) ||
          flowName.toLowerCase().includes(q) ||
          r.payeePlacementId.toLowerCase().includes(q)
        )
      })
    }
    return list
  }, [terminalRoutes, statusFilter, dateFilter, search, employeeById, flowNameById])

  const hasAny = terminalRoutes.length > 0
  const hasMatches = visible.length > 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Settlements</h1>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name…"
              className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 font-sans text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border border-gray-200 bg-white px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider2 text-gray-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All statuses ({counts.all})</option>
            <option value="settled">Settled ({counts.settled})</option>
            <option value="failed">Failed ({counts.failed})</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="rounded-md border border-gray-200 bg-white px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider2 text-gray-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
          </select>
        </div>

        {/* Column header */}
        {hasAny && (
          <div className="grid gap-4 border-b border-gray-200 bg-white px-4 py-2.5" style={{ gridTemplateColumns: '1.1fr 1.1fr 1.4fr 1fr 1fr 1fr 1fr auto 1.4fr' }}>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Time</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Flow</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Recipient</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Gross</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Withholding</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Tax</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">SS</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Status</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Result</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasAny && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="m-0 font-sans text-sm font-medium text-gray-900">No settlements yet</p>
            <p className="m-0 max-w-sm font-sans text-xs text-gray-400">Settled and failed routes will appear here as you run flows.</p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 size={20} className="animate-spin text-gray-400" />
            <p className="m-0 font-sans text-sm text-gray-400">Loading settlements...</p>
          </div>
        )}

        {/* No matches under filter */}
        {hasAny && !hasMatches && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="m-0 font-sans text-sm text-gray-400">No settlements match these filters.</p>
            <button
              type="button"
              onClick={() => { setSearch(''); setStatusFilter('all'); setDateFilter('all') }}
              className="cursor-pointer border-0 bg-transparent font-mono text-[10px] uppercase tracking-wider2 text-blue-600 underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Rows */}
        {hasMatches && (
          <ul className="divide-y divide-gray-200">
            {visible.map((r) => {
              const employee = employeeById.get(r.employeeId)
              const flowName = flowNameById.get(r.flowId) ?? '—'
              const time = formatTime(r.completedAt ?? r.createdAt)
              const shortHash = truncateTxHash(r.txHash)
              const isFailed = r.status === 'failed'
              return (
                <li key={r.id} className="grid gap-4 py-3 px-4 transition-colors hover:bg-gray-50 items-start" style={{ gridTemplateColumns: '1.1fr 1.1fr 1.4fr 1fr 1fr 1fr 1fr auto 1.4fr' }}>
                  <span className="font-mono text-[11px] text-gray-900">{time}</span>
                  <span className="font-sans text-sm text-gray-900 truncate" title={flowName}>{flowName}</span>
                  <div className="min-w-0">
                    <div className="font-sans text-sm text-gray-900 truncate">{employee?.displayName ?? '—'}</div>
                    <div className="font-mono text-[10px] text-gray-400 truncate" title={r.payeePlacementId}>{r.payeePlacementId}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[12px] text-gray-900">{r.grossPay}</div>
                    <div className="font-mono text-[10px] text-gray-400 uppercase">{r.payCurrency}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[12px]" style={{ color: r.withholdingAmount ? '#b45309' : '#999' }}>{r.withholdingAmount || '—'}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[12px]" style={{ color: r.taxAmount ? '#b45309' : '#999' }}>{r.taxAmount || '—'}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[12px]" style={{ color: r.socialSecurityAmount ? '#b45309' : '#999' }}>{r.socialSecurityAmount || '—'}</div>
                  </div>
                  <div><RouteStatusPill status={r.status} /></div>
                  <div className="min-w-0">
                    {isFailed && r.error ? (
                      <span className="font-sans text-[11px] text-red-500 block truncate" title={r.error}>{r.error}</span>
                    ) : (
                      <span className="font-mono text-[11px] text-blue-600">{shortHash}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Footer count */}
        {hasMatches && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
            <span className="font-sans text-[11px] text-gray-400">{visible.length} {visible.length === 1 ? 'settlement' : 'settlements'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
