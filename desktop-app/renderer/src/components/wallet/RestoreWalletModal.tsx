// RestoreWalletModal — import a previously-exported Ed25519
// private key into a new wallet file on this device. Caller
// pastes the base64 private key (same shape as `exportPrivateKey()`
// returns) + the original party hint.
//
// This is the inverse of `ExportKeyModal`: instead of "save your
// key somewhere safe", it's "paste the key you saved here". The
// resulting wallet file has the same shape as a freshly-generated
// one (encrypted at rest via safeStorage) so the rest of the app
// doesn't need to know whether the wallet was generated locally
// or restored.
//
// We do NOT verify the key against the on-ledger party here — that
// happens on the next transfer / faucet call. The Canton SDK
// derives the public key + fingerprint from the pasted private
// key in the main process; if the caller pasted a wrong-format
// string, the SDK throws and the IPC returns `INVALID_KEY`.

import { useEffect, useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { WalletModal } from './WalletModal'
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react'

const DEFAULT_PARTY_HINT = 'tamaflow'

export function RestoreWalletModal() {
  const { modal, loadStatus, error, restore, clearError, closeRestore } =
    useWallet()
  const [orgName, setOrgName] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  // Reset transient state every time the modal opens.
  useEffect(() => {
    if (modal.restoreOpen) {
      setOrgName('')
      setPrivateKey('')
      setAcknowledged(false)
      clearError()
    }
  }, [modal.restoreOpen, clearError])

  const isBusy = loadStatus === 'creating'

  const handleRestore = async () => {
    await restore({
      privateKey: privateKey.trim(),
      partyHint: orgName.trim() || undefined
    })
  }

  return (
    <WalletModal
      open={modal.restoreOpen}
      onClose={closeRestore}
      title='Restore Wallet'
      maxWidth='max-w-md'
    >
      <div className='space-y-4'>
        <div>
          <label
            htmlFor='restore-wallet-org'
            className='mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'
          >
            Original party hint
          </label>
          <input
            id='restore-wallet-org'
            type='text'
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder={DEFAULT_PARTY_HINT}
            disabled={isBusy}
            autoFocus
            className='w-full rounded-md border border-brand-border bg-white px-3 py-2 font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:opacity-60'
          />
          <p className='m-0 mt-1.5 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
            Must match the hint used when the wallet was created (the
            on-ledger partyId is <span className='normal-case tracking-normal'>hint::fingerprint</span>).
            Defaults to <span className='normal-case tracking-normal'>{DEFAULT_PARTY_HINT}</span> if blank.
          </p>
        </div>

        <div>
          <label
            htmlFor='restore-wallet-key'
            className='mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'
          >
            Base64 private key
          </label>
          <textarea
            id='restore-wallet-key'
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder='Paste the base64-encoded Ed25519 secret key…'
            disabled={isBusy}
            spellCheck={false}
            autoComplete='off'
            rows={4}
            className='w-full resize-y rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-xs text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:opacity-60'
          />
        </div>

        <label className='flex cursor-pointer select-none items-start gap-2'>
          <input
            type='checkbox'
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={isBusy}
            className='mt-0.5 cursor-pointer'
          />
          <span className='font-sans text-xs text-brand-navy'>
            I trust this device with my private key.
          </span>
        </label>

        {error && (
          <div className='rounded-md border border-brand-errBorder bg-brand-errBg p-3'>
            <p className='m-0 mb-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err'>
              Error
            </p>
            <p className='m-0 whitespace-pre-wrap font-sans text-xs text-brand-errDark'>
              {error}
            </p>
          </div>
        )}

        <div className='flex items-center justify-end gap-2 pt-2'>
          <button
            type='button'
            onClick={closeRestore}
            disabled={isBusy}
            className='cursor-pointer rounded-md border border-brand-border bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleRestore}
            disabled={!acknowledged || !privateKey.trim() || isBusy}
            className='flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50'
          >
            {isBusy ? <Loader2 size={12} className='animate-spin' /> : <KeyRound size={12} />}
            {isBusy ? 'Restoring…' : 'Restore Wallet'}
          </button>
        </div>
      </div>
    </WalletModal>
  )
}

export default RestoreWalletModal
