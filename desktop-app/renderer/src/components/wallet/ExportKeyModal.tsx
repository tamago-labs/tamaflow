// Export-private-key modal. Shows the secret key hidden by default
// with a reveal button and a copy button with a warning.

import { useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { WalletModal } from './WalletModal'
import { Copy, Check, ShieldAlert, Eye, EyeOff } from 'lucide-react'

export function ExportKeyModal() {
  const { modal, closeExportKey } = useWallet()
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const value = modal.exportKeyValue ?? ''

  const copy = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error('[ExportKeyModal] copy failed:', e)
    }
  }

  return (
    <WalletModal
      open={modal.exportKeyOpen}
      onClose={closeExportKey}
      title='Export Private Key'
    >
      <div className='space-y-4'>
        <div className='flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3'>
          <ShieldAlert size={14} className='mt-0.5 flex-shrink-0 text-red-600' />
          <p className='m-0 font-sans text-xs text-red-700'>
            Anyone with this private key can spend the funds controlled
            by this wallet. Do not share it. Clear your clipboard after
            pasting it somewhere safe.
          </p>
        </div>

        <div>
          <p className='m-0 mb-1.5 font-mono text-[10px] uppercase tracking-wider2 text-gray-400'>
            Private Key
          </p>
          <div className='flex items-start gap-2'>
            <code className='max-h-32 flex-1 overflow-y-auto break-all rounded border border-gray-200 bg-gray-50 px-2 py-2 font-mono text-xs text-gray-900'>
              {revealed ? (value || '—') : '•'.repeat(48)}
            </code>
            <div className='flex flex-col gap-1'>
              <button
                type='button'
                onClick={() => setRevealed((v) => !v)}
                disabled={!value}
                aria-label={revealed ? 'Hide private key' : 'Reveal private key'}
                title={revealed ? 'Hide' : 'Reveal'}
                className='flex-shrink-0 cursor-pointer rounded border border-gray-200 bg-white p-2 hover:bg-gray-50 disabled:opacity-50'
              >
                {revealed ? (
                  <EyeOff size={12} className='text-gray-600' />
                ) : (
                  <Eye size={12} className='text-gray-600' />
                )}
              </button>
              <button
                type='button'
                onClick={copy}
                disabled={!value}
                aria-label='Copy private key'
                title='Copy'
                className='flex-shrink-0 cursor-pointer rounded border border-gray-200 bg-white p-2 hover:bg-gray-50 disabled:opacity-50'
              >
                {copied ? (
                  <Check size={12} className='text-green-600' />
                ) : (
                  <Copy size={12} className='text-gray-600' />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className='flex items-center justify-end pt-2'>
          <button
            type='button'
            onClick={closeExportKey}
            className='cursor-pointer rounded-md border border-gray-200 bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-gray-900 hover:bg-gray-50'
          >
            Close
          </button>
        </div>
      </div>
    </WalletModal>
  )
}

export default ExportKeyModal
