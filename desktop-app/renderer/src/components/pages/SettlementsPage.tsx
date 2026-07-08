import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import RouteStatusPill from '../RouteStatusPill'
import { useFlows } from '../../context/FlowContext'
import { useEmployees } from '../../context/EmployeeContext'
import type { Employee, RouteSummary } from '../../ai/types'

type Filter = 'all' | 'settled' | 'failed'
type LoadStatus = 'idle' | 'loading' | 'present' | 'error'

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

function chipClass(active: boolean): string {
  const base = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-mono text-[11px] font-bold uppercase tracking-wider2 transition-colors cursor-pointer'
  return active
    ? `${base} bg-blue-600 text-white border-blue-600`
    : `${base} bg-white text-gray-900 border-gray-200 hover:bg-gray-50`
}

export default function SettlementsPage() {
  const { flows, onProgress, onChange, listAllRoutes } = useFlows()
  const { employees } = useEmployees()

  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
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
      setError(e instanceof Error ? e.message : String(e))
      setLoadStatus('error')
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
    if (filter === 'settled') list = list.filter((r) => r.status === 'settled')
    else if (filter === 'failed') list = list.filter((r) => r.status === 'failed')

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
  }, [terminalRoutes, filter, search, employeeById, flowNameById])

  return (
    <div>
      <div className="mb-6">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Settlements</h1>
      </div>

      {/* Filter chips + search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFilter('all')} className={chipClass(filter === 'all')}>
            <span>All</span><span className="opacity-80">{counts.all}</span>
          </button>
          <button type="button" onClick={() => setFilter('settled')} className={chipClass(filter === 'settled')}>
            <span>Settled</span><span className="opacity-80">{counts.settled}</span>
          </button>
          <button type="button" onClick={() => setFilter('failed')} className={chipClass(filter === 'failed')}>
            <span>Failed</span><span className="opacity-80">{counts.failed}</span>
          </button>
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name…" className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 font-sans text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="grid gap-4 py-3 px-4 border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: '1.1fr 1.1fr 1.4fr 1fr 1fr 1fr 1fr auto 1.4fr' }}>
          <span className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold">Time</span>
          <span className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold">Flow</span>
          <span className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold">Recipient</span>
          <span className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold">Gross</span>
          <span className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold">Withholding</span>
          <span className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold">Tax</span>
          <span className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold">SS</span>
          <span className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold">Status</span>
          <span className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold">Result</span>
        </div>

        {error ? (
          <div className="py-8 px-4 text-center font-sans text-sm text-red-500">{error}</div>
        ) : loadStatus === 'loading' && routes.length === 0 ? (
          <div className="py-12 text-center font-sans text-sm text-gray-400">Loading…</div>
        ) : terminalRoutes.length === 0 ? (
          <div className="py-12 text-center font-sans text-sm text-gray-400">No settlements yet. Settled and failed routes will appear here as you run flows.</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center font-sans text-sm text-gray-400">No {filter === 'settled' ? 'settled' : 'failed'} settlements.</div>
        ) : (
          <div>
            {visible.map((r) => {
              const employee = employeeById.get(r.employeeId)
              const flowName = flowNameById.get(r.flowId) ?? '—'
              const time = formatTime(r.completedAt ?? r.createdAt)
              const shortHash = truncateTxHash(r.txHash)
              const isFailed = r.status === 'failed'
              return (
                <div key={r.id} className="grid gap-4 py-3 px-4 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors items-start" style={{ gridTemplateColumns: '1.1fr 1.1fr 1.4fr 1fr 1fr 1fr 1fr auto 1.4fr' }}>
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
                </div>
              )
            })}
            <div className="py-3 px-4 font-sans text-[11px] text-gray-400">{visible.length} {visible.length === 1 ? 'settlement' : 'settlements'}</div>
          </div>
        )}
      </div>
    </div>
  )
}
