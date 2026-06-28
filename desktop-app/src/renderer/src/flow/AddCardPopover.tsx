// Floating "Add Card" palette — the user picks a card template here to
// drop on the canvas.
//
// Mirrors the reference AddCardPopover pattern:
//   • Live search input at the top filters every group
//   • Cards are grouped by category (Source / Payee / Transfer)
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
  TRANSFER_VARIANT_LABELS,
  TONE_COLORS,
  toneForCategory,
} from '../data/flowCards'
import type { SimCardTemplate } from './types'

interface AddCardPopoverProps {
  open: boolean
  onPick: (template: SimCardTemplate) => void
  onClose: () => void
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  source: 'Where funds originate',
  payee: 'Who gets paid (employee / contractor)',
  transfer: 'How the payment is executed',
}

export default function AddCardPopover({
  open,
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
    const out: Record<string, SimCardTemplate[]> = {}
    for (const cat of CATEGORY_ORDER) {
      out[cat] = PALETTE_CARDS.filter(
        (c) =>
          c.category === cat &&
          (q === '' || c.title.toLowerCase().includes(q)),
      )
    }
    return out
  }, [query])

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
          if (!items || items.length === 0) return null
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
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}
              >
                {items.map((c) => (
                  <PopoverTile
                    key={c.id}
                    template={c}
                    onClick={() => onPick(c)}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {totalMatches === 0 && (
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
  onClick,
}: {
  template: SimCardTemplate
  onClick: () => void
}) {
  // Use the same per-category tone the placed card will get so the tile
  // visually previews the card the user is about to add.
  const accent = TONE_COLORS[toneForCategory(template.category)]

  // One-line subtitle per category — short context about what this card
  // represents, helps the user disambiguate similar templates.
  const subtitle =
    template.category === 'source'
      ? 'Treasury wallet'
      : template.category === 'payee'
      ? 'Bind to an employee at edit time'
      : template.transferVariant
      ? TRANSFER_VARIANT_LABELS[template.transferVariant] + ' payment'
      : ''

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
        {template.title}
      </span>
    </button>
  )
}

/** Inline reference to keep linter happy if `BLUE` is ever unused. */
export const _BLUE_REF = BLUE