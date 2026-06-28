// Floating "Add Card" palette — the user picks a card template here to
// drop on the canvas.
//
// Mirrors the reference AddCardPopover pattern:
//   • Live search input at the top filters every group
//   • Cards are grouped by category (Source / Payee)
//   • Click a tile to pick — parent closes the popover and adds the card
//   • Click-outside or Escape closes
//
// Search input auto-focuses on open; small delay so the panel finishes
// its mount transition.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BLUE,
  MUTED,
  NAVY,
  monoFont,
  sansFont,
  BORDER,
} from './theme'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PALETTE_CARDS,
  TONE_COLORS,
  payeeTemplatesFor,
  shortPartyId,
  toneForCategory,
} from '../data/flowCards'
import type { SimCardTemplate } from './types'
import type { Employee } from '../../../preload/index.d'

interface AddCardPopoverProps {
  open: boolean
  /** Set to false to hide the Source tile (treasury wallet isn't set up). */
  hasWallet: boolean
  /**
   * Canton party id of the loaded treasury wallet. Used to render the
   * Source palette tile as the actual wallet identity (matches what the
   * card will show on the canvas after placement), instead of the static
   * "Treasury Wallet" placeholder from the catalog.
   */
  walletPartyId: string
  /** Set to false to hide the Payee section (no employees in the roster). */
  hasEmployees: boolean
  /**
   * Roster used to build one Payee tile per employee. Required even when
   * `hasEmployees` is false (pass `[]`) so the prop type stays stable.
   */
  employees: Employee[]
  onPick: (template: SimCardTemplate) => void
  onClose: () => void
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  source: 'Where funds originate',
  payee: 'Who gets paid (employee / contractor)',
}

export default function AddCardPopover({
  open,
  hasWallet,
  walletPartyId,
  hasEmployees,
  employees,
  onPick,
  onClose,
}: AddCardPopoverProps) {
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the search input when the popover opens.
  useEffect(() => {
    if (open) {
      // Slight delay so the panel finishes its mount transition.
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
    setQuery('')
    return undefined
  }, [open])

  // Click-outside + Escape to close.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const filteredByCategory = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Hide categories whose prerequisite isn't met (no wallet → no Source
    // tile; no employees → no Payee tile). Users see only what they can
    // actually use — the matching "no wallet / no employees" hints live
    // in the categories section header so they know why.
    const catAvailable: Record<string, boolean> = {
      source: hasWallet,
      payee: hasEmployees,
    }
    const out: Record<string, SimCardTemplate[]> = {}
    for (const cat of CATEGORY_ORDER) {
      if (!catAvailable[cat]) {
        out[cat] = []
        continue
      }
      // Payee section is dynamic — one tile per employee. Source comes
      // from the static palette catalog.
      const all = cat === 'payee'
        ? payeeTemplatesFor(employees)
        : PALETTE_CARDS.filter((c) => c.category === cat)
      out[cat] = all.filter(
        (c) => q === '' || c.title.toLowerCase().includes(q),
      )
    }
    return out
  }, [query, hasWallet, hasEmployees, employees])

  if (!open) return null

  const totalMatches = CATEGORY_ORDER.reduce(
    (sum, c) => sum + (filteredByCategory[c]?.length ?? 0),
    0,
  )

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 76,
        left: 16,
        width: 360,
        maxHeight: 'calc(100vh - 110px)',
        background: '#fff',
        border: '1px solid ' + BORDER,
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(10,10,92,0.14)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid ' + BORDER,
          background: '#fafaff',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cards…"
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #d0d0e8',
            borderRadius: 6,
            fontFamily: sansFont,
            fontSize: 13,
            color: NAVY,
            background: '#fff',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ overflowY: 'auto', padding: '8px 12px 16px' }}>
        {CATEGORY_ORDER.map((cat) => {
          const items = filteredByCategory[cat]
          // A category can be empty either because the search didn't match
          // anything (skip the header — the "no matches" footer handles it)
          // OR because the prerequisite isn't met (show the header + a hint
          // so the user knows why the tile is missing).
          const catAvailable: Record<string, boolean> = {
            source: hasWallet,
            payee: hasEmployees,
          }
          const prereqMissing = !catAvailable[cat]
          if ((!items || items.length === 0) && !prereqMissing) return null
          return (
            <section key={cat} style={{ marginTop: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <p
                  style={{
                    fontFamily: monoFont,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    color: MUTED,
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </p>
                <span style={{ color: '#d0d0e8', fontSize: 10 }}>·</span>
                <p
                  style={{
                    fontFamily: sansFont,
                    fontSize: 10,
                    color: '#b0b0cc',
                    margin: 0,
                  }}
                >
                  {CATEGORY_DESCRIPTIONS[cat]}
                </p>
              </div>
              {prereqMissing ? (
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#a5a5c4',
                    padding: '6px 8px',
                    background: '#f7f7fc',
                    borderRadius: 4,
                    border: '1px dashed ' + BORDER,
                    lineHeight: 1.4,
                  }}
                >
                  {cat === 'source'
                    ? 'Set up a wallet in Assets to add a Source card'
                    : 'Add employees in Employees to add a Payee card'}
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                  }}
                >
                  {items!.map((c) => (
                    <PopoverTile
                      key={c.id}
                      template={c}
                      employees={employees}
                      walletPartyId={walletPartyId}
                      onClick={() => onPick(c)}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}

        {totalMatches === 0 && (hasWallet || hasEmployees) && (
          <p
            style={{
              fontFamily: sansFont,
              fontSize: 12,
              color: MUTED,
              textAlign: 'center',
              margin: '20px 0',
            }}
          >
            No cards match “{query}”.
          </p>
        )}
      </div>
    </div>
  )
}

function PopoverTile({
  template,
  employees,
  walletPartyId,
  onClick,
}: {
  template: SimCardTemplate
  employees: Employee[]
  walletPartyId: string
  onClick: () => void
}) {
  // Use the same per-category tone the placed card will get so the tile
  // visually previews the card the user is about to add.
  const accent = TONE_COLORS[toneForCategory(template.category)]

  // One-line subtitle per category — short context about what this card
  // represents. For Payee, look up the bound employee to show their
  // country + pay currency (e.g. "US · USD"). For Source, just label
  // it as the treasury wallet.
  const subtitle = (() => {
    if (template.category === 'source') return 'Treasury wallet'
    if (template.category === 'payee') {
      const employeeId = template.payeeFields?.employeeId
      if (!employeeId) return 'Payee'
      const emp = employees.find((e) => e.id === employeeId)
      if (!emp) return 'Payee'
      return `${emp.country ?? '?'} · ${emp.payCurrency ?? '?'}`
    }
    return ''
  })()

  // Override the Source tile title with the live wallet identity so the
  // palette shows the same thing the placed card will display. Falls
  // back to the catalog default when the wallet isn't loaded (the tile
  // is also gated off by `hasWallet` in that case, so users won't see it).
  const title =
    template.category === 'source' && walletPartyId
      ? shortPartyId(walletPartyId)
      : template.title

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid ' + BORDER,
        borderLeft: '3px solid ' + accent,
        borderRadius: 6,
        padding: '8px 10px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <span
        style={{
          fontFamily: monoFont,
          fontSize: 8,
          letterSpacing: '0.12em',
          color: MUTED,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {subtitle}
      </span>
      <span
        style={{
          fontFamily: sansFont,
          fontSize: 12,
          fontWeight: 600,
          color: NAVY,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </span>
    </button>
  )
}

/** Inline reference to keep linter happy if `BLUE` is ever unused. */
export const _BLUE_REF = BLUE