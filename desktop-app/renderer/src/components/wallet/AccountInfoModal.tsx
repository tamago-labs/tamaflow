// Account info modal — shows the wallet's party ID and QR code.
// Each value has a copy button.

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

  const partyId = status?.partyId

  // Generate QR code URL for party ID
  const qrUrl = partyId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(partyId)}`
    : null

  return (
    <WalletModal
      open={modal.accountInfoOpen}
      onClose={closeAccountInfo}
      title='Account Info'
    >
      <div className='space-y-4'>
        {/* QR Code */}
        {qrUrl && (
          <div className='flex justify-center'>
            <img
              src={qrUrl}
              alt='Party ID QR Code'
              className='w-32 h-32 rounded-lg border border-gray-200'
            />
          </div>
        )}

        {/* Party ID */}
        <div className='space-y-1'>
          <p className='m-0 font-mono text-[10px] uppercase tracking-wider2 text-gray-400'>
            Party ID
          </p>
          <div className='flex items-center gap-2'>
            <code className='flex-1 break-all rounded border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-900'>
              {partyId ?? '—'}
            </code>
            {partyId && (
              <button
                type='button'
                onClick={() => copy('Party ID', partyId)}
                aria-label='Copy Party ID'
                title='Copy Party ID'
                className='flex-shrink-0 cursor-pointer rounded border border-gray-200 bg-white p-1.5 hover:bg-gray-50'
              >
                {copied === 'Party ID' ? (
                  <Check size={12} className='text-green-600' />
                ) : (
                  <Copy size={12} className='text-gray-600' />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Public Key */}
        {status?.publicKey && (
          <div className='space-y-1'>
            <p className='m-0 font-mono text-[10px] uppercase tracking-wider2 text-gray-400'>
              Public Key
            </p>
            <div className='flex items-center gap-2'>
              <code className='flex-1 break-all rounded border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-900'>
                {status.publicKey}
              </code>
              <button
                type='button'
                onClick={() => copy('Public Key', status.publicKey)}
                aria-label='Copy Public Key'
                title='Copy Public Key'
                className='flex-shrink-0 cursor-pointer rounded border border-gray-200 bg-white p-1.5 hover:bg-gray-50'
              >
                {copied === 'Public Key' ? (
                  <Check size={12} className='text-green-600' />
                ) : (
                  <Copy size={12} className='text-gray-600' />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </WalletModal>
  )
}

export default AccountInfoModal
