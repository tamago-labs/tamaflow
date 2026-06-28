// Floating top-left toolbar — the only "header" on the flow builder.
//
// MVP scope (Phase 1):
//   • Display the flow name
//   • "+ Add Card" toggle that opens <AddCardPopover>
//   • "Clear All" button (with confirm)
//
// Template menu / prompt-to-flow AI / generate-outcomes button are
// deferred to later phases — they don't exist yet.

import { motion } from 'framer-motion'
import { BLUE, MUTED, NAVY, monoFont, sansFont } from './theme'

const MAX_NAME_LENGTH = 24

function truncate(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) return name
  return name.slice(0, MAX_NAME_LENGTH - 3) + '...'
}

interface CanvasToolbarProps {
  flowName: string
  cardCount: number
  addOpen: boolean
  onToggleAdd: () => void
  onRequestClearAll: () => void
}

export default function CanvasToolbar({
  flowName,
  cardCount,
  addOpen,
  onToggleAdd,
  onRequestClearAll,
}: CanvasToolbarProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid #e0e0f0',
        borderRadius: 8,
        boxShadow: '0 4px 14px rgba(10,10,92,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          lineHeight: 1.15,
          paddingRight: 8,
        }}
      >
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: MUTED,
            textTransform: 'uppercase',
          }}
        >
          Flow Builder
        </span>
        <span
          style={{
            fontFamily: sansFont,
            fontSize: 14,
            fontWeight: 700,
            color: NAVY,
            letterSpacing: '0.02em',
          }}
        >
          {flowName.trim() ? truncate(flowName) : 'Untitled flow'}
        </span>
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 8,
            color: MUTED,
            letterSpacing: '0.1em',
            marginTop: 2,
          }}
        >
          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        </span>
      </div>

      <div style={{ width: 1, height: 24, background: '#e0e0f0' }} />

      <motion.button
        type="button"
        onClick={onToggleAdd}
        // Stop pointerdown from reaching the window: the AddCardPopover
        // listens for window mousedown to close itself, and pointerdown
        // fires before mousedown — without this, clicking "Close" would
        // close the popover via the window listener and then the button's
        // own onClick would toggle it right back open.
        onPointerDown={(e) => e.stopPropagation()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          height: 30,
          padding: '0 12px',
          background: addOpen ? BLUE : 'transparent',
          color: addOpen ? '#fff' : BLUE,
          border: '1.5px solid ' + BLUE,
          borderRadius: 6,
          fontFamily: monoFont,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>+</span>
        Add Card
      </motion.button>

      <motion.button
        type="button"
        onClick={onRequestClearAll}
        // Disabled state is implied by the empty canvas — no cards means
        // there's nothing to clear. Visual cue only; not a hard disable
        // because the parent owns the confirm modal.
        whileHover={{ scale: cardCount > 0 ? 1.02 : 1 }}
        whileTap={{ scale: cardCount > 0 ? 0.98 : 1 }}
        style={{
          height: 30,
          padding: '0 12px',
          background: 'transparent',
          color: cardCount > 0 ? MUTED : '#d0d0e8',
          border: '1px solid ' + (cardCount > 0 ? '#e0e0f0' : '#f0f0f8'),
          borderRadius: 6,
          fontFamily: monoFont,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: cardCount > 0 ? 'pointer' : 'not-allowed',
        }}
      >
        Clear All
      </motion.button>
    </div>
  )
}