import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import WalletModal from './WalletModal'
import { useEmployees } from '../context/EmployeeContext'
import type { Employee } from '../../../preload/index.d'

/**
 * Type-to-confirm modal for deleting a single employee. Mirrors the
 * wallet's `ConfirmDestroyModal` — the submit button stays disabled
 * until the user types exactly DELETE.
 *
 * The page owns `target` (the employee about to be deleted); this
 * modal just confirms + invokes `useEmployees().remove(target.id)`.
 */
interface ConfirmDeleteEmployeeModalProps {
  open: boolean
  onClose: () => void
  target: Employee | null
}

export default function ConfirmDeleteEmployeeModal({
  open,
  onClose,
  target
}: ConfirmDeleteEmployeeModalProps) {
  const { remove } = useEmployees()
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset the input each time the modal opens.
  useEffect(() => {
    if (open) setConfirmText('')
  }, [open])

  const handleDelete = async () => {
    if (confirmText !== 'DELETE' || !target) return
    setBusy(true)
    try {
      await remove(target.id)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = confirmText === 'DELETE' && !busy && !!target

  return (
    <WalletModal
      open={open}
      onClose={onClose}
      title="Delete Employee"
      subtitle="This is irreversible"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-brand-errBg border border-brand-errBorder rounded-md">
          <ShieldAlert size={14} className="text-brand-err mt-0.5 flex-shrink-0" />
          <p className="font-sans text-xs text-brand-errDark m-0">
            Deleting <strong>{target?.displayName ?? 'this employee'}</strong>{' '}
            removes them from the roster on this machine. Past payroll history is
            unaffected — only the future payee entry is dropped. If you want to
            keep them in the roster but stop paying, change Status to "Paused"
            instead.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirm-delete-employee"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mb-1.5"
          >
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete-employee"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-mono text-sm text-brand-navy focus:outline-none focus:border-brand-blue"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canSubmit}
            className="px-4 py-2 bg-brand-err text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete Employee'}
          </button>
        </div>
      </div>
    </WalletModal>
  )
}