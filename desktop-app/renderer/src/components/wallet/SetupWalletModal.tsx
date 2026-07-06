// First-run modal: lets the user pick an organization name that we
// slug-ify into a Canton party hint, or fall back to a default if they
// leave it blank. Generates a new keypair, allocates the party on
// Canton DevNet, and encrypts the wallet with the OS keychain via
// Electron's safeStorage.

import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { WalletModal } from './WalletModal'
import { KeyRound, Loader2 } from 'lucide-react'

const DEFAULT_PARTY_HINT = 'tamaflow'

/** Pure / deterministic — mirrors `slugifyPartyHint` in
 *  electron/wallet.js. The two implementations must stay in sync. */
function slugifyPartyHint(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export function SetupWalletModal() {
  const { modal, loadStatus, error, setup, clearError, closeSetup, openRestore } =
    useWallet()
  const [orgName, setOrgName] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    if (modal.setupOpen) {
      setOrgName('')
      setAcknowledged(false)
      clearError()
    }
  }, [modal.setupOpen, clearError])

  const isBusy = loadStatus === 'creating'

  const { usingDefault, partyHint } = useMemo(() => {
    const slug = slugifyPartyHint(orgName.trim())
    const usingDefault = slug.length === 0
    return {
      usingDefault,
      partyHint: usingDefault ? DEFAULT_PARTY_HINT : slug
    }
  }, [orgName])

  const handleGenerate = async () => {
    await setup({ partyHint })
  }

  return (
    <WalletModal
      open={modal.setupOpen}
      onClose={closeSetup}
      title='Setup Wallet'
      subtitle='First-time setup'
      maxWidth='max-w-md'
    >
      <div className='space-y-4'>
        <div>
          <label
            htmlFor='setup-wallet-org'
            className='mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'
          >
            Organization name
          </label>
          <input
            id='setup-wallet-org'
            type='text'
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder='Acme Corp'
            disabled={isBusy}
            autoFocus
            className='w-full rounded-md border border-brand-border bg-white px-3 py-2 font-sans text-sm text-brand-navy placeholder:text-brand-muted transition-colors focus:border-brand-blue focus:outline-none disabled:opacity-60'
          />
          <p className='m-0 mt-1.5 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
            Party hint:{' '}
            <span className='font-semibold normal-case tracking-normal text-brand-navy'>
              {partyHint}
            </span>
            {usingDefault && (
              <span className='normal-case tracking-normal text-brand-muted'>
                {' '}
                (default — leave blank or type your org name)
              </span>
            )}
          </p>
        </div>

        <p className='m-0 font-sans text-xs leading-relaxed text-brand-muted'>
          Your keypair is generated locally and encrypted with your OS
          keychain. This wallet is bound to this device — destroying it
          removes access to the funds it controls.
        </p>

        <label className='flex cursor-pointer select-none items-start gap-2'>
          <input
            type='checkbox'
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={isBusy}
            className='mt-0.5 cursor-pointer'
          />
          <span className='font-sans text-xs text-brand-navy'>
            I understand this wallet is bound to this machine.
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
            onClick={closeSetup}
            disabled={isBusy}
            className='cursor-pointer rounded-md border border-brand-border bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleGenerate}
            disabled={!acknowledged || isBusy}
            className='flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50'
          >
            {isBusy && <Loader2 size={12} className='animate-spin' />}
            {isBusy ? 'Generating…' : 'Generate Wallet'}
          </button>
        </div>

        {/* Restore-from-key entry point. Sits below the primary
           actions so the "generate a new wallet" path stays the
           dominant affordance. */}
        <div className='border-t border-brand-border pt-3'>
          <button
            type='button'
            onClick={() => {
              closeSetup()
              openRestore()
            }}
            className='flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-brand-border bg-white px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider2 text-brand-navy transition hover:bg-brand-light'
          >
            <KeyRound size={12} className='text-brand-muted' />
            Already have a wallet? Restore from key
          </button>
        </div>
      </div>
    </WalletModal>
  )
}

export default SetupWalletModal
