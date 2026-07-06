import { useEffect, useRef } from 'react'
import { useWallet } from '../context/WalletContext'
import { Info, Droplets, QrCode } from 'lucide-react'

/**
 * Account menu — small popover anchored to the TopBar wallet chip.
 * Three items in order: Receive, Account Info, Faucet. Closes on
 * outside click or Escape.
 */
interface AccountMenuProps {
  open: boolean
  onClose: () => void
}

export default function AccountMenu({ open, onClose }: AccountMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { openAccountInfo, openFaucet, openReceive } = useWallet()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const handleReceive = () => {
    openReceive()
    onClose()
  }
  const handleAccountInfo = () => {
    openAccountInfo()
    onClose()
  }
  const handleFaucet = () => {
    openFaucet()
    onClose()
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Wallet menu"
      className="absolute right-0 top-full mt-1 w-[220px] bg-white border border-brand-border rounded-md shadow-lg py-1 z-[60]"
    >
      <button
        type="button"
        role="menuitem"
        onClick={handleReceive}
        className="w-full flex items-center gap-2 px-3 py-2 text-left font-sans text-[13px] text-brand-navy hover:bg-brand-light cursor-pointer bg-transparent border-0"
      >
        <QrCode size={14} className="text-brand-muted flex-shrink-0" />
        Receive Funds
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={handleAccountInfo}
        className="w-full flex items-center gap-2 px-3 py-2 text-left font-sans text-[13px] text-brand-navy hover:bg-brand-light cursor-pointer bg-transparent border-0"
      >
        <Info size={14} className="text-brand-muted flex-shrink-0" />
        Account Info
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={handleFaucet}
        className="w-full flex items-center gap-2 px-3 py-2 text-left font-sans text-[13px] text-brand-navy hover:bg-brand-light cursor-pointer bg-transparent border-0"
      >
        <Droplets size={14} className="text-brand-muted flex-shrink-0" />
        Faucet
      </button>
    </div>
  )
}
