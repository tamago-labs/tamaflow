import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import WalletModal from './WalletModal'
import { useCompany } from '../context/CompanyContext'

/**
 * Type-to-confirm modal for destroying the company profile on this
 * machine. The submit button stays disabled until the user types
 * exactly DESTROY. Irreversible — deletes <userData>/company.json.
 *
 * After a successful reset, fires `onDestroyed` (if provided) so the
 * host can transition the AppState machine back to the company gate.
 */
interface ConfirmDestroyCompanyModalProps {
  open: boolean
  onClose: () => void
  /** Optional — fires after a successful reset(). Host uses this to
   *  transition AppState back to 'company' (the gate screen). */
  onDestroyed?: () => void
}

export default function ConfirmDestroyCompanyModal({
  open,
  onClose,
  onDestroyed
}: ConfirmDestroyCompanyModalProps) {
  const { reset } = useCompany()
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset the input each time the modal is (re-)opened so a previous
  // "DESTROY" doesn't auto-approve a fresh attempt.
  useEffect(() => {
    if (open) setConfirmText('')
  }, [open])

  const handleDestroy = async () => {
    if (confirmText !== 'DESTROY') return
    setBusy(true)
    try {
      await reset()
      onClose()
      onDestroyed?.()
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = confirmText === 'DESTROY' && !busy

  return (
    <WalletModal
      open={open}
      onClose={onClose}
      title="Destroy Company Profile"
      subtitle="This is irreversible"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-brand-errBg border border-brand-errBorder rounded-md">
          <ShieldAlert size={14} className="text-brand-err mt-0.5 flex-shrink-0" />
          <p className="font-sans text-xs text-brand-errDark m-0">
            Destroying the company profile deletes <code className="font-mono text-xs">company.json</code>{' '}
            from this machine. The wallet and on-ledger assets are not affected. You'll need to
            set up a new company (or import a previously exported profile) before the app can
            resume normal operation.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirm-destroy-company"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mb-1.5"
          >
            Type DESTROY to confirm
          </label>
          <input
            id="confirm-destroy-company"
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
            onClick={handleDestroy}
            disabled={!canSubmit}
            className="px-4 py-2 bg-brand-err text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Destroying…' : 'Destroy Company'}
          </button>
        </div>
      </div>
    </WalletModal>
  )
}