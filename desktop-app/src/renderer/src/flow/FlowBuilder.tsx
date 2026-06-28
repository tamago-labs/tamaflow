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
} from './theme'
import {
  canConnect,
  describeConnectionRule,
  shortPartyId,
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
import { useEmployees } from '../context/EmployeeContext'
import { useWallet } from '../context/WalletContext'

export interface FlowBuilderProps {
  /** Canonical canvas state — owned by the parent. */
  canvas: CanvasState
  onCanvasChange: (next: CanvasState) => void
  /** Canonical flow name — owned by the parent. */
  flowName: string
  onFlowNameChange: (next: string) => void
  /**
   * Opens the outcomes preview modal owned by the parent. The toolbar's
   * "Preview" button calls this; the modal itself lives outside the
   * canvas so it can stay centred over the full viewport.
   */
  onRequestPreview: () => void
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
  onRequestPreview,
  saveBadge,
}: FlowBuilderProps) {
  const { employees } = useEmployees()
  const { status: walletStatus, loadStatus: walletLoadStatus } = useWallet()
  const walletReady = walletLoadStatus === 'present' && !!walletStatus?.partyId
  const walletPartyId = walletStatus?.partyId ?? ''
  const hasEmployees = employees.length > 0

  const [addOpen, setAddOpen] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

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
    const placed = toPlacedCard(template, id)
    // Snapshot the current wallet party id into the Source card's
    // sourceFields at the moment of creation. The palette seed leaves
    // partyId empty so this is the one place the live wallet state
    // gets baked into the card.
    const sourceFields =
      placed.category === 'source'
        ? {
            ...(placed.sourceFields ?? { partyId: '' }),
            partyId: walletPartyId,
          }
        : placed.sourceFields
    // Source title defaults to the wallet identity (shortPartyId) so the
    // card immediately shows which wallet funds originate from instead
    // of a "Treasury Wallet" placeholder. User can rename freely. Payee
    // titles already come from the employee displayName via the palette.
    const title =
      placed.category === 'source'
        ? walletPartyId
          ? shortPartyId(walletPartyId)
          : 'Source'
        : placed.title
    const newCard: CanvasCard = {
      ...placed,
      title,
      ...(sourceFields ? { sourceFields } : {}),
      x: 360 + jitterX,
      y: 220 + jitterY,
      collapsed: false,
    }
    onCanvasChange({ ...canvas, cards: [...canvas.cards, newCard] })
    setSelectedId(id)
    setAddOpen(false)
  }, [canvas, onCanvasChange, walletPartyId])

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
          employees={employees}
          walletReady={walletReady}
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
        addOpen={addOpen}
        onToggleAdd={() => setAddOpen((v) => !v)}
        onRequestPreview={onRequestPreview}
        onNameChange={onFlowNameChange}
      />

      <AddCardPopover
        open={addOpen}
        hasWallet={walletReady}
        walletPartyId={walletPartyId}
        hasEmployees={hasEmployees}
        employees={employees}
        onPick={handleAddTemplate}
        onClose={() => setAddOpen(false)}
      />

      {/* Save badge — top-right, mirrored from the toolbar on the left.
          Only renders when the parent supplies `saveBadge`; the in-memory
          Phase 1 flow (no parent save state) leaves the prop off so the
          canvas stays clean. */}
      {saveBadge && <SaveBadge label={saveBadge.label} tone={saveBadge.tone} />}

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
  // White background matches the bottom-right cluster buttons (Save,
  // Preview Outcomes, Delete, Active Flows). Saving keeps a blue text
  // accent so the user can still see progress at a glance; idle/saved
  // use muted text since they're "nothing happening" states.
  idle:   { bg: 'rgba(255,255,255,0.92)', fg: MUTED,    border: '#e0e0f0' },
  saving: { bg: 'rgba(255,255,255,0.92)', fg: BLUE,     border: '#cfd2ec' },
  saved:  { bg: 'rgba(255,255,255,0.92)', fg: MUTED,    border: '#e0e0f0' },
  error:  { bg: 'rgba(200,48,48,0.10)',   fg: '#c83030', border: '#c83030' },
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

// ─── Helpers ─────────────────────────────────────────────────────────

function freshId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return prefix + '-' + crypto.randomUUID()
  }
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
}