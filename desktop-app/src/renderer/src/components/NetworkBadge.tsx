import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * NetworkBadge — the network indicator in the top bar.
 *
 * Sits to the left of the wallet chip. Same chrome as the wallet
 * controls (white bg, brand-blue border + label) so the right-side
 * actions pair visually.
 *
 *   • Teal dot before the label = active/selected status.
 *   • ChevronDown + click-to-open dropdown → lists the available
 *     networks with a check next to the active one.
 *
 * v1 ships with only DevNet (FiveNorth Seaport Validator DevNet, set
 * in the main process). Picking another network is a no-op for now —
 * the picker is wired up so adding Testnet/Mainnet later is a one-line
 * append to `NETWORKS`.
 */
interface Network {
  key: string
  label: string
  active?: boolean
  hint?: string
}

const NETWORKS: Network[] = [
  { key: 'devnet', label: 'Devnet', active: true, hint: 'Canton DevNet' },
]

export default function NetworkBadge() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const active = NETWORKS.find((n) => n.active) ?? NETWORKS[0]

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Connected network: ${active.label}`}
        className="flex items-center gap-1.5 py-1.5 px-3 border border-brand-blue text-brand-blue bg-white rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
      >
        <span
          className="w-1.5 h-1.5 rounded-full bg-brand-teal flex-shrink-0"
          aria-hidden
        />
        <span>{active.label}</span>
        <ChevronDown
          size={11}
          className={`text-brand-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-[220px] bg-white border border-brand-border rounded-md shadow-lg py-1 z-[60]"
        >
          <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold px-3 pt-1.5 pb-1">
            Switch network
          </p>
          <ul>
            {NETWORKS.map((n) => (
              <li key={n.key}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-brand-light cursor-pointer bg-transparent border-0"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-[10px] font-bold tracking-wider2 text-brand-navy uppercase">
                      {n.label}
                    </span>
                    {n.hint && (
                      <span className="block font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
                        {n.hint}
                      </span>
                    )}
                  </span>
                  {n.active && (
                    <Check
                      size={12}
                      strokeWidth={3}
                      className="text-brand-tealAccent flex-shrink-0"
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