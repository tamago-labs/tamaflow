// Floating top-left toolbar — the only "header" on the flow builder.
//
// MVP scope (Phase 1):
//   • Click-to-edit flow name (inline)
//   • "+ Add Card" toggle that opens <AddCardPopover>
//   • "Preview" button that opens the RoutesPreviewModal
//
// Template menu / prompt-to-flow AI are deferred to later phases —
// they don't exist yet.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BLUE, MUTED, NAVY, monoFont, sansFont } from './theme'

interface CanvasToolbarProps {
  flowName: string
  addOpen: boolean
  onToggleAdd: () => void
  onRequestPreview: () => void
  onNameChange: (next: string) => void
}

export default function CanvasToolbar({
  flowName,
  addOpen,
  onToggleAdd,
  onRequestPreview,
  onNameChange,
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
      <FlowNameField
        flowName={flowName}
        onNameChange={onNameChange}
      />

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
        onClick={onRequestPreview}
        // Mirrors the same `onPointerDown` guard as Add Card — the
        // popover listens for window mousedown to close, and pointerdown
        // fires first. Without this, the click would bubble and toggle
        // the popover back open right after closing it.
        onPointerDown={(e) => e.stopPropagation()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          height: 30,
          padding: '0 12px',
          background: 'transparent',
          color: BLUE,
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
        Preview
      </motion.button>
    </div>
  )
}

// ─── FlowNameField ────────────────────────────────────────────────────
//
// Click-to-edit flow name — the "Flow Builder" eyebrow sits above an
// editable name. On click the name becomes an inline input; commit on
// blur or Enter, cancel on Escape. Lifted from the standalone
// <FlowNameEditor> overlay that previously floated at top-centre —
// merging into the toolbar keeps all canvas chrome in one place so
// the canvas top edge isn't cluttered.
function FlowNameField({
  flowName,
  onNameChange,
}: {
  flowName: string
  onNameChange: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(flowName)

  // Keep the draft in sync with the parent if the name changes
  // externally (e.g. after switching flows).
  useEffect(() => {
    if (!editing) setDraft(flowName)
  }, [flowName, editing])

  function commit() {
    const trimmed = draft.trim()
    const next = trimmed === '' ? flowName : trimmed
    setDraft(next)
    onNameChange(next)
    setEditing(false)
  }

  function startEdit() {
    setDraft(flowName)
    setEditing(true)
  }

  return (
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
      {editing ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setDraft(flowName)
              setEditing(false)
            }
          }}
          // Don't let key events leak to the canvas — typing space
          // shouldn't toggle add-card popovers, etc.
          onKeyUp={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            fontFamily: sansFont,
            fontSize: 14,
            fontWeight: 700,
            color: NAVY,
            letterSpacing: '0.02em',
            background: 'transparent',
            border: 'none',
            borderBottom: '1.5px solid ' + BLUE,
            padding: '1px 0',
            margin: '-1px 0',
            outline: 'none',
            minWidth: 160,
            maxWidth: 280,
          }}
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          title="Click to rename"
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            fontFamily: sansFont,
            fontSize: 14,
            fontWeight: 700,
            color: NAVY,
            letterSpacing: '0.02em',
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'text',
            textAlign: 'left',
            // Underline-on-hover affordance — it's not obviously a
            // button otherwise.
            borderBottom: '1.5px dashed transparent',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderBottomColor = '#e0e0f0')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderBottomColor = 'transparent')
          }
        >
          {flowName.trim() ? flowName : 'Untitled flow'}
        </button>
      )}
    </div>
  )
}