// A single card on the free-form canvas.
//
// Card body is draggable (dnd-kit). Clicking the body selects the card;
// clicking a port dot on the left or right edge triggers the connect
// flow. Collapse and delete icons sit in the top-right.
//
// Double-click enters inline edit mode (renders <EditForm>). While
// editing, dnd-kit drag is disabled so typing doesn't accidentally
// trigger a drag.

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
  SourceFields,
} from './types'
import type { Employee } from '../../../preload/index.d'
import EditForm from './EditForm'

export type PortSide = 'in' | 'out'

interface CanvasCardProps {
  card: CanvasCardType
  selected: boolean
  isConnectSource: boolean
  editing: boolean
  /** Roster used to resolve a Payee card's employeeId → Employee. */
  employees: Employee[]
  /**
   * Whether the desktop wallet is currently loaded. Drives the Source
   * card's "no wallet set up" warning when the card has no snapshot.
   */
  walletReady: boolean
  onSelect: (placementId: string) => void
  onDelete: (placementId: string) => void
  onToggleCollapse: (placementId: string) => void
  onPortClick: (placementId: string, side: PortSide) => void
  onRequestEdit: (placementId: string) => void
  onEdit: (placementId: string, updates: CanvasCardEdit) => void
  onEditCancel: (placementId: string) => void
}

export const CARD_WIDTH = 220
const EXPANDED_HEIGHT = 110
const COLLAPSED_HEIGHT = 44
const EDIT_HEIGHT = 340

const CanvasCard = forwardRef<HTMLDivElement, CanvasCardProps>(function CanvasCard({
  card,
  selected,
  isConnectSource,
  editing,
  employees,
  walletReady,
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
    disabled: editing,
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

  useEffect(() => {
    if (editing) {
      setDraftTitle(card.title)
      setDraftSource(card.sourceFields ?? { partyId: '' })
      setDraftPayee(card.payeeFields ?? { employeeId: '' })
    }
  }, [editing, card.title, card.sourceFields, card.payeeFields])

  function handleSave() {
    const nextTitle = draftTitle.trim() === '' ? card.title : draftTitle
    onEdit(card.placementId, {
      title: nextTitle,
      sourceFields: card.category === 'source' ? pruneEmpty(draftSource) : undefined,
      payeeFields: card.category === 'payee' ? pruneEmpty(draftPayee) : undefined,
    })
  }

  function handleBodyDoubleClick(e: React.MouseEvent) {
    if (editing) return
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
  const height = card.collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT
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
    onSelect(card.placementId)
  }

  // The summary line under the title — different per category. For
  // Source it's a "no wallet" hint when the snapshot is empty. For
  // Payee it's the resolved employee record (displayName + truncated
  // partyId + jurisdiction) — red when the FK points to a missing
  // employee.
  const { summaryLine, summaryTone } = (() => {
    if (card.category === 'source') {
      const partyId = card.sourceFields?.partyId?.trim() ?? ''
      if (!partyId) {
        return {
          summaryLine: walletReady
            ? 'No wallet set on this card'
            : 'No wallet set up — create one in Assets',
          summaryTone: 'danger' as const,
        }
      }
      return { summaryLine: '', summaryTone: 'muted' as const }
    }
    if (card.category === 'payee') {
      const employeeId = card.payeeFields?.employeeId?.trim() ?? ''
      if (!employeeId) {
        return {
          summaryLine: 'No employee selected — double-click to bind',
          summaryTone: 'danger' as const,
        }
      }
      const emp = employees.find((e) => e.id === employeeId)
      if (!emp) {
        return {
          summaryLine: `Employee not found (id: ${employeeId})`,
          summaryTone: 'danger' as const,
        }
      }
      const party = emp.cantonPartyId ? shortPartyId(emp.cantonPartyId) : 'no party id'
      const countryLabel = emp.country ?? '?'
      const fxRate = card.payeeFields?.fxRate?.trim()
      const fxSuffix = fxRate ? ` · ${fxRate} FX` : ''
      return {
        summaryLine: `${party} · ${countryLabel}${fxSuffix}`,
        summaryTone: 'muted' as const,
      }
    }
    return { summaryLine: '', summaryTone: 'muted' as const }
  })()

  const summaryColor = summaryTone === 'danger' ? '#c83030' : MUTED

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleBodyClick}
      onDoubleClick={handleBodyDoubleClick}
      {...(editing ? {} : listeners)}
      {...attributes}
    >
      {editing ? (
        <EditForm
          card={card}
          title={draftTitle}
          source={draftSource}
          payee={draftPayee}
          employees={employees}
          walletReady={walletReady}
          onTitleChange={setDraftTitle}
          onSourceChange={setDraftSource}
          onPayeeChange={setDraftPayee}
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
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontSize: 10,
                      color: summaryColor,
                      marginTop: 3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {summaryLine}
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