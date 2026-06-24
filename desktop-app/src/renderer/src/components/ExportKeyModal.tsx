import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'
import { Copy, Check, ShieldAlert } from 'lucide-react'

/**
 * Export-private-key modal. Shows the base64-encoded secret key with
 * a copy button and a big red warning. Key is fetched on-demand from
 * the main process — never held in renderer state permanently.
 */
export default function ExportKeyModal() {
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
      title="Export Private Key"
      subtitle="Base64-encoded Ed25519 secret key"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-brand-errBg border border-brand-errBorder rounded-md">
          <ShieldAlert size={14} className="text-brand-err mt-0.5 flex-shrink-0" />
          <p className="font-sans text-xs text-brand-errDark m-0">
            Anyone with this private key can spend the funds controlled
            by this wallet. Do not share it. Clear your clipboard after
            pasting it somewhere safe.
          </p>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mb-1.5 m-0">
            Private Key
          </p>
          <div className="flex items-start gap-2">
            <code className="flex-1 font-mono text-xs text-brand-navy bg-brand-light border border-brand-border rounded px-2 py-2 break-all max-h-32 overflow-y-auto">
              {value || '—'}
            </code>
            <button
              type="button"
              onClick={copy}
              disabled={!value}
              className="flex-shrink-0 p-2 bg-white border border-brand-border rounded hover:bg-brand-light cursor-pointer disabled:opacity-50"
              aria-label="Copy private key"
              title="Copy private key"
            >
              {copied ? (
                <Check size={12} className="text-brand-tealAccent" />
              ) : (
                <Copy size={12} className="text-brand-navy" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={closeExportKey}
            className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
          >
            Close
          </button>
        </div>
      </div>
    </WalletModal>
  )
}
