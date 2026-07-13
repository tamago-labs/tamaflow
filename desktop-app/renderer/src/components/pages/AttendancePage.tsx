import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Eye, Clock } from 'lucide-react'
import { useContracts } from '../../context/ContractsContext'
import { useWallet } from '../../context/WalletContext'
import { cli } from '../../lib/cli'
import { AddEmployeeDrawer } from '../employee/AddEmployeeDrawer'

export function AttendancePage() {
  const { employees, fetchEmployees, loading } = useContracts()
  const { status, mode } = useWallet()
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const partyId = status?.partyId

  // Fetch employees from Canton Testnet on mount
  useEffect(() => {
    if (partyId) {
      fetchEmployees(partyId)
    }
  }, [partyId, fetchEmployees])

  const filteredEmployees = employees.filter((e) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      e.displayName.toLowerCase().includes(q) ||
      e.companyName.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q)
    )
  })

  const hasAny = employees.length > 0

  const handleCheckIn = useCallback(async () => {
    if (mode !== 'cli' || !partyId) return
    setCheckingIn(true)
    try {
      const now = new Date()
      const blockStart = now.toISOString()
      const blockEnd = new Date(now.getTime() + 3600000).toISOString() // +1 hour

      await cli.contracts.exercise(
        'TamaFlow.Attendance.TimeBlock:TimeBlock',
        'check-in',
        'CheckIn',
        { blockStart, blockEnd }
      )

      // Refresh employees after check-in
      fetchEmployees(partyId)
    } catch (e) {
      console.error('[Attendance] Check-in failed:', e)
    } finally {
      setCheckingIn(false)
    }
  }, [mode, partyId, fetchEmployees])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Attendance Report</h1>
        <div className="flex items-center gap-2">
          {mode === 'cli' && (
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-green-600 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50"
            >
              <Clock size={12} />
              {checkingIn ? 'Checking In…' : 'Check In'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-[#1A1AE8] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90"
          >
            <Plus size={12} />
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
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-gray-200 bg-white px-4 py-2.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Employee</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Role</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Company</span>
            <span className="text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Actions</span>
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
              className="mt-2 cursor-pointer rounded-md border-0 bg-[#1A1AE8] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 flex items-center gap-1.5"
            >
              <Plus size={11} />
              Add Employee
            </button>
          </div>
        )}

        {/* No matches under filter */}
        {hasAny && filteredEmployees.length === 0 && (
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

        {/* Rows */}
        {filteredEmployees.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {filteredEmployees.map((emp) => (
              <li key={emp.contractId} className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="m-0 truncate font-sans text-sm font-medium text-gray-900">{emp.displayName}</p>
                  <p className="m-0 font-mono text-[10px] text-gray-400">{emp.employee}</p>
                </div>
                <div>
                  <span className="font-mono text-xs text-gray-700">{emp.role || '—'}</span>
                </div>
                <div>
                  <span className="font-sans text-xs text-gray-700">{emp.companyName}</span>
                </div>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    title="View check-ins"
                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 transition-colors hover:bg-gray-50"
                    disabled
                  >
                    <Eye size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Footer count */}
        {filteredEmployees.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
            <span className="font-sans text-[11px] text-gray-400">{filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'}</span>
          </div>
        )}
      </div>

      {/* Add Employee Drawer */}
      <AddEmployeeDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export default AttendancePage
