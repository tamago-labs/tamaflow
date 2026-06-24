import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'
import { Copy, Check } from 'lucide-react'

/**
 * Account info modal — shows the wallet's party ID, fingerprint,
 * creation date, and storage path. Each value has a copy button.
 * No private key displayed (that's behind Export in Settings).
 */
export default function AccountInfoModal() {
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
    truncate?: boolean
  }> = [
    { label: 'Party ID', value: status?.partyId },
    { label: 'Fingerprint', value: status?.fingerprint, truncate: true },
    { label: 'Public Key', value: status?.publicKey, truncate: true },
    { label: 'Created', value: status?.createdAt },
    { label: 'Storage', value: status?.filePath },
  ]

  return (
    <WalletModal
      open={modal.accountInfoOpen}
      onClose={closeAccountInfo}
      title="Account Info"
      subtitle="Canton DevNet wallet"
    >
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.label} className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted m-0">
              {f.label}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs text-brand-navy bg-brand-light border border-brand-border rounded px-2 py-1.5 break-all">
                {f.value ?? '—'}
              </code>
              {f.value && (
                <button
                  type="button"
                  onClick={() => copy(f.label, f.value)}
                  className="flex-shrink-0 p-1.5 bg-white border border-brand-border rounded hover:bg-brand-light cursor-pointer"
                  aria-label={`Copy ${f.label}`}
                  title={`Copy ${f.label}`}
                >
                  {copied === f.label ? (
                    <Check size={12} className="text-brand-tealAccent" />
                  ) : (
                    <Copy size={12} className="text-brand-navy" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted m-0 pt-2">
          Network · DevNet
        </p>
      </div>
    </WalletModal>
  )
}
