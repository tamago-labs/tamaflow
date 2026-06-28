import { useEffect, useState } from 'react'
import { Loader2, FileJson } from 'lucide-react'
import WalletModal from './WalletModal'
import { useEmployees } from '../context/EmployeeContext'
import { employeeTypeLabel, payFrequencyLabel, employeeStatusLabel } from '../lib/employees'
import { worldCountryLabel } from '../lib/worldCountries'
import type {
  EmployeeFile,
  Employee,
  EmployeeImportResult
} from '../../../preload/index.d'

/**
 * Modal that handles the JSON import flow for the employee roster.
 *
 * Lifecycle when `open` flips to true:
 *   1. Calls `importJson()` — main process opens the OS file picker,
 *      parses + validates the JSON, computes a diff against the
 *      current roster (if any).
 *   2. Three outcomes:
 *      - **canceled** → close silently.
 *      - **success** → render a diff summary. Checkbox "Replace
 *        existing roster" toggles destructive mode (default off).
 *        Two actions: **Cancel** (discards) and **Apply Import**
 *        (label flips to **Apply + Replace** when checked).
 *      - **error** → render the error + **Try a different file** +
 *        **Cancel**.
 *
 * Apply replaces the current roster with the parsed list — this is a
 * "merge-by-id" semantic when checkbox is unchecked (existing rows
 * not in import are kept), and "full replace" when checked (existing
 * rows not in import are dropped).
 */
interface EmployeeImportModalProps {
  open: boolean
  onClose: () => void
  /** Called with the parsed file when the user clicks Apply. */
  onConfirm: (file: EmployeeFile) => Promise<void> | void
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'picking' }
  | { kind: 'preview'; file: EmployeeFile; diff: NonNullable<EmployeeImportResult['diff']> }
  | { kind: 'error'; message: string }

export default function EmployeeImportModal({
  open,
  onClose
}: EmployeeImportModalProps) {
  const { importJson, save, employees } = useEmployees()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [applying, setApplying] = useState(false)

  // Drive the import whenever the modal opens.
  useEffect(() => {
    if (!open) {
      setPhase({ kind: 'idle' })
      setReplaceExisting(false)
      setApplying(false)
      return
    }
    let cancelled = false
    setPhase({ kind: 'picking' })
    void runImport(cancelled)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const runImport = async (cancelled: boolean) => {
    try {
      const result = await importJson()
      if (cancelled) return
      if (result.canceled) {
        onClose()
        return
      }
      if (!result.success || !result.file || !result.diff) {
        const msg = result.error ?? 'Import failed'
        setPhase({ kind: 'error', message: msg })
        return
      }
      setPhase({ kind: 'preview', file: result.file, diff: result.diff })
    } catch (e) {
      if (cancelled) return
      const msg = e instanceof Error ? e.message : String(e)
      setPhase({ kind: 'error', message: msg })
    }
  }

  const handleTryDifferent = async () => {
    setPhase({ kind: 'picking' })
    await runImport(false)
  }

  const handleApply = async () => {
    if (phase.kind !== 'preview') return
    setApplying(true)
    try {
      const imported = phase.file.employees
      // Merge-by-id by default; replace when checked.
      const next = replaceExisting
        ? imported
        : mergeById(imported, employees)
      await save(next)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setPhase({ kind: 'error', message: msg })
    } finally {
      setApplying(false)
    }
  }

  return (
    <WalletModal
      open={open}
      onClose={onClose}
      title="Import Employees Roster"
      subtitle="From a JSON file"
      maxWidth="max-w-lg"
    >
      {/* Picking */}
      {(phase.kind === 'idle' || phase.kind === 'picking') && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 size={16} className="animate-spin text-brand-muted" />
          <p className="font-sans text-sm text-brand-muted m-0">
            Choose a file in the system dialog…
          </p>
        </div>
      )}

      {/* Preview */}
      {phase.kind === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2">
            <FileJson size={16} className="text-brand-blue" />
            <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted m-0">
              Parsed successfully · review and apply
            </p>
          </div>

          <DiffSummary diff={phase.diff} />

          <details className="border border-brand-border rounded-md overflow-hidden">
            <summary className="cursor-pointer px-3 py-2 bg-brand-light font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold select-none">
              Show details ({phase.file.employees.length} employees)
            </summary>
            <div className="max-h-64 overflow-y-auto divide-y divide-brand-border">
              {phase.file.employees.map((e) => (
                <EmployeeSummaryRow key={e.id || e.displayName} employee={e} />
              ))}
            </div>
          </details>

          <label className="flex items-start gap-2 cursor-pointer p-3 bg-brand-light rounded-md">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              disabled={applying}
              className="mt-0.5"
            />
            <div>
              <p className="font-sans text-xs text-brand-navy m-0 font-medium">
                Replace existing roster
              </p>
              <p className="font-sans text-[11px] text-brand-muted m-0 mt-0.5">
                {replaceExisting
                  ? `Will remove ${phase.diff.willBeRemoved} existing employee${phase.diff.willBeRemoved === 1 ? '' : 's'} not in the import.`
                  : 'Merge by id — existing employees not in the import are kept.'}
              </p>
            </div>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50"
            >
              {applying && <Loader2 size={12} className="animate-spin" />}
              {applying
                ? 'Applying…'
                : replaceExisting
                  ? 'Apply + Replace'
                  : 'Apply Import'}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {phase.kind === 'error' && (
        <div className="space-y-4">
          <div className="p-3 bg-brand-errBg border border-brand-errBorder rounded-md">
            <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-err m-0 mb-1">
              Could not import
            </p>
            <p className="font-sans text-xs text-brand-errDark m-0 whitespace-pre-wrap">
              {phase.message}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTryDifferent}
              className="px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
            >
              Try a different file
            </button>
          </div>
        </div>
      )}
    </WalletModal>
  )
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function DiffSummary({
  diff
}: {
  diff: NonNullable<EmployeeImportResult['diff']>
}) {
  const parts: string[] = []
  if (diff.toAdd > 0) parts.push(`Add ${diff.toAdd}`)
  if (diff.toUpdate > 0) parts.push(`Update ${diff.toUpdate}`)
  if (diff.toSkip > 0) parts.push(`Skip ${diff.toSkip}`)
  if (diff.willBeRemoved > 0) parts.push(`Remove ${diff.willBeRemoved}`)
  return (
    <div className="px-4 py-3 bg-brand-blue/5 border border-brand-blue/20 rounded-md">
      <p className="font-mono text-[11px] tracking-wider2 text-brand-navy m-0 font-bold uppercase">
        {parts.join(' · ') || 'No changes'}
      </p>
    </div>
  )
}

function EmployeeSummaryRow({ employee }: { employee: Employee }) {
  const countryDisplay = employee.country ? worldCountryLabel(employee.country) : '—'
  const currencyDisplay = employee.payCurrency ?? '—'
  const pay =
    employee.payFrequency === 'hourly'
      ? `${employee.hourlyRate ?? '—'} ${currencyDisplay} / hr`
      : employee.salaryAmount
        ? `${employee.salaryAmount} ${currencyDisplay} / ${payFrequencyLabel(employee.payFrequency)}`
        : `${currencyDisplay} / ${payFrequencyLabel(employee.payFrequency)}`
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 bg-white items-center">
      <div className="min-w-0">
        <p className="font-sans text-xs font-medium text-brand-navy m-0 truncate">
          {employee.displayName}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted m-0 mt-0.5">
          {employeeTypeLabel(employee.type)} · {countryDisplay} · {pay}
        </p>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted whitespace-nowrap">
        {employeeStatusLabel(employee.status)}
      </span>
    </div>
  )
}

/**
 * Merge-by-id: imported rows with matching id overwrite existing rows;
 * existing rows not in import are preserved. Preserves the original
 * `createdAt` on overwrite so history isn't reset.
 */
function mergeById(imported: Employee[], current: Employee[]): Employee[] {
  const importedIds = new Set<string>()
  const result: Employee[] = imported.map((next) => {
    importedIds.add(next.id)
    const prev = current.find((c) => c.id === next.id)
    return prev ? { ...next, createdAt: prev.createdAt } : next
  })
  for (const e of current) {
    if (!importedIds.has(e.id)) result.push(e)
  }
  return result
}