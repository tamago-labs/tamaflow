import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'
import { Check, Copy } from 'lucide-react'

/**
 * Receive modal — shows a QR code of the wallet's party ID so another
 * party can scan it to send funds. The party ID is also shown in plain
 * text with a copy button for wallets that prefer to paste.
 *
 * QR is generated client-side via `qrcode.toDataURL` and rendered as
 * an <img>. The encoded payload is just the raw party ID string —
 * Canton wallets are expected to parse it as a destination party.
 */
export default function ReceiveModal() {
  const { modal, status, closeReceive } = useWallet()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const partyId = status?.partyId ?? ''

  // Re-render the QR whenever the modal opens (or the party ID changes).
  useEffect(() => {
    if (!modal.receiveOpen || !partyId) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(partyId, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: { dark: '#0a0a5c', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch((err) => {
        console.error('[ReceiveModal] QR generation failed:', err)
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [modal.receiveOpen, partyId])

  // Reset transient state when the modal closes.
  useEffect(() => {
    if (!modal.receiveOpen) {
      setCopied(false)
    }
  }, [modal.receiveOpen])

  const copy = async () => {
    if (!partyId) return
    try {
      await navigator.clipboard.writeText(partyId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error('[ReceiveModal] copy failed:', e)
    }
  }

  return (
    <WalletModal
      open={modal.receiveOpen}
      onClose={closeReceive}
      title="Receive"
      subtitle="Share to receive funds on Canton"
      maxWidth="max-w-sm"
    >
      <div className="space-y-4">
        <p className="font-sans text-xs text-brand-muted m-0 leading-relaxed">
          Senders can scan the QR or paste the party ID below to transfer
          Amulet (CC) or other Canton instruments to this wallet.
        </p>

        {/* QR code */}
        <div className="flex items-center justify-center p-4 bg-brand-light border border-brand-border rounded-md">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for party ${partyId}`}
              width={256}
              height={256}
              className="block w-64 h-64"
            />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center">
              <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted">
                {partyId ? 'Generating…' : 'No wallet'}
              </p>
            </div>
          )}
        </div>

        {/* Party ID + copy */}
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted m-0">
            Party ID
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs text-brand-navy bg-brand-light border border-brand-border rounded px-2 py-1.5 break-all min-w-0">
              {partyId || '—'}
            </code>
            {partyId && (
              <button
                type="button"
                onClick={copy}
                className="flex-shrink-0 p-1.5 bg-white border border-brand-border rounded hover:bg-brand-light cursor-pointer"
                aria-label="Copy party ID"
                title={copied ? 'Copied!' : 'Copy party ID'}
              >
                {copied ? (
                  <Check size={12} className="text-brand-tealAccent" />
                ) : (
                  <Copy size={12} className="text-brand-navy" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Network footer */}
        <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted m-0 pt-1">
          Network · DevNet
        </p>
      </div>
    </WalletModal>
  )
}