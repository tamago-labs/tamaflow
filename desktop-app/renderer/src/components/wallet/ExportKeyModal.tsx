// Export-private-key modal. Shows the base64-encoded secret key with
// a copy button and a big warning.

import { useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { WalletModal } from './WalletModal'
import { Copy, Check, ShieldAlert } from 'lucide-react'

export function ExportKeyModal() {
  const { modal, closeExportKey } = useWallet()
  const [copied, setCopied] = useState(false)
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
      subtitle='Base64-encoded Ed25519 secret key'
    >
      <div className='space-y-4'>
        <div className='flex items-start gap-2 rounded-md border border-brand-errBorder bg-brand-errBg p-3'>
          <ShieldAlert size={14} className='mt-0.5 flex-shrink-0 text-brand-err' />
          <p className='m-0 font-sans text-xs text-brand-errDark'>
            Anyone with this private key can spend the funds controlled
            by this wallet. Do not share it. Clear your clipboard after
            pasting it somewhere safe.
          </p>
        </div>

        <div>
          <p className='m-0 mb-1.5 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
            Private Key
          </p>
          <div className='flex items-start gap-2'>
            <code className='max-h-32 flex-1 overflow-y-auto break-all rounded border border-brand-border bg-brand-light px-2 py-2 font-mono text-xs text-brand-navy'>
              {value || '—'}
            </code>
            <button
              type='button'
              onClick={copy}
              disabled={!value}
              aria-label='Copy private key'
              title='Copy private key'
              className='flex-shrink-0 cursor-pointer rounded border border-brand-border bg-white p-2 hover:bg-brand-light disabled:opacity-50'
            >
              {copied ? (
                <Check size={12} className='text-brand-tealAccent' />
              ) : (
                <Copy size={12} className='text-brand-navy' />
              )}
            </button>
          </div>
        </div>

        <div className='flex items-center justify-end pt-2'>
          <button
            type='button'
            onClick={closeExportKey}
            className='cursor-pointer rounded-md border border-brand-border bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light'
          >
            Close
          </button>
        </div>
      </div>
    </WalletModal>
  )
}

export default ExportKeyModal
