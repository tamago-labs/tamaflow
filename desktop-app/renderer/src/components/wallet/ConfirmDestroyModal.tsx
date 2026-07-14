// Type-to-confirm modal for destroying the wallet. The submit button
// stays disabled until the user types exactly DELETE. Irreversible.

import { useEffect, useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { WalletModal } from './WalletModal'
import { ShieldAlert } from 'lucide-react'

export function ConfirmDestroyModal() {
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
      title='Destroy Wallet'
      subtitle='This is irreversible'
    >
      <div className='space-y-4'>
        <div className='flex items-start gap-2 rounded-md border border-brand-errBorder bg-brand-errBg p-3'>
          <ShieldAlert size={14} className='mt-0.5 flex-shrink-0 text-brand-err' />
          <p className='m-0 font-sans text-xs text-brand-errDark'>
            Destroying the wallet removes the encrypted private key from
            this machine. Any funds held by this party will become
            inaccessible. Make sure you have exported the private key
            first if you want to recover the wallet later.
          </p>
        </div>

        <div>
          <label
            htmlFor='confirm-delete'
            className='mb-1.5 block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'
          >
            Type DELETE to confirm
          </label>
          <input
            id='confirm-delete'
            type='text'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={busy}
            autoComplete='off'
            spellCheck={false}
            className='w-full rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-sm text-brand-navy focus:border-brand-blue focus:outline-none'
          />
        </div>

        <div className='flex items-center justify-end gap-2 pt-2'>
          <button
            type='button'
            onClick={closeDestroy}
            disabled={busy}
            className='cursor-pointer rounded-md border border-brand-border bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleDestroy}
            disabled={!canSubmit}
            className='cursor-pointer rounded-md border-0 bg-brand-err px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50'
          >
            {busy ? 'Destroying…' : 'Destroy Wallet'}
          </button>
        </div>
      </div>
    </WalletModal>
  )
}

export default ConfirmDestroyModal
