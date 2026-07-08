// SettlementHistoryDrawer — shows settlement history for a specific employee.

import { useEffect, useMemo, useState } from 'react'
import Drawer from '../Drawer'
import RouteStatusPill from '../RouteStatusPill'
import { useFlows } from '../../context/FlowContext'
import type { Employee, RouteSummary } from '../../ai/types'

interface SettlementHistoryDrawerProps {
  open: boolean
  onClose: () => void
  employee: Employee | null
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}

function truncateTxHash(hash: string | undefined): string {
  if (!hash) return '—'
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash
}

export function SettlementHistoryDrawer({ open, onClose, employee }: SettlementHistoryDrawerProps) {
  const { flows, listAllRoutes } = useFlows()
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !employee) { setRoutes([]); return }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const all = await listAllRoutes()
        if (!cancelled) setRoutes(all.filter((r) => r.employeeId === employee.id))
      } catch (e) {
        console.error('[SettlementHistoryDrawer] load failed:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, employee, listAllRoutes])

  const flowNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of flows) map.set(f.id, f.name)
    return map
  }, [flows])

  const stats = useMemo(() => {
    let settled = 0; let failed = 0; let totalGross = 0
    for (const r of routes) {
      if (r.status === 'settled') settled++
      else if (r.status === 'failed') failed++
      totalGross += parseFloat(r.grossPay) || 0
    }
    return { settled, failed, total: routes.length, totalGross }
  }, [routes])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Settlement History"
      subtitle={employee?.displayName ?? 'Employee'}
    >
      <div className="space-y-4">
        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-center">
            <div className="font-mono text-lg font-bold text-gray-900">{stats.total}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400">Total</div>
          </div>
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-center">
            <div className="font-mono text-lg font-bold text-green-700">{stats.settled}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider2 text-green-600">Settled</div>
          </div>
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center">
            <div className="font-mono text-lg font-bold text-red-600">{stats.failed}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider2 text-red-500">Failed</div>
          </div>
        </div>

        {/* Routes list */}
        {loading ? (
          <div className="py-8 text-center font-sans text-sm text-gray-400">Loading…</div>
        ) : routes.length === 0 ? (
          <div className="py-8 text-center font-sans text-sm text-gray-400">No settlement history yet.</div>
        ) : (
          <div className="space-y-2">
            {routes.map((r) => {
              const flowName = flowNameById.get(r.flowId) ?? '—'
              const isFailed = r.status === 'failed'
              return (
                <div key={r.id} className="rounded-md border border-gray-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-sans text-sm font-medium text-gray-900 truncate">{flowName}</div>
                      <div className="font-mono text-[10px] text-gray-400">{formatTime(r.completedAt ?? r.createdAt)}</div>
                    </div>
                    <RouteStatusPill status={r.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-400">Gross</span>
                      <div className="font-mono text-gray-900">{r.grossPay} {r.payCurrency}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Withholding</span>
                      <div className="font-mono" style={{ color: r.withholdingAmount ? '#b45309' : '#999' }}>{r.withholdingAmount || '—'}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Net</span>
                      <div className="font-mono text-gray-900">{r.netPay || '—'}</div>
                    </div>
                  </div>
                  {isFailed && r.error && (
                    <div className="mt-2 rounded bg-red-50 border border-red-200 px-2 py-1">
                      <span className="font-mono text-[10px] text-red-600">{r.error}</span>
                    </div>
                  )}
                  {r.txHash && (
                    <div className="mt-2">
                      <span className="font-mono text-[10px] text-gray-400">Tx: </span>
                      <span className="font-mono text-[10px] text-blue-600" title={r.txHash}>{truncateTxHash(r.txHash)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Drawer>
  )
}

export default SettlementHistoryDrawer
