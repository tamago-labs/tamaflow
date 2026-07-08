// Setup wallet modal: lets the user pick a party name that we
// slug-ify into a Canton party hint, or fall back to a default if they
// leave it blank. Generates a new keypair, allocates the party on
// Canton DevNet, and encrypts the wallet with the OS keychain.

import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { WalletModal } from './WalletModal'
import { Loader2 } from 'lucide-react'

const DEFAULT_PARTY_HINT = 'tamaflow'

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
      maxWidth='max-w-md'
    >
      <div className='space-y-4'>
        <div>
          <label
            htmlFor='setup-wallet-org'
            className='mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400'
          >
            Party Name
          </label>
          <input
            id='setup-wallet-org'
            type='text'
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder='Tamaflow'
            disabled={isBusy}
            autoFocus
            className='w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-blue-500 focus:outline-none disabled:opacity-60'
          />
          <p className='m-0 mt-1.5 font-mono text-[10px] uppercase tracking-wider2 text-gray-400'>
            Party hint:{' '}
            <span className='font-semibold normal-case tracking-normal text-gray-900'>
              {partyHint}
            </span>
            {usingDefault && (
              <span className='normal-case tracking-normal text-gray-400'>
                {' '}
                (default — leave blank or type your name)
              </span>
            )}
          </p>
        </div>

        <label className='flex cursor-pointer select-none items-start gap-2'>
          <input
            type='checkbox'
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={isBusy}
            className='mt-0.5 cursor-pointer'
          />
          <span className='font-sans text-xs text-gray-700'>
            I understand this wallet is bound to this machine.
          </span>
        </label>

        {error && (
          <div className='rounded-md border border-red-200 bg-red-50 p-3'>
            <p className='m-0 mb-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-red-600'>
              Error
            </p>
            <p className='m-0 whitespace-pre-wrap font-sans text-xs text-red-700'>
              {error}
            </p>
          </div>
        )}

        <div className='flex items-center justify-between pt-2'>
          <button
            type='button'
            onClick={handleGenerate}
            disabled={!acknowledged || isBusy}
            className='flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-blue-600 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:bg-blue-700 disabled:opacity-50'
          >
            {isBusy && <Loader2 size={12} className='animate-spin' />}
            {isBusy ? 'Generating…' : 'Generate Wallet'}
          </button>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => {
                closeSetup()
                openRestore()
              }}
              disabled={isBusy}
              className='cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-gray-700 hover:bg-gray-50 disabled:opacity-50'
            >
              Restore
            </button>
            <button
              type='button'
              onClick={closeSetup}
              disabled={isBusy}
              className='cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-gray-700 hover:bg-gray-50 disabled:opacity-50'
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </WalletModal>
  )
}

export default SetupWalletModal
