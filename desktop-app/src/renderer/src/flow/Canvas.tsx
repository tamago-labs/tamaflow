// The free-form 2D canvas surface for the payroll flow builder.
//
// Ported from my-doctor-ai's Canvas.tsx and adapted for TamaFlow's
// categories (Source / Payee / Transfer). Behaviour:
// - Mouse wheel zooms (anchored at the cursor)
// - Left/right/middle-mouse drag pans
// - Click on empty surface clears selection
// - Esc cancels an in-flight connect
// - Delete/Backspace removes the selected card

import { useCallback, useEffect, useRef, useState } from 'react'
import { BLUE, BORDER, LIGHT_BLUE, MUTED, monoFont } from './theme'
import CanvasCard, { type PortSide } from './CanvasCard'
import CanvasLines from './CanvasLines'
import type { CanvasCardEdit, CanvasState } from './types'
import type { Employee, PaymentTemplate } from '../../../preload/index.d'

interface CanvasProps {
  state: CanvasState
  selectedId: string | null
  /** placementId of the card currently in connect-source mode, if any. */
  connectFrom: string | null
  /** placementId of the card currently in inline-edit mode, if any. */
  editingId: string | null
  /**
   * Flow id — forwarded to each card so the LastPaidSection can query
   * the right per-flow routes. Empty when the canvas is rendered
   * without a backing flow (e.g. during a brand-new draft preview).
   */
  flowId: string
  /** Roster forwarded to CanvasCard for Payee employeeId → Employee lookup. */
  employees: Employee[]
  /** Whether the desktop wallet is loaded. Drives Source card warnings. */
  walletReady: boolean
  /**
   * User-defined payment templates — forwarded to CanvasCard so Payment
   * cards can show a stale-template warning when their templateId no
   * longer resolves to an entry in this list.
   */
  paymentTemplates: PaymentTemplate[]
  /**
   * Read-only mode — the flow is active. Cards ignore clicks (overlay
   * covers them), keyboard shortcuts for delete are disabled, and the
   * connect-source banner is suppressed. The canvas still renders so
   * the user can see what the flow looks like.
   */
  locked?: boolean
  onSelectCard: (id: string | null) => void
  onDeleteCard: (id: string) => void
  onToggleCollapse: (id: string) => void
  onPortClick: (placementId: string, side: PortSide) => void
  onDeleteConnection: (id: string) => void
  onCancelConnect: () => void
  onRequestEdit: (id: string) => void
  onEditCard: (id: string, updates: CanvasCardEdit) => void
  onEditCancel: (id: string) => void
}

const ZOOM_MIN = 0.25
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1

export default function Canvas({
  state,
  selectedId,
  connectFrom,
  editingId,
  flowId,
  employees,
  walletReady,
  paymentTemplates,
  locked = false,
  onSelectCard,
  onDeleteCard,
  onToggleCollapse,
  onPortClick,
  onDeleteConnection,
  onCancelConnect,
  onRequestEdit,
  onEditCard,
  onEditCancel,
}: CanvasProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ panX: 0, panY: 0, mouseX: 0, mouseY: 0, button: 0 })

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (connectFrom) {
          e.preventDefault()
          onCancelConnect()
        }
        return
      }
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      // Locked flows: keyboard delete/connect are no-ops; the user must
      // stop the flow first to edit.
      if (locked) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && selectedId !== editingId) {
        e.preventDefault()
        onDeleteCard(selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [connectFrom, selectedId, editingId, onCancelConnect, onDeleteCard, locked])

  // Wheel zoom — must be a native passive:false listener so we can
  // preventDefault and stop the page from scrolling.
  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return

    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = surface!.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      const worldX = (cursorX - pan.x) / zoom
      const worldY = (cursorY - pan.y) / zoom
      const factor = Math.exp(-e.deltaY * 0.0015)
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor))
      setPan({
        x: cursorX - worldX * newZoom,
        y: cursorY - worldY * newZoom,
      })
      setZoom(newZoom)
    }

    surface.addEventListener('wheel', handleWheel, { passive: false })
    return () => surface.removeEventListener('wheel', handleWheel)
  }, [pan, zoom])

  // Drag pans the world. We attach window-level listeners for move/up
  // so the user can drag outside the canvas without losing the gesture.
  useEffect(() => {
    if (!isPanning) return
    function onMove(e: MouseEvent) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.mouseX),
        y: panStart.current.panY + (e.clientY - panStart.current.mouseY),
      })
    }
    function onUp(e: MouseEvent) {
      if (e.button === panStart.current.button) setIsPanning(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isPanning])

  const handleSurfaceMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target
      const onEmpty =
        target === surfaceRef.current || target === worldRef.current
      const shouldPan =
        e.button === 1 || e.button === 2 || (e.button === 0 && onEmpty)
      if (!shouldPan) return
      e.preventDefault()
      panStart.current = {
        panX: pan.x,
        panY: pan.y,
        mouseX: e.clientX,
        mouseY: e.clientY,
        button: e.button,
      }
      setIsPanning(true)
      if (e.button === 0 && onEmpty) onSelectCard(null)
    },
    [pan.x, pan.y, onSelectCard],
  )

  function zoomBy(delta: number) {
    setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + delta)))
  }

  function resetView() {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

  const worldTransform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`

  return (
    <div
      ref={surfaceRef}
      onMouseDown={handleSurfaceMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: LIGHT_BLUE,
        backgroundImage:
          'radial-gradient(circle, #d0d0e8 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        cursor: isPanning ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    >
      <div
        ref={worldRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          transform: worldTransform,
          transformOrigin: '0 0',
        }}
      >
        {state.cards.length === 0 && !connectFrom && <EmptyHint />}

        {/* Lines are rendered first so cards sit visually on top. */}
        <CanvasLines
          connections={state.connections}
          cards={state.cards}
          cardRefs={cardRefs.current}
          onDeleteConnection={onDeleteConnection}
        />

        {state.cards.map((card) => (
          <CanvasCard
            key={card.placementId}
            card={card}
            selected={selectedId === card.placementId}
            isConnectSource={connectFrom === card.placementId}
            editing={editingId === card.placementId}
            flowId={flowId}
            employees={employees}
            walletReady={walletReady}
            paymentTemplates={paymentTemplates}
            locked={locked}
            onSelect={onSelectCard}
            onDelete={onDeleteCard}
            onToggleCollapse={onToggleCollapse}
            onPortClick={onPortClick}
            onRequestEdit={onRequestEdit}
            onEdit={onEditCard}
            onEditCancel={onEditCancel}
            ref={(el) => {
              cardRefs.current[card.placementId] = el
            }}
          />
        ))}
      </div>

      {connectFrom && !locked && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '0 18px',
            height: 32,
            background: 'rgba(26,26,232,0.08)',
            border: '1px solid ' + BLUE,
            borderRadius: 16,
            color: BLUE,
            fontFamily: monoFont,
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 95,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Click a port to draw a line — Esc to cancel
        </div>
      )}

      <ZoomBadge
        zoom={zoom}
        onZoomIn={() => zoomBy(+ZOOM_STEP)}
        onZoomOut={() => zoomBy(-ZOOM_STEP)}
        onReset={resetView}
      />
    </div>
  )
}

function ZoomBadge({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 6px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid ' + BORDER,
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(10,10,92,0.06)',
        zIndex: 60,
        fontFamily: monoFont,
        fontSize: 10,
        color: MUTED,
        userSelect: 'none',
      }}
    >
      <ZoomButton onClick={onZoomOut} label="Zoom out">−</ZoomButton>
      <span
        style={{
          fontFamily: monoFont,
          fontSize: 10,
          color: BLUE,
          fontWeight: 700,
          minWidth: 40,
          textAlign: 'center',
          letterSpacing: '0.06em',
        }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <ZoomButton onClick={onZoomIn} label="Zoom in">+</ZoomButton>
      <span style={{ width: 1, height: 16, background: BORDER, margin: '0 2px' }} />
      <button
        type="button"
        onClick={onReset}
        title="Reset view"
        style={{
          height: 22,
          padding: '0 8px',
          background: 'transparent',
          border: 'none',
          borderRadius: 4,
          color: MUTED,
          fontFamily: monoFont,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Reset
      </button>
    </div>
  )
}

function ZoomButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width: 22,
        height: 22,
        padding: 0,
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        color: MUTED,
        fontFamily: monoFont,
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

function EmptyHint() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 360,
        top: 220,
        maxWidth: 460,
        padding: 24,
        fontFamily: monoFont,
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#a5a5c4',
        lineHeight: 1.7,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#7a7aa0' }}>
        Empty canvas
      </div>
      Click + Add Card to add cards, drag them around, then
      connect their ports to build a payroll flow.
    </div>
  )
}