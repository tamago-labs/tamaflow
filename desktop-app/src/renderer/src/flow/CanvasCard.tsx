// A single card on the free-form canvas.
//
// Card body is draggable (dnd-kit). Clicking the body selects the card;
// clicking a port dot on the left or right edge triggers the connect
// flow. Collapse and delete icons sit in the top-right.
//
// Double-click enters inline edit mode (renders <EditForm>). While
// editing, dnd-kit drag is disabled so typing doesn't accidentally
// trigger a drag.
//
// Three card categories with distinct body content:
//   source  — wallet party id only (the CC balance + base-currency
//             equivalent moved to EditForm's SourceBalanceFooter so it
//             only shows when the user is actively editing this card).
//   payee   — minimal: displayName + salary per period + country. The
//             last-paid history moved to EditForm's PayeeFieldsForm
//             (below the Cancel/Save buttons) so the front face stays
//             small and matches the Source card's footprint.
//   payment — per-card memo only. The amount comes from the employee's
//             salary, deductions live in Settings → Transfers.

import { forwardRef, useEffect, useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { BLUE, BORDER, MUTED, NAVY, TEAL, monoFont, sansFont } from './theme'
import {
  CATEGORY_PREFIX,
  TONE_COLORS,
  cardHasInput,
  cardHasOutput,
  shortPartyId,
} from '../data/flowCards'
import type {
  CanvasCard as CanvasCardType,
  CanvasCardEdit,
  PayeeFields,
  PaymentFields,
  SourceFields,
} from './types'
import type { Employee, PaymentTemplate } from '../../../preload/index.d'
import EditForm from './EditForm'

export type PortSide = 'in' | 'out'

interface CanvasCardProps {
  card: CanvasCardType
  selected: boolean
  isConnectSource: boolean
  editing: boolean
  flowId: string
  /** Roster used to resolve a Payee card's employeeId → Employee. */
  employees: Employee[]
  /**
   * Whether the desktop wallet is currently loaded. Drives the Source
   * card's "no wallet set up" warning when the card has no snapshot.
   */
  walletReady: boolean
  /**
   * User-defined payment templates — drives the Payment card's
   * stale-template warning chip when the card's `templateId` no longer
   * resolves to an entry in this list (template was deleted in Settings).
   */
  paymentTemplates: PaymentTemplate[]
  /**
   * Read-only mode — the flow is active. Disables drag listeners and
   * (defence-in-depth) the inline-edit double-click. The flow-level
   * overlay already absorbs most pointer events, but dnd-kit's keyboard
   * activation and stray events can still bypass it.
   */
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
/** Per-category expanded body height. Front face is intentionally minimal
 *  so all three card types sit at roughly the same size — the heavy
 *  detail (balance, history, deductions) lives in EditForm. */
const EXPANDED_HEIGHTS: Record<CanvasCardType['category'], number> = {
  source: 110,
  payee: 120,
  payment: 110,
}
const EDIT_HEIGHT = 360

const CanvasCard = forwardRef<HTMLDivElement, CanvasCardProps>(function CanvasCard({
  card,
  selected,
  isConnectSource,
  editing,
  flowId,
  employees,
  walletReady,
  paymentTemplates,
  locked = false,
  onSelect,
  onDelete,
  onToggleCollapse,
  onPortClick,
  onRequestEdit,
  onEdit,
  onEditCancel,
}, _ref) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'card-' + card.placementId,
    data: { placementId: card.placementId, kind: 'canvas-card' },
    disabled: editing || locked,
  })

  // Local draft state for inline edit. Mirrors the card's current values
  // on mount/edit-entry so the user can see and tweak them.
  const [draftTitle, setDraftTitle] = useState(card.title)
  const [draftSource, setDraftSource] = useState<SourceFields>(
    card.sourceFields ?? { partyId: '' },
  )
  const [draftPayee, setDraftPayee] = useState<PayeeFields>(
    card.payeeFields ?? { employeeId: '' },
  )
  const [draftPayment, setDraftPayment] = useState<PaymentFields>(
    card.paymentFields ?? {},
  )

  useEffect(() => {
    if (editing) {
      setDraftTitle(card.title)
      setDraftSource(card.sourceFields ?? { partyId: '' })
      setDraftPayee(card.payeeFields ?? { employeeId: '' })
      setDraftPayment(card.paymentFields ?? {})
    }
  }, [editing, card.title, card.sourceFields, card.payeeFields, card.paymentFields])

  function handleSave() {
    const nextTitle = draftTitle.trim() === '' ? card.title : draftTitle
    const update: CanvasCardEdit = { title: nextTitle }
    if (card.category === 'source') update.sourceFields = pruneEmpty(draftSource)
    if (card.category === 'payee') update.payeeFields = pruneEmpty(draftPayee)
    if (card.category === 'payment') update.paymentFields = pruneEmpty(draftPayment)
    onEdit(card.placementId, update)
  }

  function handleBodyDoubleClick(e: React.MouseEvent) {
    if (editing) return
    if (locked) return
    if ((e.target as HTMLElement).closest('[data-card-action],[data-card-port]')) return
    e.stopPropagation()
    onRequestEdit(card.placementId)
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onEditCancel(card.placementId)
    }
  }

  const accent = TONE_COLORS[card.tone ?? 'muted']
  const height = card.collapsed
    ? COLLAPSED_HEIGHT
    : EXPANDED_HEIGHTS[card.category] ?? 140
  const hasInput = cardHasInput(card.category)
  const hasOutput = cardHasOutput(card.category)

  const style: React.CSSProperties = {
    position: 'absolute',
    left: card.x,
    top: card.y,
    width: CARD_WIDTH,
    minHeight: editing ? EDIT_HEIGHT : height,
    background: '#fff',
    border: '1px solid ' + (selected || isConnectSource || editing ? BLUE : BORDER),
    borderLeft: '3px solid ' + accent,
    borderRadius: 8,
    boxShadow: isDragging
      ? '0 10px 24px rgba(10,10,92,0.18)'
      : selected || isConnectSource || editing
      ? '0 0 0 3px ' + 'rgba(26,26,232,0.12)'
      : '0 1px 2px rgba(10,10,92,0.04)',
    boxSizing: 'border-box',
    padding: editing ? '10px 12px 10px 14px' : card.collapsed ? '0 12px' : '10px 12px 10px 14px',
    cursor: editing ? 'default' : isDragging ? 'grabbing' : 'grab',
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : 'box-shadow 0.12s ease, border-color 0.12s ease',
    userSelect: editing ? 'text' : 'none',
    zIndex: isDragging ? 100 : selected || editing ? 5 : 1,
    overflow: 'visible',
  }

  function handleBodyClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-card-action],[data-card-port]')) return
    if (editing) return
    if (locked) return
    onSelect(card.placementId)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleBodyClick}
      onDoubleClick={handleBodyDoubleClick}
      {...(editing || locked ? {} : listeners)}
      {...attributes}
    >
      {editing ? (
        <EditForm
          card={card}
          title={draftTitle}
          source={draftSource}
          payee={draftPayee}
          payment={draftPayment}
          employees={employees}
          walletReady={walletReady}
          paymentTemplate={resolvePaymentTemplate(card, paymentTemplates)}
          flowId={flowId}
          onTitleChange={setDraftTitle}
          onPaymentChange={setDraftPayment}
          onSave={handleSave}
          onCancel={() => onEditCancel(card.placementId)}
          onKeyDown={handleEditKeyDown}
        />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: card.collapsed ? 'center' : 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              {card.collapsed ? (
                <span
                  style={{
                    fontFamily: sansFont,
                    fontSize: 13,
                    fontWeight: 600,
                    color: NAVY,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block',
                    lineHeight: '24px',
                  }}
                >
                  {card.title}
                </span>
              ) : (
                <>
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: MUTED,
                      marginBottom: 4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        background: accent,
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                      }}
                    >
                      {CATEGORY_PREFIX[card.category]}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: sansFont,
                      fontSize: 13,
                      fontWeight: 600,
                      color: NAVY,
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {card.title}
                  </div>
                </>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 2,
                flexShrink: 0,
                alignSelf: 'flex-start',
              }}
            >
              <ActionButton
                label={card.collapsed ? 'Expand' : 'Collapse'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleCollapse(card.placementId)
                }}
                iconOnly
              >
                {card.collapsed ? '+' : '−'}
              </ActionButton>
              <ActionButton
                label="Delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(card.placementId)
                }}
                danger
                iconOnly
              >
                ×
              </ActionButton>
            </div>
          </div>

          {!card.collapsed && (
            <CardBody
              card={card}
              employees={employees}
              walletReady={walletReady}
              paymentTemplates={paymentTemplates}
            />
          )}

          {hasInput && (
            <Port
              side="in"
              active={isConnectSource}
              color={BLUE}
              onClick={() => onPortClick(card.placementId, 'in')}
            />
          )}
          {hasOutput && (
            <Port
              side="out"
              active={isConnectSource}
              color={TEAL}
              onClick={() => onPortClick(card.placementId, 'out')}
            />
          )}
        </>
      )}
    </div>
  )
})

export default CanvasCard

// ─── Per-category body ─────────────────────────────────────────────

interface CardBodyProps {
  card: CanvasCardType
  employees: Employee[]
  walletReady: boolean
  paymentTemplates: PaymentTemplate[]
}

function CardBody({ card, employees, walletReady, paymentTemplates }: CardBodyProps) {
  if (card.category === 'source') {
    return <SourceBody card={card} walletReady={walletReady} />
  }
  if (card.category === 'payee') {
    return <PayeeBody card={card} employees={employees} />
  }
  return <PaymentBody card={card} paymentTemplates={paymentTemplates} />
}

/**
 * Resolve the `PaymentTemplate` referenced by this card's `templateId`,
 * or `null` when the card is Direct Payment OR its template was deleted
 * from Settings (stale). Used by `EditForm` to render the template
 * identity strip at the top of the payment edit form.
 */
function resolvePaymentTemplate(
  card: CanvasCardType,
  paymentTemplates: PaymentTemplate[],
): PaymentTemplate | null {
  if (card.category !== 'payment') return null
  const tid = card.paymentFields?.templateId
  if (!tid) return null
  return paymentTemplates.find((t) => t.id === tid) ?? null
}

/**
 * Source card body — just the wallet party id. The CC balance and
 * its base-currency equivalent moved to the edit form so they only
 * appear when the user is actively looking at this card.
 */
function SourceBody({
  card,
  walletReady,
}: {
  card: CanvasCardType
  walletReady: boolean
}) {
  const partyId = card.sourceFields?.partyId?.trim() ?? ''
  const hasPartyId = partyId.length > 0

  if (!hasPartyId) {
    return (
      <div style={{ marginTop: 8 }}>
        <BodyMuted>
          {walletReady
            ? 'No wallet set on this card'
            : 'No wallet set up — create one in Assets'}
        </BodyMuted>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <BodyField label="Wallet">
        <BodyMono>{shortPartyId(partyId)}</BodyMono>
      </BodyField>
    </div>
  )
}

/**
 * Payee card body — minimal summary: displayName, salary per period,
 * country. The FX rate is auto-fetched (not edited) and the last-paid
 * history moved to EditForm so it only appears when the user is
 * actively looking at the card.
 *
 * Frequency wording matches `resolveGrossPay` in `shared/flowPaths.ts`:
 *   monthly / one-off → as-is
 *   biweekly / weekly  → "X per period"
 *   hourly             → "X / month (160 hrs)"
 */
function PayeeBody({
  card,
  employees,
}: {
  card: CanvasCardType
  employees: Employee[]
}) {
  const employeeId = card.payeeFields?.employeeId?.trim() ?? ''
  if (!employeeId) {
    return (
      <div style={{ marginTop: 8 }}>
        <BodyMuted danger>No employee selected — double-click to bind</BodyMuted>
      </div>
    )
  }
  const emp = employees.find((e) => e.id === employeeId)
  if (!emp) {
    return (
      <div style={{ marginTop: 8 }}>
        <BodyMuted danger>Employee not found (id: {employeeId})</BodyMuted>
      </div>
    )
  }
  const countryLabel = emp.country ?? '?'
  const currencyLabel = emp.payCurrency ?? '?'
  const salaryLine = (() => {
    if (emp.payFrequency === 'hourly' && emp.hourlyRate) {
      return `${emp.hourlyRate} ${currencyLabel} / hr · 160 hrs`
    }
    if (emp.salaryAmount) {
      const period =
        emp.payFrequency === 'biweekly'
          ? '/ biweekly'
          : emp.payFrequency === 'weekly'
            ? '/ week'
            : emp.payFrequency === 'one-off'
              ? 'one-off'
              : '/ month'
      return `${emp.salaryAmount} ${currencyLabel} ${period}`
    }
    return `— ${currencyLabel}`
  })()
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <BodyMono>{salaryLine}</BodyMono>
      <BodyMuted>{countryLabel}</BodyMuted>
    </div>
  )
}

/**
 * Payment card body — per-card memo only. The amount comes from the
 * employee's salary and cannot be overridden here. Deductions live on
 * the linked payment template — when the template was deleted from
 * Settings, the card shows a stale-template warning chip so the user
 * knows this route will fall back to Direct Payment at settle time.
 */
function PaymentBody({
  card,
  paymentTemplates,
}: {
  card: CanvasCardType
  paymentTemplates: PaymentTemplate[]
}) {
  const memo = card.paymentFields?.memo?.trim() ?? ''
  const templateId = card.paymentFields?.templateId
  const template = templateId
    ? paymentTemplates.find((t) => t.id === templateId) ?? null
    : null
  const isStale = !!templateId && template === null
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <BodyField label="Memo">
        {memo ? (
          <BodyMono>{memo}</BodyMono>
        ) : (
          <BodyMuted>— uses template default —</BodyMuted>
        )}
      </BodyField>
      {isStale && (
        <BodyMuted danger>
          Template deleted — falling back to Direct Payment
        </BodyMuted>
      )}
    </div>
  )
}

// ─── Tiny body primitives ─────────────────────────────────────────

function BodyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}

function BodyMono({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: monoFont,
        fontSize: 10,
        color: NAVY,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {children}
    </div>
  )
}

function BodyMuted({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div
      style={{
        fontFamily: monoFont,
        fontSize: 9,
        color: danger ? '#c83030' : MUTED,
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </div>
  )
}

// ─── Action buttons + ports (unchanged) ───────────────────────────

interface ActionButtonProps {
  label: string
  onClick: (e: React.MouseEvent) => void
  danger?: boolean
  iconOnly?: boolean
  children?: React.ReactNode
}

function ActionButton({ label, onClick, danger, iconOnly, children }: ActionButtonProps) {
  return (
    <button
      type="button"
      data-card-action="1"
      title={label}
      aria-label={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: iconOnly ? 22 : 'auto',
        height: 22,
        padding: iconOnly ? 0 : '0 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        color: danger ? '#c83030' : MUTED,
        fontFamily: monoFont,
        fontSize: 12,
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

interface PortProps {
  side: PortSide
  active: boolean
  color: string
  onClick: () => void
}

/**
 * Small circular dot on the left or right edge of the card. Clicking
 * the port triggers the connect flow (`onClick`). When this card is
 * the active source, the port fills with the colour to invite the user
 * to click a target.
 */
function Port({ side, active, color, onClick }: PortProps) {
  const isIn = side === 'in'
  return (
    <motion.button
      type="button"
      data-card-port={side}
      title={isIn ? 'Input port — click to receive a connection' : 'Output port — click to start a connection'}
      aria-label={isIn ? 'Input port' : 'Output port'}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '50%',
        [isIn ? 'left' : 'right']: -7,
        width: 14,
        height: 14,
        padding: 0,
        background: active ? color : '#fff',
        border: '1.5px solid ' + color,
        borderRadius: '50%',
        cursor: 'crosshair',
        zIndex: 2,
      }}
    />
  )
}

/**
 * Strip out empty/undefined fields so we don't persist `note: ''` on
 * every card. Keeps the JSON tidy.
 */
function pruneEmpty<T>(o: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (v === undefined) continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[k] = v
  }
  return out as T
}