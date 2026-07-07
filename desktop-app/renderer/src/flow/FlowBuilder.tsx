import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import Canvas from './Canvas'
import CanvasToolbar from './CanvasToolbar'
import AddCardPopover from './AddCardPopover'
import { BLUE, MUTED, NAVY, monoFont, sansFont } from './theme'
import { canConnect, describeConnectionRule, shortPartyId, toPlacedCard } from './flowCards'
import type { CanvasCard, CanvasState, CanvasCardEdit, Connection, SimCardTemplate } from './types'
import type { PortSide } from './CanvasCard'
import { useEmployees } from '../context/EmployeeContext'
import { useWallet } from '../context/WalletContext'
import { useCompany } from '../context/CompanyContext'

type PaymentTemplate = { id: string; name: string; withholdingRate: string; defaultMemo: string; createdAt: string; updatedAt: string }

export interface FlowBuilderProps {
  canvas: CanvasState
  onCanvasChange: (next: CanvasState) => void
  flowName: string
  onFlowNameChange: (next: string) => void
  flowId: string
  onRequestPreview: () => void
  saveBadge?: { label: string; tone: 'idle' | 'saving' | 'saved' | 'error' }
  locked?: boolean
  zoom?: number
  onZoomChange?: (z: number) => void
  addCardOpen?: boolean
  onAddCardToggle?: () => void
  onAddCardClose?: () => void
}

export default function FlowBuilder({ canvas, onCanvasChange, flowName, onFlowNameChange, flowId, onRequestPreview, saveBadge, locked = false, zoom: zoomProp, onZoomChange, addCardOpen: addCardOpenProp, onAddCardToggle, onAddCardClose }: FlowBuilderProps) {
  const { employees } = useEmployees()
  const { status: walletStatus, loadStatus: walletLoadStatus } = useWallet()
  const { profile: companyProfile } = useCompany()
  const walletReady = walletLoadStatus === 'present' && !!walletStatus?.partyId
  const walletPartyId = walletStatus?.partyId ?? ''
  const hasEmployees = employees.length > 0
  const paymentTemplates: PaymentTemplate[] = (companyProfile as any)?.paymentTemplates ?? []

  // Use prop-controlled state when provided, otherwise use local state
  const [localAddOpen, setLocalAddOpen] = useState(false)
  const addOpen = addCardOpenProp !== undefined ? addCardOpenProp : localAddOpen
  const setAddOpen = onAddCardToggle ? onAddCardToggle : setLocalAddOpen

  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => { if (locked) { setAddOpen(false); setConnectFrom(null); setSelectedId(null); setEditingId(null); setWarning(null) } }, [locked])
  useEffect(() => { if (!warning) return; const t = setTimeout(() => setWarning(null), 3000); return () => clearTimeout(t) }, [warning])

  function handleDragEnd(event: DragEndEvent) {
    if (locked) return
    const data = event.active.data.current as { placementId?: string; kind?: string } | undefined
    if (!data || data.kind !== 'canvas-card' || !data.placementId) return
    const id = data.placementId
    const card = canvas.cards.find((c) => c.placementId === id)
    if (!card) return
    const moved: CanvasCard = { ...card, x: Math.max(0, card.x + event.delta.x), y: Math.max(0, card.y + event.delta.y) }
    onCanvasChange({ ...canvas, cards: canvas.cards.map((c) => (c.placementId === id ? moved : c)) })
  }

  const handleAddTemplate = useCallback((template: SimCardTemplate) => {
    if (locked) return
    const id = freshId('card')
    const jitterX = Math.round((Math.random() - 0.5) * 80)
    const jitterY = Math.round((Math.random() - 0.5) * 60)
    const placed = toPlacedCard(template, id)
    const sourceFields = placed.category === 'source' ? { ...(placed.sourceFields ?? { partyId: '' }), partyId: walletPartyId } : placed.sourceFields
    const title = placed.category === 'source' ? (walletPartyId ? shortPartyId(walletPartyId) : 'Source') : placed.title
    const newCard: CanvasCard = { ...placed, title, ...(sourceFields ? { sourceFields } : {}), x: 360 + jitterX, y: 220 + jitterY, collapsed: false }
    onCanvasChange({ ...canvas, cards: [...canvas.cards, newCard] })
    setSelectedId(id)
    setAddOpen(false)
  }, [canvas, onCanvasChange, walletPartyId, locked])

  function handleEditCard(id: string, updates: CanvasCardEdit) { if (locked) return; onCanvasChange({ ...canvas, cards: canvas.cards.map((c) => c.placementId === id ? { ...c, ...updates } : c) }); setEditingId(null) }
  function handleRequestEdit(id: string) { if (locked) return; setEditingId(id) }
  function handleEditCancel(_id: string) { void _id; setEditingId(null) }
  function handleSelectCard(id: string | null) { if (locked) { setSelectedId(null); return }; setSelectedId(id) }

  function handlePortClick(placementId: string, side: PortSide) {
    if (locked) return
    if (side === 'out') { setConnectFrom((prev) => (prev === placementId ? null : placementId)); return }
    if (!connectFrom) return
    if (connectFrom === placementId) return
    const fromCard = canvas.cards.find((c) => c.placementId === connectFrom)
    const toCard = canvas.cards.find((c) => c.placementId === placementId)
    if (!fromCard || !toCard) return
    if (!canConnect(fromCard.category, toCard.category)) { setWarning(describeConnectionRule(toCard.category)); return }
    const duplicate = canvas.connections.find((c) => c.from === connectFrom && c.to === placementId)
    if (duplicate) { setConnectFrom(null); return }
    const connId = freshId('conn')
    const newConn: Connection = { id: connId, from: connectFrom, to: placementId }
    onCanvasChange({ ...canvas, connections: [...canvas.connections, newConn] })
    setConnectFrom(null)
  }

  function handleCancelConnect() { setConnectFrom(null) }
  function handleDeleteCard(id: string) { if (locked) return; onCanvasChange({ cards: canvas.cards.filter((c) => c.placementId !== id), connections: canvas.connections.filter((c) => c.from !== id && c.to !== id) }); if (selectedId === id) setSelectedId(null); if (connectFrom === id) setConnectFrom(null) }
  function handleToggleCollapse(id: string) { if (locked) return; onCanvasChange({ ...canvas, cards: canvas.cards.map((c) => c.placementId === id ? { ...c, collapsed: !c.collapsed } : c) }) }
  function handleDeleteConnection(id: string) { if (locked) return; onCanvasChange({ ...canvas, connections: canvas.connections.filter((c) => c.id !== id) }) }

  const isControlled = zoomProp !== undefined || addCardOpenProp !== undefined

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f7f7fc' }}>
      <DndContext onDragEnd={handleDragEnd}>
        <Canvas state={canvas} selectedId={selectedId} connectFrom={connectFrom} editingId={editingId} flowId={flowId} employees={employees} walletReady={walletReady} paymentTemplates={paymentTemplates} locked={locked} onSelectCard={handleSelectCard} onDeleteCard={handleDeleteCard} onToggleCollapse={handleToggleCollapse} onPortClick={handlePortClick} onDeleteConnection={handleDeleteConnection} onCancelConnect={handleCancelConnect} onRequestEdit={handleRequestEdit} onEditCard={handleEditCard} onEditCancel={handleEditCancel} zoom={zoomProp} onZoomChange={onZoomChange} />
      </DndContext>
      {!isControlled && !locked && <CanvasToolbar flowName={flowName} addOpen={addOpen} onToggleAdd={() => setAddOpen(!addOpen)} onRequestPreview={onRequestPreview} onNameChange={onFlowNameChange} />}
      {!locked && <AddCardPopover open={addOpen} hasWallet={walletReady} walletPartyId={walletPartyId} hasEmployees={hasEmployees} employees={employees} paymentTemplates={paymentTemplates} onPick={handleAddTemplate} onClose={onAddCardClose || (() => setAddOpen(false))} />}
      {!isControlled && !locked && saveBadge && <SaveBadge label={saveBadge.label} tone={saveBadge.tone} />}
      {locked && <LockedOverlay />}
      <AnimatePresence>
        {warning && <motion.div key="warning-toast" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '0 18px', height: 32, background: 'rgba(200,48,48,0.10)', border: '1px solid #c83030', borderRadius: 16, color: '#c83030', fontFamily: monoFont, fontSize: 11, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, pointerEvents: 'none', whiteSpace: 'nowrap', maxWidth: '80%' }}>{warning}</motion.div>}
      </AnimatePresence>
    </div>
  )
}

function LockedBanner({ flowName }: { flowName: string }) {
  return <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 105, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: 'rgba(26,26,232,0.06)', border: '1px solid rgba(26,26,232,0.18)', borderRadius: 8, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 14px rgba(10,10,92,0.06)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase' }}>Flow Builder</span>
      <span style={{ fontFamily: sansFont, fontSize: 14, fontWeight: 700, color: NAVY, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={flowName}>{flowName.trim() ? flowName : 'Untitled flow'}</span>
    </div>
    <span style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: '#fff', background: BLUE, padding: '4px 10px', borderRadius: 12, flexShrink: 0 }}>Active · editing locked</span>
  </div>
}

function LockedOverlay() { return <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(10,10,92,0.04)', zIndex: 90, cursor: 'not-allowed' }} /> }

const BADGE_COLORS: Record<'idle' | 'saving' | 'saved' | 'error', { bg: string; fg: string; border: string }> = { idle: { bg: 'rgba(255,255,255,0.92)', fg: MUTED, border: '#e0e0f0' }, saving: { bg: 'rgba(255,255,255,0.92)', fg: BLUE, border: '#cfd2ec' }, saved: { bg: 'rgba(255,255,255,0.92)', fg: MUTED, border: '#e0e0f0' }, error: { bg: 'rgba(200,48,48,0.10)', fg: '#c83030', border: '#c83030' } }

function SaveBadge({ label, tone }: { label: string; tone: 'idle' | 'saving' | 'saved' | 'error' }) {
  const c = BADGE_COLORS[tone]
  return <div role="status" aria-live="polite" style={{ position: 'absolute', top: 16, right: 16, zIndex: 100, height: 30, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, background: c.bg, border: '1px solid ' + c.border, borderRadius: 6, color: c.fg, fontFamily: monoFont, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', boxShadow: '0 4px 14px rgba(10,10,92,0.06)' }}>{label}</div>
}

function freshId(prefix: string): string { if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return prefix + '-' + crypto.randomUUID(); return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) }
