import { forwardRef, useEffect, useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { BLUE, BORDER, MUTED, NAVY, TEAL, monoFont, sansFont } from './theme'
import { CATEGORY_PREFIX, TONE_COLORS, cardHasInput, cardHasOutput, shortPartyId } from './flowCards'
import type { CanvasCard as CanvasCardType, CanvasCardEdit, PayeeFields, PaymentFields, SourceFields } from './types'
import type { Employee } from '../ai/types'
import EditForm from './EditForm'

type PaymentTemplate = { id: string; name: string; withholdingRate: string; defaultMemo: string; createdAt: string; updatedAt: string }

export type PortSide = 'in' | 'out'

interface CanvasCardProps {
  card: CanvasCardType
  selected: boolean
  isConnectSource: boolean
  editing: boolean
  employees: Employee[]
  walletReady: boolean
  paymentTemplates: PaymentTemplate[]
  locked?: boolean
  onSelect: (placementId: string) => void
  onDelete: (placementId: string) => void
  onToggleCollapse: (placementId: string) => void
  onPortClick: (placementId: string, side: PortSide) => void
  onRequestEdit: (placementId: string) => void
  onEdit: (placementId: string, updates: CanvasCardEdit) => void
  onEditCancel: (placementId: string) => void
}

export const CARD_WIDTH = 240
const COLLAPSED_HEIGHT = 44
const EXPANDED_HEIGHTS: Record<CanvasCardType['category'], number> = { source: 110, payee: 120, payment: 110 }
const EDIT_HEIGHT = 360

const CanvasCard = forwardRef<HTMLDivElement, CanvasCardProps>(function CanvasCard({ card, selected, isConnectSource, editing, employees, walletReady, paymentTemplates, locked = false, onSelect, onDelete, onToggleCollapse, onPortClick, onRequestEdit, onEdit, onEditCancel }, _ref) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: 'card-' + card.placementId, data: { placementId: card.placementId, kind: 'canvas-card' }, disabled: editing || locked })

  const [draftTitle, setDraftTitle] = useState(card.title)
  const [draftSource, setDraftSource] = useState<SourceFields>(card.sourceFields ?? { partyId: '' })
  const [draftPayee, setDraftPayee] = useState<PayeeFields>(card.payeeFields ?? { employeeId: '' })
  const [draftPayment, setDraftPayment] = useState<PaymentFields>(card.paymentFields ?? {})

  useEffect(() => { if (editing) { setDraftTitle(card.title); setDraftSource(card.sourceFields ?? { partyId: '' }); setDraftPayee(card.payeeFields ?? { employeeId: '' }); setDraftPayment(card.paymentFields ?? {}) } }, [editing, card.title, card.sourceFields, card.payeeFields, card.paymentFields])

  function handleSave() {
    const nextTitle = draftTitle.trim() === '' ? card.title : draftTitle
    const update: CanvasCardEdit = { title: nextTitle }
    if (card.category === 'source') update.sourceFields = pruneEmpty(draftSource)
    if (card.category === 'payee') update.payeeFields = pruneEmpty(draftPayee)
    if (card.category === 'payment') update.paymentFields = pruneEmpty(draftPayment)
    onEdit(card.placementId, update)
  }

  function handleBodyDoubleClick(e: React.MouseEvent) { if (editing || locked) return; if ((e.target as HTMLElement).closest('[data-card-action],[data-card-port]')) return; e.stopPropagation(); onRequestEdit(card.placementId) }
  function handleEditKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); handleSave() } else if (e.key === 'Escape') { e.preventDefault(); onEditCancel(card.placementId) } }

  const accent = TONE_COLORS[card.tone ?? 'muted']
  const height = card.collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHTS[card.category] ?? 140
  const hasInput = cardHasInput(card.category)
  const hasOutput = cardHasOutput(card.category)

  const style: React.CSSProperties = {
    position: 'absolute', left: card.x, top: card.y, width: CARD_WIDTH, minHeight: editing ? EDIT_HEIGHT : height,
    background: '#fff', border: '1px solid ' + (selected || isConnectSource || editing ? BLUE : BORDER), borderLeft: '3px solid ' + accent,
    borderRadius: 8, boxShadow: isDragging ? '0 10px 24px rgba(10,10,92,0.18)' : selected || isConnectSource || editing ? '0 0 0 3px rgba(26,26,232,0.12)' : '0 1px 2px rgba(10,10,92,0.04)',
    boxSizing: 'border-box', padding: editing ? '10px 12px 10px 14px' : card.collapsed ? '0 12px' : '10px 12px 10px 14px',
    cursor: editing ? 'default' : isDragging ? 'grabbing' : 'grab', transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : 'box-shadow 0.12s ease, border-color 0.12s ease', userSelect: editing ? 'text' : 'none',
    zIndex: isDragging ? 100 : selected || editing ? 5 : 1, overflow: 'visible',
  }

  function handleBodyClick(e: React.MouseEvent) { if ((e.target as HTMLElement).closest('[data-card-action],[data-card-port]')) return; if (editing || locked) return; onSelect(card.placementId) }

  return (
    <div ref={setNodeRef} style={style} onClick={handleBodyClick} onDoubleClick={handleBodyDoubleClick} {...(editing || locked ? {} : listeners)} {...attributes}>
      {editing ? (
        <EditForm card={card} title={draftTitle} source={draftSource} payee={draftPayee} payment={draftPayment} employees={employees} walletReady={walletReady} paymentTemplate={resolvePaymentTemplate(card, paymentTemplates)} onTitleChange={setDraftTitle} onPaymentChange={setDraftPayment} onSave={handleSave} onCancel={() => onEditCancel(card.placementId)} onKeyDown={handleEditKeyDown} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: card.collapsed ? 'center' : 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {card.collapsed ? (
                <span style={{ fontFamily: sansFont, fontSize: 13, fontWeight: 600, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', lineHeight: '24px' }}>{card.title}</span>
              ) : (
                <>
                  <div style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: accent, color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>{CATEGORY_PREFIX[card.category]}</span>
                  </div>
                  <div style={{ fontFamily: sansFont, fontSize: 13, fontWeight: 600, color: NAVY, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignSelf: 'flex-start' }}>
              <ActionButton label={card.collapsed ? 'Expand' : 'Collapse'} onClick={(e) => { e.stopPropagation(); onToggleCollapse(card.placementId) }} iconOnly>{card.collapsed ? '+' : '−'}</ActionButton>
              <ActionButton label="Delete" onClick={(e) => { e.stopPropagation(); onDelete(card.placementId) }} danger iconOnly>×</ActionButton>
            </div>
          </div>
          {!card.collapsed && <CardBody card={card} employees={employees} walletReady={walletReady} paymentTemplates={paymentTemplates} />}
          {hasInput && <Port side="in" active={isConnectSource} color={BLUE} onClick={() => onPortClick(card.placementId, 'in')} />}
          {hasOutput && <Port side="out" active={isConnectSource} color={TEAL} onClick={() => onPortClick(card.placementId, 'out')} />}
        </>
      )}
    </div>
  )
})

export default CanvasCard

function resolvePaymentTemplate(card: CanvasCardType, paymentTemplates: PaymentTemplate[]): PaymentTemplate | null {
  if (card.category !== 'payment') return null
  const tid = card.paymentFields?.templateId
  if (!tid) return null
  return paymentTemplates.find((t) => t.id === tid) ?? null
}

function CardBody({ card, employees, walletReady, paymentTemplates }: { card: CanvasCardType; employees: Employee[]; walletReady: boolean; paymentTemplates: PaymentTemplate[] }) {
  if (card.category === 'source') return <SourceBody card={card} walletReady={walletReady} />
  if (card.category === 'payee') return <PayeeBody card={card} employees={employees} />
  return <PaymentBody card={card} paymentTemplates={paymentTemplates} />
}

function SourceBody({ card, walletReady }: { card: CanvasCardType; walletReady: boolean }) {
  const partyId = card.sourceFields?.partyId?.trim() ?? ''
  if (!partyId) return <div style={{ marginTop: 8 }}><BodyMuted>{walletReady ? 'No wallet set on this card' : 'No wallet set up — create one in Assets'}</BodyMuted></div>
  return <div style={{ marginTop: 8 }}><BodyField label="Party ID"><BodyMono>{shortPartyId(partyId)}</BodyMono></BodyField></div>
}

function PayeeBody({ card, employees }: { card: CanvasCardType; employees: Employee[] }) {
  const employeeId = card.payeeFields?.employeeId?.trim() ?? ''
  if (!employeeId) return <div style={{ marginTop: 8 }}><BodyMuted danger>No employee selected — double-click to bind</BodyMuted></div>
  const emp = employees.find((e) => e.id === employeeId)
  if (!emp) return <div style={{ marginTop: 8 }}><BodyMuted danger>Employee not found (id: {employeeId})</BodyMuted></div>
  const countryLabel = emp.country ?? '?'
  const currencyLabel = emp.payCurrency ?? '?'
  const salaryLine = (() => {
    if (emp.payFrequency === 'hourly' && emp.hourlyRate) return `${emp.hourlyRate} ${currencyLabel} / hr · 160 hrs`
    if (emp.salaryAmount) { const period = emp.payFrequency === 'biweekly' ? '/ biweekly' : emp.payFrequency === 'weekly' ? '/ week' : emp.payFrequency === 'one-off' ? 'one-off' : '/ month'; return `${emp.salaryAmount} ${currencyLabel} ${period}` }
    return `— ${currencyLabel}`
  })()
  return <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}><BodyMono>{salaryLine}</BodyMono><BodyMuted>{countryLabel}</BodyMuted></div>
}

function PaymentBody({ card, paymentTemplates }: { card: CanvasCardType; paymentTemplates: PaymentTemplate[] }) {
  const memo = card.paymentFields?.memo?.trim() ?? ''
  const templateId = card.paymentFields?.templateId
  const template = templateId ? paymentTemplates.find((t) => t.id === templateId) ?? null : null
  const isStale = !!templateId && template === null
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <BodyField label="Memo">{memo ? <BodyMono>{memo}</BodyMono> : <BodyMuted>— uses template default —</BodyMuted>}</BodyField>
      {isStale && <BodyMuted danger>Template deleted — falling back to Direct Payment</BodyMuted>}
    </div>
  )
}

function BodyField({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}><div style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED }}>{label}</div><div>{children}</div></div> }
function BodyMono({ children }: { children: React.ReactNode }) { return <div style={{ fontFamily: monoFont, fontSize: 10, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</div> }
function BodyMuted({ children, danger }: { children: React.ReactNode; danger?: boolean }) { return <div style={{ fontFamily: monoFont, fontSize: 9, color: danger ? '#c83030' : MUTED, letterSpacing: '0.04em' }}>{children}</div> }

function ActionButton({ label, onClick, danger, iconOnly, children }: { label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; iconOnly?: boolean; children?: React.ReactNode }) {
  return <button type="button" data-card-action="1" title={label} aria-label={label} onClick={onClick} onPointerDown={(e) => e.stopPropagation()} style={{ width: iconOnly ? 22 : 'auto', height: 22, padding: iconOnly ? 0 : '0 8px', background: 'transparent', border: 'none', borderRadius: 4, color: danger ? '#c83030' : MUTED, fontFamily: monoFont, fontSize: 12, fontWeight: 700, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
}

function Port({ side, active, color, onClick }: { side: PortSide; active: boolean; color: string; onClick: () => void }) {
  const isIn = side === 'in'
  return <motion.button type="button" data-card-port={side} title={isIn ? 'Input port' : 'Output port'} aria-label={isIn ? 'Input port' : 'Output port'} onClick={(e) => { e.stopPropagation(); onClick() }} onPointerDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '50%', [isIn ? 'left' : 'right']: -7, width: 14, height: 14, padding: 0, background: active ? color : '#fff', border: '1.5px solid ' + color, borderRadius: '50%', cursor: 'crosshair', zIndex: 2 }} />
}

function pruneEmpty<T>(o: T): T { const out: Record<string, unknown> = {}; for (const [k, v] of Object.entries(o as Record<string, unknown>)) { if (v === undefined) continue; if (Array.isArray(v) && v.length === 0) continue; if (typeof v === 'string' && v.trim() === '') continue; out[k] = v } return out as T }
