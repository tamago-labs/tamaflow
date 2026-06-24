import { useEffect, useState } from 'react'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'
import { ShieldAlert } from 'lucide-react'

/**
 * Type-to-confirm modal for destroying the wallet. The submit button
 * stays disabled until the user types exactly DELETE. Irreversible.
 */
export default function ConfirmDestroyModal() {
  const { modal, destroy, closeDestroy } = useWallet()
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (modal.destroyOpen) setConfirmText('')
  }, [modal.destroyOpen])

  const handleDestroy = async () => {
    if (confirmText !== 'DELETE') return
    setBusy(true)
    try {
      await destroy()
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = confirmText === 'DELETE' && !busy

  return (
    <WalletModal
      open={modal.destroyOpen}
      onClose={closeDestroy}
      title="Destroy Wallet"
      subtitle="This is irreversible"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-brand-errBg border border-brand-errBorder rounded-md">
          <ShieldAlert size={14} className="text-brand-err mt-0.5 flex-shrink-0" />
          <p className="font-sans text-xs text-brand-errDark m-0">
            Destroying the wallet removes the encrypted private key from
            this machine. Any funds held by this party will become
            inaccessible. Make sure you have exported the private key
            first if you want to recover the wallet later.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirm-delete"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mb-1.5"
          >
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete"
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
            onClick={closeDestroy}
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
            {busy ? 'Destroying…' : 'Destroy Wallet'}
          </button>
        </div>
      </div>
    </WalletModal>
  )
}
