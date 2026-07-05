// Account info modal — shows the wallet's party ID, fingerprint,
// creation date, and storage path. Each value has a copy button.
// No private key displayed (that's behind Export).

import { useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { WalletModal } from './WalletModal'
import { Copy, Check } from 'lucide-react'

export function AccountInfoModal() {
  const { modal, status, closeAccountInfo } = useWallet()
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (label: string, value: string | undefined) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    } catch (e) {
      console.error('[AccountInfoModal] copy failed:', e)
    }
  }

  const fields: Array<{
    label: string
    value: string | undefined
  }> = [
    { label: 'Party ID', value: status?.partyId },
    { label: 'Fingerprint', value: status?.fingerprint },
    { label: 'Public Key', value: status?.publicKey },
    { label: 'Created', value: status?.createdAt },
    { label: 'Storage', value: status?.filePath }
  ]

  return (
    <WalletModal
      open={modal.accountInfoOpen}
      onClose={closeAccountInfo}
      title='Account Info'
      subtitle='Canton DevNet wallet'
    >
      <div className='space-y-3'>
        {fields.map((f) => (
          <div key={f.label} className='space-y-1'>
            <p className='m-0 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
              {f.label}
            </p>
            <div className='flex items-center gap-2'>
              <code className='flex-1 break-all rounded border border-brand-border bg-brand-light px-2 py-1.5 font-mono text-xs text-brand-navy'>
                {f.value ?? '—'}
              </code>
              {f.value && (
                <button
                  type='button'
                  onClick={() => copy(f.label, f.value)}
                  aria-label={`Copy ${f.label}`}
                  title={`Copy ${f.label}`}
                  className='flex-shrink-0 cursor-pointer rounded border border-brand-border bg-white p-1.5 hover:bg-brand-light'
                >
                  {copied === f.label ? (
                    <Check size={12} className='text-brand-tealAccent' />
                  ) : (
                    <Copy size={12} className='text-brand-navy' />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        <p className='m-0 pt-2 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
          Network · DevNet
        </p>
      </div>
    </WalletModal>
  )
}

export default AccountInfoModal
