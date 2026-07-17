import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Download, Upload, Landmark, History } from 'lucide-react'
import EmployeeFormDrawer from '../EmployeeFormDrawer'
import ConfirmDeleteModal from '../ConfirmDeleteModal'
import { PartyIdModal } from '../wallet/PartyIdModal'
import { ObligationsDrawer } from '../employee/ObligationsDrawer'
import { SettlementHistoryDrawer } from '../employee/SettlementHistoryDrawer'
import { useEmployees } from '../../context/EmployeeContext'
import {
  EMPLOYEE_TYPES,
  EMPLOYEE_STATUSES,
  employeeTypeLabel,
  employeeStatusLabel,
  employeeStatusBadge,
  payFrequencyLabel
} from '../../lib/employees'
import { worldCountryLabel } from '../../lib/worldCountries'
import type { Employee, EmployeeType, EmployeeStatus } from '../../ai/types'

export function EmployeesPage() {
  const { employees, exportJson, importJson, save, remove } = useEmployees()

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [partyIdTarget, setPartyIdTarget] = useState<Employee | null>(null)
  const [obligationsTarget, setObligationsTarget] = useState<Employee | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Employee | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<EmployeeType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'all'>('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return employees.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (q && !e.displayName.toLowerCase().includes(q)) return false
      return true
    })
  }, [employees, search, typeFilter, statusFilter])

  const hasAny = employees.length > 0
  const hasMatches = filtered.length > 0

  const handleExport = async () => {
    try {
      await exportJson()
    } catch (e) {
      console.error('[Employees] export failed:', e)
    }
  }

  const handleImport = async () => {
    try {
      const result = await importJson()
      if (result.success && result.file) {
        await save(result.file.employees)
      }
    } catch (e) {
      console.error('[Employees] import failed:', e)
    }
  }

  return (
    <div>
      {/* Minimal header — title + actions in one row */}
      <div className='mb-6 flex items-center justify-between'>
        <h1 className='m-0 text-2xl font-light tracking-tight text-brand-navy'>
          Employees
        </h1>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={handleExport}
            disabled={!hasAny}
            className='flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition disabled:cursor-not-allowed disabled:opacity-40'
          >
            <Download size={14} />
            Export
          </button>
          <button
            type='button'
            onClick={handleImport}
            className='flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition'
          >
            <Upload size={14} />
            Import
          </button>
          <button
            type='button'
            onClick={() => setAddOpen(true)}
            className='flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#1A1AE8] rounded-md hover:bg-[#1515c0] transition'
          >
            <Plus size={12} />
            Add Employee
          </button>
        </div>
      </div>

      <div className='overflow-hidden rounded-md border border-brand-border bg-white'>
        {/* Filter row */}
        <div className='flex flex-wrap items-center gap-3 border-b border-brand-border bg-brand-light px-4 py-3'>
          <div className='relative min-w-[200px] flex-1'>
            <Search
              size={12}
              className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted'
            />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Filter by name…'
              className='w-full rounded-md border border-brand-border bg-white py-1.5 pl-8 pr-3 font-sans text-xs text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none'
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as EmployeeType | 'all')}
            className='rounded-md border border-brand-border bg-white px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider2 text-brand-navy focus:border-brand-blue focus:outline-none'
          >
            <option value='all'>All types</option>
            {EMPLOYEE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EmployeeStatus | 'all')}
            className='rounded-md border border-brand-border bg-white px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider2 text-brand-navy focus:border-brand-blue focus:outline-none'
          >
            <option value='all'>All statuses</option>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Column header */}
        {hasAny && (
          <div className='grid grid-cols-[2fr_1fr_1.2fr_1fr_auto] gap-4 border-b border-brand-border bg-white px-4 py-2.5'>
            <span className='font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              Employee
            </span>
            <span className='font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              Country
            </span>
            <span className='font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              Compensation
            </span>
            <span className='font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              Status
            </span>
            <span className='text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              Actions
            </span>
          </div>
        )}

        {/* Empty state (no roster at all) */}
        {!hasAny && (
          <div className='flex flex-col items-center gap-3 py-16 text-center'>
            <div className='flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400'>
              <Plus size={20} />
            </div>
            <p className='m-0 font-sans text-sm font-medium text-gray-900'>
              No employees yet
            </p>
            <p className='m-0 max-w-sm font-sans text-xs text-gray-400'>
              Add your first employee to get started, or import an existing roster from a JSON file.
            </p>
            <button
              type='button'
              onClick={() => setAddOpen(true)}
              className='mt-2 cursor-pointer rounded-md border-0 bg-[#1A1AE8] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 flex items-center gap-1.5'
            >
              <Plus size={11} />
              Add Employee
            </button>
          </div>
        )}

        {/* No matches under filter */}
        {hasAny && !hasMatches && (
          <div className='flex flex-col items-center gap-2 py-12 text-center'>
            <p className='m-0 font-sans text-sm text-brand-muted'>
              No employees match these filters.
            </p>
            <button
              type='button'
              onClick={() => {
                setSearch('')
                setTypeFilter('all')
                setStatusFilter('all')
              }}
              className='cursor-pointer border-0 bg-transparent font-mono text-[10px] uppercase tracking-wider2 text-brand-blue underline'
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Rows */}
        {hasMatches && (
          <ul className='divide-y divide-brand-border'>
            {filtered.map((e) => (
              <EmployeeRow
                key={e.id}
                employee={e}
                onEdit={() => setEditTarget(e)}
                onDelete={() => setDeleteTarget(e)}
                onPartyIdClick={() => setPartyIdTarget(e)}
                onObligations={() => setObligationsTarget(e)}
                onHistory={() => setHistoryTarget(e)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Drawers / modals */}
      <EmployeeFormDrawer open={addOpen} onClose={() => setAddOpen(false)} />
      <EmployeeFormDrawer
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        initial={editTarget ?? undefined}
      />
      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        target={deleteTarget}
        onConfirm={async () => {
          if (!deleteTarget) return
          await remove(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
      <PartyIdModal
        open={!!partyIdTarget}
        onClose={() => setPartyIdTarget(null)}
        employeeId={partyIdTarget?.id ?? ''}
        partyId={partyIdTarget?.cantonPartyId}
      />
      <ObligationsDrawer
        open={!!obligationsTarget}
        onClose={() => setObligationsTarget(null)}
        employee={obligationsTarget}
      />
      <SettlementHistoryDrawer
        open={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        employee={historyTarget}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* EmployeeRow — single table row for an employee                              */
/* -------------------------------------------------------------------------- */

function EmployeeRow({
  employee,
  onEdit,
  onDelete,
  onPartyIdClick,
  onObligations,
  onHistory
}: {
  employee: Employee
  onEdit: () => void
  onDelete: () => void
  onPartyIdClick: () => void
  onObligations: () => void
  onHistory: () => void
}) {
  const countryDisplay = employee.country ? worldCountryLabel(employee.country) : '—'
  const currencyDisplay = employee.payCurrency ?? '—'

  const compensation =
    employee.payFrequency === 'hourly'
      ? `${formatAmount(employee.hourlyRate)} ${currencyDisplay} / hr`
      : employee.salaryAmount
        ? `${formatAmount(employee.salaryAmount)} ${currencyDisplay} / ${payFrequencyLabel(employee.payFrequency)}`
        : `${currencyDisplay} / ${payFrequencyLabel(employee.payFrequency)}`

  const missingPartyId = !employee.cantonPartyId && employee.status === 'active'

  return (
    <li className='grid grid-cols-[2fr_1fr_1.2fr_1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-brand-light/40'>
      {/* Employee — avatar + name + role + missing partyId chip */}
      <div className='flex min-w-0 items-center gap-3'>
        <Avatar name={employee.displayName} />
        <div className='min-w-0'>
          <p className='m-0 truncate font-mono text-sm font-bold text-brand-navy'>
            {employee.displayName}
          </p>
          <div className='mt-0.5 flex flex-wrap items-center gap-1.5'>
            <span className='font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
              {employeeTypeLabel(employee.type)}
              {employee.role && (
                <>
                  <span className='mx-1 opacity-50'>·</span>
                  <span className='normal-case tracking-normal text-brand-muted/80'>
                    {employee.role}
                  </span>
                </>
              )}
            </span>
            {missingPartyId ? (
              <button
                onClick={onPartyIdClick}
                className='rounded-sm border border-amber-200 bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider2 text-amber-900 cursor-pointer hover:bg-amber-200 transition'
                title='Click to set Canton partyId'
              >
                No partyId
              </button>
            ) : employee.cantonPartyId ? (
              <button
                onClick={onPartyIdClick}
                className='rounded-sm border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] text-gray-600 cursor-pointer hover:bg-gray-200 transition'
                title={employee.cantonPartyId}
              >
                {employee.cantonPartyId.length > 12
                  ? `${employee.cantonPartyId.slice(0, 6)}…${employee.cantonPartyId.slice(-4)}`
                  : employee.cantonPartyId}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Country */}
      <div>
        <p className='m-0 font-mono text-xs text-brand-navy'>{countryDisplay}</p>
      </div>

      {/* Compensation — currency + frequency */}
      <div>
        <p className='m-0 whitespace-nowrap font-mono text-xs text-brand-navy'>{compensation}</p> 
      </div>

      {/* Status badge */}
      <div>
        <span
          className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider2 ${employeeStatusBadge(employee.status)}`}
        >
          {employeeStatusLabel(employee.status)}
        </span>
      </div>

      {/* Actions */}
      <div className='flex items-center justify-end'>
        <RowActions onEdit={onEdit} onDelete={onDelete} onObligations={onObligations} onHistory={onHistory} hasObligations={!!employee.taxObligation || !!employee.socialSecurity} />
      </div>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/* Avatar — initials chip                                                     */
/* -------------------------------------------------------------------------- */

function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  let initials = ''
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  } else if (parts.length === 1 && parts[0].length >= 2) {
    initials = parts[0].slice(0, 2).toUpperCase()
  } else if (parts.length === 1) {
    initials = parts[0].toUpperCase()
  }
  return (
    <div
      className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-light font-mono text-[10px] font-bold text-brand-navy'
      aria-hidden='true'
    >
      {initials || '·'}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* RowActions — Edit + Delete buttons (always visible)                        */
/* -------------------------------------------------------------------------- */

function RowActions({
  onEdit,
  onDelete,
  onObligations,
  onHistory,
  hasObligations
}: {
  onEdit: () => void
  onDelete: () => void
  onObligations: () => void
  onHistory: () => void
  hasObligations: boolean
}) {
  return (
    <div className='inline-flex items-center justify-end gap-1'>
      <button
        type='button'
        onClick={onEdit}
        title='Edit'
        aria-label='Edit employee'
        className='inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50'
      >
        <Pencil size={12} />
      </button>
      <button
        type='button'
        onClick={onObligations}
        title='Tax Obligations'
        aria-label='Edit tax obligations'
        className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border bg-white transition-colors hover:bg-gray-50 ${hasObligations ? 'border-blue-300 text-blue-600' : 'border-gray-200 text-gray-400'}`}
      >
        <Landmark size={12} />
      </button>
      <button
        type='button'
        onClick={onHistory}
        title='Settlement History'
        aria-label='View settlement history'
        className='inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50'
      >
        <History size={12} />
      </button>
      <button
        type='button'
        onClick={onDelete}
        title='Delete'
        aria-label='Delete employee'
        className='inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-red-200 bg-white text-red-500 transition-colors hover:bg-red-50'
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

/** Format a decimal-string amount with thousands separators. */
function formatAmount(value: string | undefined): string {
  if (!value) return '—'
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default EmployeesPage
