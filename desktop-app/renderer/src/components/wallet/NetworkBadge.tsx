// NetworkBadge — the network indicator in the top bar.
//
// Sits to the left of the wallet chip. Same chrome as the wallet
// controls (white bg, brand-blue border + label) so the right-side
// actions pair visually.
//
// v1 ships with only DevNet (FiveNorth Seaport Validator DevNet).
// Picking another network is a no-op for now — the picker is wired
// up so adding Testnet/Mainnet later is a one-line append to
// `NETWORKS`.

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

interface Network {
  key: string
  label: string
  active?: boolean
  hint?: string
}

const NETWORKS: Network[] = [
  { key: 'devnet', label: 'Devnet', active: true }
]

export function NetworkBadge() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = NETWORKS.find((n) => n.active) ?? NETWORKS[0]

  return (
    <div ref={wrapperRef} className='relative'>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-haspopup='menu'
        aria-expanded={open}
        aria-label={`Connected network: ${active.label}`}
        className='flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-blue bg-white px-3 py-1.5 text-xs font-semibold text-brand-blue hover:bg-brand-light'
      >
        <span
          className='h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-teal'
          aria-hidden
        />
        <span className='font-mono text-[10px] font-bold uppercase tracking-wider2 '>{active.label}</span>
        <ChevronDown
          size={11}
          className={`text-brand-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role='menu'
          className='absolute right-0 top-full z-[60] mt-1 w-[220px] rounded-md border border-brand-border bg-white py-1 shadow-lg'
        >
          <p className='px-3 pb-1 pt-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
            Switch network
          </p>
          <ul>
            {NETWORKS.map((n) => (
              <li key={n.key}>
                <button
                  type='button'
                  role='menuitem'
                  onClick={() => setOpen(false)}
                  className='flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left hover:bg-brand-light'
                >
                  <img
                    src="https://s2.coinmarketcap.com/static/img/coins/64x64/37263.png"
                    alt="Canton"
                    className='h-5 w-5 rounded-full border border-gray-200'
                  />
                  <span className='min-w-0 flex-1'>
                    <span className='block font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-navy'>
                      {n.label}
                    </span>
                  </span>
                  {n.active && (
                    <Check
                      size={12}
                      strokeWidth={3}
                      className='flex-shrink-0 text-brand-tealAccent'
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default NetworkBadge
