import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, ChevronDown, ChevronRight, Check, X, Loader2 } from 'lucide-react'
import { useContracts } from '../../context/ContractsContext'
import { useWallet } from '../../context/WalletContext'
import { bridge } from '../../lib/bridge'
import { AddEmployeeDrawer } from '../employee/AddEmployeeDrawer'

interface BlockInfo {
  blockStart: string
  blockEnd: string
  status: string
}

export function AttendancePage() {
  const { employees, fetchEmployees, loading } = useContracts()
  const { status } = useWallet()
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const partyId = status?.partyId

  useEffect(() => {
    if (partyId) {
      fetchEmployees(partyId)
    }
  }, [partyId, fetchEmployees])

  // Deduplicate: keep only the latest record per employee (highest offset)
  const latestByEmployee = useMemo(() => {
    const map = new Map<string, typeof employees[0]>()
    for (const emp of employees) {
      const existing = map.get(emp.employee)
      if (!existing || emp.offset > existing.offset) {
        map.set(emp.employee, emp)
      }
    }
    return Array.from(map.values())
  }, [employees])

  const filtered = latestByEmployee.filter((e) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      e.displayName.toLowerCase().includes(q) ||
      e.companyName.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q)
    )
  })

  const hasAny = latestByEmployee.length > 0

  const handleToggle = (employee: string) => {
    setExpandedEmployee((prev) => (prev === employee ? null : employee))
  }

  const handleConfirm = useCallback(async (contractId: string, blockId: string) => {
    setActionLoading(blockId)
    try {
      await bridge.contracts.exerciseBlockChoice(contractId, 'ConfirmBlock', blockId)
      if (partyId) await fetchEmployees(partyId)
    } catch (e) {
      console.error('[Attendance] ConfirmBlock failed:', e)
    } finally {
      setActionLoading(null)
    }
  }, [partyId, fetchEmployees])

  const handleReject = useCallback(async (contractId: string, blockId: string) => {
    setActionLoading(blockId)
    try {
      await bridge.contracts.exerciseBlockChoice(contractId, 'RejectBlock', blockId)
      if (partyId) await fetchEmployees(partyId)
    } catch (e) {
      console.error('[Attendance] RejectBlock failed:', e)
    } finally {
      setActionLoading(null)
    }
  }, [partyId, fetchEmployees])

  // Get blocks for expanded employee
  const expandedEmp = expandedEmployee ? latestByEmployee.find((e) => e.employee === expandedEmployee) : null
  const expandedBlocks = useMemo(() => {
    if (!expandedEmp) return []
    return Object.entries(expandedEmp.blocks)
      .map(([blockId, block]) => ({ blockId, ...block }))
      .sort((a, b) => new Date(b.blockStart).getTime() - new Date(a.blockStart).getTime())
  }, [expandedEmp])

  // Calculate total hours for an employee
  const calcTotalHours = (blocks: Record<string, BlockInfo>): string => {
    let totalMs = 0
    for (const block of Object.values(blocks)) {
      const start = new Date(block.blockStart).getTime()
      const end = new Date(block.blockEnd).getTime()
      totalMs += end - start
    }
    const hours = Math.round(totalMs / 3600000 * 10) / 10
    return `${hours}h`
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Attendance</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-[#1A1AE8] px-3 py-2 text-xs font-bold text-white hover:opacity-90"
          >
            <Plus size={14} />
            Add Employee
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        {/* Filter row */}
        {hasAny && (
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
          </div>
        )}

        {/* Column header */}
        {hasAny && (
          <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-4 border-b border-gray-200 bg-white px-4 py-2.5">
            <span className="w-6" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Employee</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Role</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Company</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Hours</span>
          </div>
        )}

        {/* Empty state */}
        {!hasAny && !loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400">
              <Plus size={20} />
            </div>
            <p className="m-0 font-sans text-sm font-medium text-gray-900">No employees yet</p>
            <p className="m-0 max-w-sm font-sans text-xs text-gray-400">Add employees to start tracking attendance.</p>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-[#1A1AE8] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:opacity-90"
            >
              <Plus size={11} />
              Add Employee
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && !hasAny && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 size={20} className="animate-spin text-gray-400" />
            <p className="m-0 font-sans text-sm text-gray-400">Loading employees...</p>
          </div>
        )}

        {/* No matches under filter */}
        {hasAny && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="m-0 font-sans text-sm text-gray-400">No employees match these filters.</p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="cursor-pointer border-0 bg-transparent font-mono text-[10px] uppercase tracking-wider2 text-blue-600 underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Employee rows */}
        {filtered.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {filtered.map((emp) => {
              const isExpanded = expandedEmployee === emp.employee
              const blockCount = Object.keys(emp.blocks).length

              return (
                <li key={emp.employee}>
                  {/* Employee row */}
                  <div
                    className={`grid grid-cols-[auto_2fr_1fr_1fr_1fr] items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(emp.employee)}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="min-w-0">
                      <p className="m-0 truncate font-sans text-sm font-medium text-gray-900">{emp.displayName}</p>
                      <p className="m-0 truncate font-mono text-[10px] text-gray-400">{emp.employee}</p>
                    </div>
                    <div>
                      <span className="font-mono text-xs text-gray-700">{emp.role || '—'}</span>
                    </div>
                    <div>
                      <span className="font-sans text-xs text-gray-700">{emp.companyName}</span>
                    </div>
                    <div>
                      <span className="font-mono text-xs font-medium text-gray-900">{blockCount > 0 ? calcTotalHours(emp.blocks) : '—'}</span>
                      {blockCount > 0 && (
                        <span className="ml-1 font-mono text-[10px] text-gray-400">({blockCount} blocks)</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded check-in history */}
                  {isExpanded && expandedEmp && (
                    <div className="border-t border-blue-100 bg-blue-50/50 px-4 py-4">
                      <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">
                        Check-in History — {expandedEmp.displayName}
                      </p>

                      {expandedBlocks.length === 0 ? (
                        <p className="m-0 py-4 text-center text-xs text-gray-400">No check-ins yet</p>
                      ) : (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Date</th>
                              <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Start</th>
                              <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">End</th>
                              <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Duration</th>
                              <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Status</th>
                              <th className="px-3 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {expandedBlocks.map((block) => {
                              const start = new Date(block.blockStart)
                              const end = new Date(block.blockEnd)
                              const durationMs = end.getTime() - start.getTime()
                              const durationH = Math.round(durationMs / 3600000 * 10) / 10
                              const dateStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                              const startStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                              const endStr = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

                              return (
                                <tr key={block.blockId} className="hover:bg-white/50">
                                  <td className="px-3 py-2 font-sans text-xs text-gray-900">{dateStr}</td>
                                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{startStr}</td>
                                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{endStr}</td>
                                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{durationH}h</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                      block.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                                      block.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {block.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {block.status === 'Open' && (
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleConfirm(expandedEmp.contractId, block.blockId)}
                                          disabled={actionLoading === block.blockId}
                                          title="Confirm"
                                          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-green-200 bg-white text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
                                        >
                                          {actionLoading === block.blockId ? (
                                            <Loader2 size={12} className="animate-spin" />
                                          ) : (
                                            <Check size={12} />
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleReject(expandedEmp.contractId, block.blockId)}
                                          disabled={actionLoading === block.blockId}
                                          title="Reject"
                                          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                                        >
                                          {actionLoading === block.blockId ? (
                                            <Loader2 size={12} className="animate-spin" />
                                          ) : (
                                            <X size={12} />
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
            <span className="font-sans text-[11px] text-gray-400">{filtered.length} {filtered.length === 1 ? 'employee' : 'employees'}</span>
          </div>
        )}
      </div>

      {/* Add Employee Drawer */}
      <AddEmployeeDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export default AttendancePage
