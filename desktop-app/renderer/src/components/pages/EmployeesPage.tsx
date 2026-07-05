import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Download, Upload } from 'lucide-react'
import { PageHeader } from '../PageHeader'
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
      <PageHeader
        label='People'
        title='Employees'
        subtitle='Manage the people you pay. Add employees manually or import a roster to seed a new flow.'
        actions={
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={handleExport}
              disabled={!hasAny}
              className='flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40'
            >
              <Download size={11} />
              Export
            </button>
            <button
              type='button'
              onClick={handleImport}
              className='flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light'
            >
              <Upload size={11} />
              Import
            </button>
            <button
              type='button'
              onClick={() => setAddOpen(true)}
              className='flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90'
            >
              <Plus size={12} />
              Add Employee
            </button>
          </div>
        }
      />

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
            <div className='flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-brand-light text-brand-muted'>
              <Plus size={20} />
            </div>
            <p className='m-0 font-sans text-sm font-medium text-brand-navy'>
              No employees yet
            </p>
            <p className='m-0 max-w-sm font-sans text-xs text-brand-muted'>
              Add your first employee to get started, or import an existing roster from a JSON file.
            </p>
            <button
              type='button'
              onClick={() => setAddOpen(true)}
              className='mt-2 cursor-pointer rounded-md border-0 bg-brand-blue px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:opacity-90'
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
              />
            ))}
          </ul>
        )}
      </div>

      {/* Drawers / modals — stubs until components are created */}
      {addOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='w-full max-w-md rounded-md bg-white p-6 shadow-lg'>
            <p className='m-0 mb-4 font-sans text-sm font-medium text-brand-navy'>Add Employee</p>
            <p className='m-0 mb-4 font-sans text-xs text-brand-muted'>
              EmployeeFormDrawer not yet created. Close to dismiss.
            </p>
            <button
              type='button'
              onClick={() => setAddOpen(false)}
              className='cursor-pointer rounded-md border-0 bg-brand-blue px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:opacity-90'
            >
              Close
            </button>
          </div>
        </div>
      )}
      {editTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='w-full max-w-md rounded-md bg-white p-6 shadow-lg'>
            <p className='m-0 mb-4 font-sans text-sm font-medium text-brand-navy'>
              Edit Employee: {editTarget.displayName}
            </p>
            <p className='m-0 mb-4 font-sans text-xs text-brand-muted'>
              EmployeeFormDrawer not yet created. Close to dismiss.
            </p>
            <button
              type='button'
              onClick={() => setEditTarget(null)}
              className='cursor-pointer rounded-md border-0 bg-brand-blue px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:opacity-90'
            >
              Close
            </button>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='w-full max-w-md rounded-md bg-white p-6 shadow-lg'>
            <p className='m-0 mb-4 font-sans text-sm font-medium text-brand-navy'>
              Delete Employee: {deleteTarget.displayName}?
            </p>
            <p className='m-0 mb-4 font-sans text-xs text-brand-muted'>
              ConfirmDeleteModal not yet created. This would confirm deletion.
            </p>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={() => setDeleteTarget(null)}
                className='cursor-pointer rounded-md border border-brand-border bg-white px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={async () => {
                  if (!deleteTarget) return
                  await remove(deleteTarget.id)
                  setDeleteTarget(null)
                }}
                className='cursor-pointer rounded-md border-0 bg-red-600 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:opacity-90'
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* EmployeeRow — single table row for an employee                              */
/* -------------------------------------------------------------------------- */

function EmployeeRow({
  employee,
  onEdit,
  onDelete
}: {
  employee: Employee
  onEdit: () => void
  onDelete: () => void
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
            {missingPartyId && (
              <span
                className='rounded-sm border border-amber-200 bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider2 text-amber-900'
                title='No Canton partyId — cannot receive payroll yet'
              >
                No partyId
              </span>
            )}
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
        <p className='m-0 mt-0.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider2 text-brand-muted/70'>
          Contract currency
        </p>
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
        <RowActions onEdit={onEdit} onDelete={onDelete} />
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
  onDelete
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className='inline-flex items-center justify-end gap-1'>
      <button
        type='button'
        onClick={onEdit}
        title='Edit'
        aria-label='Edit employee'
        className='inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-brand-border bg-white text-brand-navy transition-colors hover:bg-brand-light'
      >
        <Pencil size={12} />
      </button>
      <button
        type='button'
        onClick={onDelete}
        title='Delete'
        aria-label='Delete employee'
        className='inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-brand-errBorder bg-white text-brand-err transition-colors hover:bg-brand-errBg'
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
