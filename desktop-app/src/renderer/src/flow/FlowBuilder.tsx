// Free-form flow builder — fills the entire main content area.
//
// Controlled component: the parent owns the canonical `canvas` state
// and `flowName` (and is responsible for persistence). FlowBuilder owns
// the transient UI state (selection, connect-source, editing, warning
// toast, confirm modals).

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import Canvas from './Canvas'
import CanvasToolbar from './CanvasToolbar'
import AddCardPopover from './AddCardPopover'
import {
  BLUE,
  MUTED,
  monoFont,
  sansFont,
} from './theme'
import {
  canConnect,
  describeConnectionRule,
  toPlacedCard,
} from '../data/flowCards'
import type {
  CanvasCard,
  CanvasState,
  CanvasCardEdit,
  Connection,
  SimCardTemplate,
} from './types'
import type { PortSide } from './CanvasCard'

const EMPTY_CANVAS: CanvasState = { cards: [], connections: [] }

export interface FlowBuilderProps {
  /** Canonical canvas state — owned by the parent. */
  canvas: CanvasState
  onCanvasChange: (next: CanvasState) => void
  /** Canonical flow name — owned by the parent. */
  flowName: string
  onFlowNameChange: (next: string) => void
  /**
   * Optional unsaved-state indicator surfaced as a small badge next to
   * the toolbar (e.g. "Saving…" / "Saved"). When omitted, no badge is
   * rendered (the toolbar stays clean for the in-memory Phase 1 flow).
   */
  saveBadge?: {
    label: string
    tone: 'idle' | 'saving' | 'saved' | 'error'
  }
}

export default function FlowBuilder({
  canvas,
  onCanvasChange,
  flowName,
  onFlowNameChange,
  saveBadge,
}: FlowBuilderProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  // Warning toast auto-dismiss (3s).
  useEffect(() => {
    if (!warning) return
    const t = setTimeout(() => setWarning(null), 3000)
    return () => clearTimeout(t)
  }, [warning])

  // ─── Drag (dnd-kit) ────────────────────────────────────────────────
  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as
      | { placementId?: string; kind?: string }
      | undefined
    if (!data || data.kind !== 'canvas-card' || !data.placementId) return
    const id = data.placementId
    const card = canvas.cards.find((c) => c.placementId === id)
    if (!card) return
    const moved: CanvasCard = {
      ...card,
      // Clamp to non-negative so cards don't drift off the origin.
      x: Math.max(0, card.x + event.delta.x),
      y: Math.max(0, card.y + event.delta.y),
    }
    onCanvasChange({
      ...canvas,
      cards: canvas.cards.map((c) => (c.placementId === id ? moved : c)),
    })
  }

  // ─── Add / delete / edit ──────────────────────────────────────────
  const handleAddTemplate = useCallback((template: SimCardTemplate) => {
    const id = freshId('card')
    // Drop near the centre of the viewport with a small jitter so
    // back-to-back adds don't stack perfectly.
    const jitterX = Math.round((Math.random() - 0.5) * 80)
    const jitterY = Math.round((Math.random() - 0.5) * 60)
    const newCard: CanvasCard = {
      ...toPlacedCard(template, id),
      x: 360 + jitterX,
      y: 220 + jitterY,
      collapsed: false,
    }
    onCanvasChange({ ...canvas, cards: [...canvas.cards, newCard] })
    setSelectedId(id)
    setAddOpen(false)
  }, [canvas, onCanvasChange])

  function handleEditCard(id: string, updates: CanvasCardEdit) {
    onCanvasChange({
      ...canvas,
      cards: canvas.cards.map((c) =>
        c.placementId === id ? { ...c, ...updates } : c,
      ),
    })
    setEditingId(null)
  }

  function handleRequestEdit(id: string) {
    setEditingId(id)
  }

  function handleEditCancel(_id: string) {
    void _id
    setEditingId(null)
  }

  function handleSelectCard(id: string | null) {
    setSelectedId(id)
  }

  // ─── Connect flow ──────────────────────────────────────────────────
  function handlePortClick(placementId: string, side: PortSide) {
    if (side === 'out') {
      // Output port: always (re)set this card as the source. Clicking
      // the same source again toggles it off.
      setConnectFrom((prev) => (prev === placementId ? null : placementId))
      return
    }
    // side === 'in'
    if (!connectFrom) return // nothing to connect to
    if (connectFrom === placementId) return // self-loop is a no-op
    const fromCard = canvas.cards.find((c) => c.placementId === connectFrom)
    const toCard = canvas.cards.find((c) => c.placementId === placementId)
    if (!fromCard || !toCard) return
    if (!canConnect(fromCard.category, toCard.category)) {
      // Keep the source selected so the user can immediately try a
      // different target. Auto-dismiss happens via the warning effect.
      setWarning(describeConnectionRule(toCard.category))
      return
    }
    // No duplicate edges from the same source to the same target — that
    // would visually stack two lines on top of each other and serves no
    // purpose for the strict linear pipeline.
    const duplicate = canvas.connections.find(
      (c) => c.from === connectFrom && c.to === placementId,
    )
    if (duplicate) {
      setConnectFrom(null)
      return
    }
    const connId = freshId('conn')
    const newConn: Connection = {
      id: connId,
      from: connectFrom,
      to: placementId,
    }
    onCanvasChange({
      ...canvas,
      connections: [...canvas.connections, newConn],
    })
    setConnectFrom(null)
  }

  function handleCancelConnect() {
    setConnectFrom(null)
  }

  // ─── Delete / collapse ─────────────────────────────────────────────
  function handleDeleteCard(id: string) {
    onCanvasChange({
      cards: canvas.cards.filter((c) => c.placementId !== id),
      connections: canvas.connections.filter(
        (c) => c.from !== id && c.to !== id,
      ),
    })
    if (selectedId === id) setSelectedId(null)
    if (connectFrom === id) setConnectFrom(null)
  }

  function handleToggleCollapse(id: string) {
    onCanvasChange({
      ...canvas,
      cards: canvas.cards.map((c) =>
        c.placementId === id ? { ...c, collapsed: !c.collapsed } : c,
      ),
    })
  }

  function handleDeleteConnection(id: string) {
    onCanvasChange({
      ...canvas,
      connections: canvas.connections.filter((c) => c.id !== id),
    })
  }

  function handleClearAll() {
    onCanvasChange(EMPTY_CANVAS)
    onFlowNameChange(defaultName())
    setSelectedId(null)
    setConnectFrom(null)
    setEditingId(null)
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: '#f7f7fc',
      }}
    >
      <DndContext onDragEnd={handleDragEnd}>
        <Canvas
          state={canvas}
          selectedId={selectedId}
          connectFrom={connectFrom}
          editingId={editingId}
          onSelectCard={handleSelectCard}
          onDeleteCard={handleDeleteCard}
          onToggleCollapse={handleToggleCollapse}
          onPortClick={handlePortClick}
          onDeleteConnection={handleDeleteConnection}
          onCancelConnect={handleCancelConnect}
          onRequestEdit={handleRequestEdit}
          onEditCard={handleEditCard}
          onEditCancel={handleEditCancel}
        />
      </DndContext>

      <CanvasToolbar
        flowName={flowName}
        cardCount={canvas.cards.length}
        addOpen={addOpen}
        onToggleAdd={() => setAddOpen((v) => !v)}
        onRequestClearAll={() => setClearConfirmOpen(true)}
      />

      <AddCardPopover
        open={addOpen}
        onPick={handleAddTemplate}
        onClose={() => setAddOpen(false)}
      />

      {/* Flow-name editor — sits at top-centre, just below the toolbar. */}
      <FlowNameEditor name={flowName} onChange={onFlowNameChange} />

      {/* Save badge — top-right, mirrored from the toolbar on the left.
          Only renders when the parent supplies `saveBadge`; the in-memory
          Phase 1 flow (no parent save state) leaves the prop off so the
          canvas stays clean. */}
      {saveBadge && <SaveBadge label={saveBadge.label} tone={saveBadge.tone} />}

      {/* Clear All confirm — Phase 1 inline modal. */}
      <AnimatePresence>
        {clearConfirmOpen && (
          <ConfirmPanel
            title="Clear all cards?"
            message="All cards and connections will be removed. This can't be undone."
            confirmLabel="Clear"
            onConfirm={() => {
              handleClearAll()
              setClearConfirmOpen(false)
            }}
            onCancel={() => setClearConfirmOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Warning toast (e.g. invalid connection). */}
      <AnimatePresence>
        {warning && (
          <motion.div
            key="warning-toast"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '0 18px',
              height: 32,
              background: 'rgba(200,48,48,0.10)',
              border: '1px solid #c83030',
              borderRadius: 16,
              color: '#c83030',
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 110,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              maxWidth: '80%',
            }}
          >
            {warning}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────

// Save-state badge — top-right corner of the canvas. Tone colour matches
// the `tone` prop. Kept tiny so it doesn't compete with the toolbar.
const BADGE_COLORS: Record<
  'idle' | 'saving' | 'saved' | 'error',
  { bg: string; fg: string; border: string }
> = {
  idle:   { bg: '#f4f4fa', fg: MUTED,  border: '#e0e0f0' },
  saving: { bg: 'rgba(20,90,200,0.10)', fg: BLUE,  border: BLUE },
  saved:  { bg: 'rgba(40,160,90,0.10)',  fg: '#1a8c4a', border: '#1a8c4a' },
  error:  { bg: 'rgba(200,48,48,0.10)',  fg: '#c83030', border: '#c83030' },
}

function SaveBadge({
  label,
  tone,
}: {
  label: string
  tone: 'idle' | 'saving' | 'saved' | 'error'
}) {
  const c = BADGE_COLORS[tone]
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 100,
        height: 30,
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: c.bg,
        border: '1px solid ' + c.border,
        borderRadius: 6,
        color: c.fg,
        fontFamily: monoFont,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        boxShadow: '0 4px 14px rgba(10,10,92,0.06)',
      }}
    >
      {label}
    </div>
  )
}

function FlowNameEditor({
  name,
  onChange,
}: {
  name: string
  onChange: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  // Keep the draft in sync if the parent's name changes externally
  // (e.g. after Clear All resets to a default).
  useEffect(() => {
    if (!editing) setDraft(name)
  }, [name, editing])

  function commit() {
    const next = draft.trim() === '' ? name : draft.trim()
    setDraft(next)
    onChange(next)
    setEditing(false)
  }

  if (editing) {
    return (
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
            setDraft(name)
            setEditing(false)
          }
        }}
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          height: 30,
          padding: '0 14px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid ' + BLUE,
          borderRadius: 6,
          fontFamily: sansFont,
          fontSize: 14,
          fontWeight: 700,
          color: '#0a0a5c',
          outline: 'none',
          boxShadow: '0 4px 14px rgba(10,10,92,0.10)',
          minWidth: 220,
          textAlign: 'center',
        }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
      title="Click to rename"
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        height: 30,
        padding: '0 14px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid #e0e0f0',
        borderRadius: 6,
        fontFamily: sansFont,
        fontSize: 14,
        fontWeight: 700,
        color: '#0a0a5c',
        cursor: 'text',
        boxShadow: '0 4px 14px rgba(10,10,92,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        style={{
          fontFamily: monoFont,
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: MUTED,
          fontWeight: 700,
        }}
      >
        Untitled draft ·
      </span>
      <span>{name}</span>
    </button>
  )
}

interface ConfirmPanelProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}

function ConfirmPanel({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = true,
}: ConfirmPanelProps) {
  return (
    <>
      {/* Backdrop — clicking cancels. */}
      <motion.div
        key="confirm-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10,10,92,0.32)',
          zIndex: 250,
        }}
      />
      <motion.div
        key="confirm-card"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 380,
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 20px 50px rgba(10,10,92,0.22)',
          padding: '20px 22px',
          zIndex: 260,
          fontFamily: sansFont,
        }}
      >
        <p
          style={{
            fontFamily: monoFont,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: destructive ? '#c83030' : BLUE,
            margin: 0,
            marginBottom: 6,
            fontWeight: 700,
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontFamily: sansFont,
            fontSize: 13,
            color: '#0a0a5c',
            lineHeight: 1.45,
            margin: 0,
            marginBottom: 18,
          }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: 32,
              padding: '0 14px',
              background: 'transparent',
              border: '1px solid #e0e0f0',
              borderRadius: 6,
              fontFamily: monoFont,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#0a0a5c',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              height: 32,
              padding: '0 14px',
              background: destructive ? '#c83030' : BLUE,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontFamily: monoFont,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function freshId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return prefix + '-' + crypto.randomUUID()
  }
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
}

function defaultName(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `Flow · ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}