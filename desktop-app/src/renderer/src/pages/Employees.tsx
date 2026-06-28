import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Download, Upload } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmployeeFormDrawer from '../components/EmployeeFormDrawer'
import EmployeeImportModal from '../components/EmployeeImportModal'
import ConfirmDeleteEmployeeModal from '../components/ConfirmDeleteEmployeeModal'
import { useEmployees } from '../context/EmployeeContext'
import { worldCountryLabel } from '../lib/worldCountries'
import {
  EMPLOYEE_TYPES,
  EMPLOYEE_STATUSES,
  employeeTypeLabel,
  employeeStatusLabel,
  employeeStatusBadge,
  payFrequencyLabel
} from '../lib/employees'
import type {
  Employee,
  EmployeeType,
  EmployeeStatus
} from '../../../preload/index.d'

/**
 * Employees — roster page. Lists everyone the employer pays (regular
 * employees, contractors, and "other" arrangements). Add / edit /
 * delete via right-side drawer + type-to-confirm modal.
 *
 * Layout mirrors `Assets.tsx`: white card, header row, CSS-grid `<ul>`
 * of rows with always-visible Edit / Delete buttons in the action
 * cell (kept simple — no portal dropdown needed for two actions).
 *
 * Filtering is local-state only (no IPC round-trip on filter change):
 * search box matches display name (case-insensitive substring),
 * type + status selects are exact-match.
 */
export default function Employees() {
  const { employees, exportJson } = useEmployees()

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [importOpen, setImportOpen] = useState(false)
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

  return (
    <div>
      <PageHeader
        label="People"
        title="Employees"
        subtitle="Manage the people you pay. Add employees manually or import a roster to seed a new flow."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={!hasAny}
              className="flex items-center gap-1.5 py-2 px-3 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={11} />
              Export
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 py-2 px-3 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
            >
              <Upload size={11} />
              Import
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 py-2 px-4 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
            >
              <Plus size={12} />
              Add Employee
            </button>
          </div>
        }
      />

      <div className="bg-white border border-brand-border rounded-md overflow-hidden">
        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-brand-border bg-brand-light">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={12}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name…"
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-brand-border rounded-md font-sans text-xs text-brand-navy placeholder:text-brand-muted focus:outline-none focus:border-brand-blue"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as EmployeeType | 'all')}
            className="px-2 py-1.5 bg-white border border-brand-border rounded-md font-mono text-[10px] uppercase tracking-wider2 text-brand-navy focus:outline-none focus:border-brand-blue"
          >
            <option value="all">All types</option>
            {EMPLOYEE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EmployeeStatus | 'all')}
            className="px-2 py-1.5 bg-white border border-brand-border rounded-md font-mono text-[10px] uppercase tracking-wider2 text-brand-navy focus:outline-none focus:border-brand-blue"
          >
            <option value="all">All statuses</option>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Column header */}
        {hasAny && (
          <div className="grid grid-cols-[2fr_1fr_1.2fr_1fr_auto] gap-4 py-2.5 px-4 border-b border-brand-border bg-white">
            <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              Employee
            </span>
            <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              Country
            </span>
            <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              Compensation
            </span>
            <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              Status
            </span>
            <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold text-right">
              Actions
            </span>
          </div>
        )}

        {/* Empty state (no roster at all) */}
        {!hasAny && (
          <div className="py-16 flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-light border border-brand-border flex items-center justify-center text-brand-muted">
              <Plus size={20} />
            </div>
            <p className="font-sans text-sm font-medium text-brand-navy m-0">
              No employees yet
            </p>
            <p className="font-sans text-xs text-brand-muted m-0 max-w-sm">
              Add your first employee to get started, or import an existing roster
              from a JSON file.
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-2 flex items-center gap-1.5 py-2 px-4 bg-brand-blue text-white border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase hover:opacity-90 cursor-pointer"
            >
              <Plus size={11} />
              Add Employee
            </button>
          </div>
        )}

        {/* No matches under filter */}
        {hasAny && !hasMatches && (
          <div className="py-12 flex flex-col items-center text-center gap-2">
            <p className="font-sans text-sm text-brand-muted m-0">
              No employees match these filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setTypeFilter('all')
                setStatusFilter('all')
              }}
              className="font-mono text-[10px] uppercase tracking-wider2 text-brand-blue cursor-pointer bg-transparent border-0 underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Rows */}
        {hasMatches && (
          <ul className="divide-y divide-brand-border">
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

      {/* Drawers / modals */}
      <EmployeeFormDrawer open={addOpen} onClose={() => setAddOpen(false)} />
      <EmployeeFormDrawer
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        initial={editTarget ?? undefined}
      />
      <ConfirmDeleteEmployeeModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        target={deleteTarget}
      />
      <EmployeeImportModal open={importOpen} onClose={() => setImportOpen(false)} onConfirm={() => {}} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Avatar — initials chip                                                     */
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
    <li className="grid grid-cols-[2fr_1fr_1.2fr_1fr_auto] gap-4 items-center py-3 px-4 hover:bg-brand-light/40 transition-colors">
      {/* Employee — avatar + name + role + missing partyId chip */}
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={employee.displayName} />
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-brand-navy m-0 truncate">
            {employee.displayName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted">
              {employeeTypeLabel(employee.type)}
              {employee.role && (
                <>
                  <span className="mx-1 opacity-50">·</span>
                  <span className="normal-case tracking-normal text-brand-muted/80">
                    {employee.role}
                  </span>
                </>
              )}
            </span>
            {missingPartyId && (
              <span
                className="font-mono text-[9px] uppercase tracking-wider2 px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-900 border border-amber-200"
                title="No Canton partyId — cannot receive payroll yet"
              >
                No partyId
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Country */}
      <div>
        <p className="font-mono text-xs text-brand-navy m-0">{countryDisplay}</p>
      </div>

      {/* Compensation — currency + frequency */}
      <div>
        <p className="font-mono text-xs text-brand-navy m-0 whitespace-nowrap">{compensation}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted/70 m-0 mt-0.5 whitespace-nowrap">
          Contract currency
        </p>
      </div>

      {/* Status badge */}
      <div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-sm border font-mono text-[10px] uppercase tracking-wider2 ${employeeStatusBadge(employee.status)}`}
        >
          {employeeStatusLabel(employee.status)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end">
        <RowActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </li>
  )
}

/**
 * Tiny status chip showing whether the employee is paid under the
 * company's home jurisdiction. "Inside" is the safe default (teal,
 * non-alarming); "Outside" uses a subtle neutral pill so the row
 * visually differentiates cross-border payees without screaming.
 */
function JurisdictionChip({
  inside,
  isCompanySet
}: {
  inside: boolean
  isCompanySet: boolean
}) {
  if (inside && !isCompanySet) {
    return (
      <span
        className="font-mono text-[9px] uppercase tracking-wider2 px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-900 border border-amber-200 mt-1 inline-block"
        title="Set up your company profile to inherit country + currency"
      >
        No company
      </span>
    )
  }
  if (inside) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-wider2 px-1.5 py-0.5 rounded-sm bg-brand-teal/15 text-brand-navy border border-brand-teal/30 mt-1 inline-block">
        Inside
      </span>
    )
  }
  return (
    <span className="font-mono text-[9px] uppercase tracking-wider2 px-1.5 py-0.5 rounded-sm bg-brand-light text-brand-muted border border-brand-border mt-1 inline-block">
      Outside
    </span>
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
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-light border border-brand-border font-mono text-[10px] font-bold text-brand-navy"
      aria-hidden="true"
    >
      {initials || '·'}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* RowActions — Edit + Delete buttons (always visible)                          */
/* -------------------------------------------------------------------------- */

function RowActions({
  onEdit,
  onDelete
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="inline-flex items-center gap-1 justify-end">
      <button
        type="button"
        onClick={onEdit}
        title="Edit"
        aria-label="Edit employee"
        className="inline-flex items-center justify-center w-7 h-7 bg-white text-brand-navy border border-brand-border rounded-md cursor-pointer hover:bg-brand-light transition-colors"
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        title="Delete"
        aria-label="Delete employee"
        className="inline-flex items-center justify-center w-7 h-7 bg-white text-brand-err border border-brand-errBorder rounded-md cursor-pointer hover:bg-brand-errBg transition-colors"
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