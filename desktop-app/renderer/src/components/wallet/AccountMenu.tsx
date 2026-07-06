// Account menu — small popover anchored to the TopBar wallet chip.
// Three items in order: Account Info, Faucet, Export Private Key.
// Closes on outside click or Escape. (Receive was dropped with the
// payroll surface — the wallet now only sends / receives via the
// flow builder's routed transfers, not a dedicated receive modal.)

import { useEffect, useRef } from 'react'
import { useWallet } from '../../context/WalletContext'
import { Droplets, Info, KeyRound } from 'lucide-react'

interface AccountMenuProps {
  open: boolean
  onClose: () => void
}

export function AccountMenu({ open, onClose }: AccountMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { openAccountInfo, openFaucet, openExportKey } = useWallet()

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

  const handleAccountInfo = () => {
    openAccountInfo()
    onClose()
  }
  const handleFaucet = () => {
    openFaucet()
    onClose()
  }
  const handleExportKey = () => {
    openExportKey()
    onClose()
  }

  return (
    <div
      ref={ref}
      role='menu'
      aria-label='Wallet menu'
      className='absolute right-0 top-full z-[60] mt-1 w-[220px] rounded-md border border-brand-border bg-white py-1 shadow-lg'
    >
      <button
        type='button'
        role='menuitem'
        onClick={handleAccountInfo}
        className='flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left font-sans text-[13px] text-brand-navy hover:bg-brand-light'
      >
        <Info size={14} className='flex-shrink-0 text-brand-muted' />
        Account Info
      </button>
      <button
        type='button'
        role='menuitem'
        onClick={handleFaucet}
        className='flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left font-sans text-[13px] text-brand-navy hover:bg-brand-light'
      >
        <Droplets size={14} className='flex-shrink-0 text-brand-muted' />
        Faucet
      </button>
      <button
        type='button'
        role='menuitem'
        onClick={handleExportKey}
        className='flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left font-sans text-[13px] text-brand-navy hover:bg-brand-light'
      >
        <KeyRound size={14} className='flex-shrink-0 text-brand-muted' />
        Export Private Key
      </button>
    </div>
  )
}

export default AccountMenu
