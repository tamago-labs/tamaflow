// PayslipsPage — employee table + per-route send via GeneratePayslipDrawer.
//
// Flow:
//   1. Select employee → expand to see settlements
//   2. Click "Send" on a route → opens GeneratePayslipDrawer
//   3. Drawer handles template selection, HTML preview, send to drive + P2P + on-ledger

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Settings } from 'lucide-react'
import PayslipTemplateModal from '../payslips/PayslipTemplateModal'
import { useFlows } from '../../context/FlowContext'
import { useEmployees } from '../../context/EmployeeContext'
import type { RouteSummary } from '../../ai/types'

export function PayslipsPage() {
  const { onProgress, onChange, listAllRoutes } = useFlows()
  const { employees: localEmployees } = useEmployees()

  const [allRoutes, setAllRoutes] = useState<RouteSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const list = await listAllRoutes()
        if (!cancelled) setAllRoutes(list)
      } catch (e) {
        console.error('[PayslipsPage] reload failed:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [listAllRoutes])

  useEffect(() => {
    const offProgress = onProgress(() => { void reload() })
    const offChange = onChange(() => { void reload() })
    return () => { offProgress?.(); offChange?.() }
  }, [onProgress, onChange])

  const reload = useCallback(async () => {
    try {
      const list = await listAllRoutes()
      setAllRoutes(list)
    } catch (e) {
      console.error('[PayslipsPage] reload failed:', e)
    }
  }, [listAllRoutes])

  const routesByEmployee = useMemo(() => {
    const map = new Map<string, RouteSummary[]>()
    for (const r of allRoutes) {
      if (r.status !== 'settled') continue
      const existing = map.get(r.employeeId) || []
      existing.push(r)
      map.set(r.employeeId, existing)
    }
    return map
  }, [allRoutes])

  const employeesWithRoutes = useMemo(() => {
    return localEmployees.filter((e) => routesByEmployee.has(e.id))
  }, [localEmployees, routesByEmployee])

  const expandedRoutes = useMemo(() => {
    if (!expandedEmployee) return []
    return (routesByEmployee.get(expandedEmployee) || [])
      .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime())
  }, [expandedEmployee, routesByEmployee])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Payslips</h1>
        <button
          type="button"
          onClick={() => setTemplateModalOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider2 text-gray-700 hover:bg-gray-50 transition"
        >
          <Settings size={12} />
          Templates
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        {employeesWithRoutes.length > 0 && (
          <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="w-6" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Employee</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Role</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Settled</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Total Gross</span>
          </div>
        )}

        {!loading && employeesWithRoutes.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400">
              <FileText size={20} />
            </div>
            <p className="m-0 font-sans text-sm font-medium text-gray-900">No settled payments yet</p>
            <p className="m-0 max-w-sm font-sans text-xs text-gray-400">Run a payroll flow first to generate payslips from settlement data.</p>
          </div>
        )}

        {employeesWithRoutes.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {employeesWithRoutes.map((emp) => {
              const routes = routesByEmployee.get(emp.id) || []
              const totalGross = routes.reduce((sum, r) => sum + (parseFloat(r.grossPay) || 0), 0)
              const isExpanded = expandedEmployee === emp.id

              return (
                <li key={emp.id}>
                  <div
                    className={`grid grid-cols-[auto_2fr_1fr_1fr_1fr] items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedEmployee(isExpanded ? null : emp.id)}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="min-w-0">
                      <p className="m-0 truncate font-sans text-sm font-medium text-gray-900">{emp.displayName}</p>
                      <p className="m-0 truncate font-mono text-[10px] text-gray-400">{emp.email || emp.id}</p>
                    </div>
                    <span className="font-mono text-xs text-gray-700">{emp.role || '—'}</span>
                    <span className="font-mono text-xs text-gray-700">{routes.length}</span>
                    <span className="font-mono text-xs font-medium text-gray-900">
                      {emp.payCurrency || 'USD'} {totalGross.toLocaleString()}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-blue-100 bg-blue-50/50 px-4 py-4">
                      <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">
                        Settlements ({expandedRoutes.length})
                      </div>
                      <div className="max-h-60 space-y-1 overflow-y-auto">
                        {expandedRoutes.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50"
                          >
                            <div className="flex-1">
                              <span className="font-sans text-xs text-gray-900">
                                {new Date(r.completedAt ?? r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              <span className="ml-2 font-mono text-[10px] text-gray-400">
                                {r.payCurrency} {(parseFloat(r.grossPay) || 0).toLocaleString()}
                              </span>
                            </div>
                            {r.payslipSentCount > 0 && (
                              <span className="font-mono text-[10px] text-teal-600 mr-3">
                                {r.payslipSentCount} sent
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <PayslipTemplateModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} />
    </div>
  )
}
