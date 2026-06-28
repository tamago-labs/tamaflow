// Inline edit form rendered inside <CanvasCard> when `editing === true`.
//
// Two card categories only — `source` and `payee` — so the form just
// switches on `card.category` between two field shapes.
//
// The form is contained in a div with `data-card-edit="1"` so
// click/pointer-down/double-click events stopPropagation and don't
// fall through to the card body (which would otherwise re-select,
// start a drag, or re-open edit mode).
//
// The title input is auto-focused on mount and the caret is placed at
// the end of the pre-filled text. Enter saves, Escape cancels — both
// bubble through `onKeyDown` from the parent.

import { useEffect, useRef } from 'react'
import { BLUE, BORDER, MUTED, NAVY, monoFont, sansFont } from './theme'
import type {
  CanvasCard as CanvasCardType,
  PayeeFields,
  SourceFields,
} from './types'
import type { Employee } from '../../../preload/index.d'

interface EditFormProps {
  card: CanvasCardType
  title: string
  source: SourceFields
  payee: PayeeFields
  /** Roster used by the Payee card to resolve employeeId → Employee. */
  employees: Employee[]
  /** Drives the Source section's "no wallet set up" warning. */
  walletReady: boolean
  onTitleChange: (v: string) => void
  onPayeeChange: (v: PayeeFields) => void
  onSave: () => void
  onCancel: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

const textInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '3px 6px',
  border: '1px solid #d0d0e8',
  borderRadius: 4,
  fontFamily: sansFont,
  fontSize: 11,
  color: NAVY,
  outline: 'none',
  boxSizing: 'border-box',
}

const titleInputStyle: React.CSSProperties = {
  ...textInputStyle,
  fontSize: 13,
  fontWeight: 600,
  padding: '5px 6px',
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  marginTop: 4,
}

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  background: BLUE,
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontFamily: monoFont,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const ghostButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  background: '#fff',
  color: NAVY,
  border: '1px solid ' + BORDER,
  borderRadius: 4,
  fontFamily: monoFont,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <label
        style={{
          fontFamily: monoFont,
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: MUTED,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 6,
        }}
      >
        <span>{label}</span>
        {hint && (
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 8,
              letterSpacing: '0.06em',
              textTransform: 'none',
              color: MUTED,
              opacity: 0.7,
            }}
          >
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

export default function EditForm({
  card,
  title,
  source,
  payee,
  employees,
  walletReady,
  onTitleChange,
  onPayeeChange,
  onSave,
  onCancel,
  onKeyDown,
}: EditFormProps) {
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Defer focus so the input is fully mounted; place caret at the end
    // of any pre-filled text so editing doesn't overwrite the title.
    const t = setTimeout(() => {
      const el = titleInputRef.current
      if (!el) return
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }, 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      data-card-edit="1"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 320,
        overflowY: 'auto',
        paddingRight: 2,
      }}
    >
      <Field label="Title">
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Card title"
          style={titleInputStyle}
        />
      </Field>

      {card.category === 'source' && (
        <SourceFields
          source={source}
          walletReady={walletReady}
        />
      )}

      {card.category === 'payee' && (
        <PayeeFieldsForm
          payee={payee}
          employees={employees}
          onChange={onPayeeChange}
          onKeyDown={onKeyDown}
        />
      )}

      <div style={buttonRowStyle}>
        <button type="button" onClick={onCancel} style={ghostButtonStyle}>
          Cancel
        </button>
        <button type="button" onClick={onSave} style={primaryButtonStyle}>
          Save
        </button>
      </div>
    </div>
  )
}

// ─── Per-category field forms ─────────────────────────────────────

/**
 * Source card has only one editable field of substance — the wallet
 * party id, snapshotted from the live wallet at creation time. The
 * field is read-only here so the card stays tied to the wallet that
 * was loaded when the card was dropped (renaming the wallet later
 * can't silently redirect funds).
 */
function SourceFields({
  source,
  walletReady,
}: {
  source: SourceFields
  walletReady: boolean
}) {
  const hasPartyId = source.partyId.trim().length > 0
  return (
    <>
      <Field label="Wallet (Canton party id)" hint="snapshotted at creation">
        <input
          type="text"
          value={source.partyId}
          readOnly
          tabIndex={-1}
          style={{
            ...textInputStyle,
            color: hasPartyId ? NAVY : '#c83030',
            background: '#f7f7fc',
            fontFamily: monoFont,
            fontSize: 10,
          }}
          placeholder={walletReady ? 'No wallet selected' : 'No wallet set up yet'}
        />
      </Field>
      {!walletReady && (
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#c83030',
            padding: '4px 6px',
            background: 'rgba(200,48,48,0.06)',
            borderRadius: 4,
            border: '1px dashed #c83030',
            lineHeight: 1.4,
            whiteSpace: 'normal',
          }}
        >
          No wallet set up. Create one in Assets before running this flow.
        </div>
      )}
    </>
  )
}

function PayeeFieldsForm({
  payee,
  employees,
  onChange,
  onKeyDown,
}: {
  payee: PayeeFields
  employees: Employee[]
  onChange: (v: PayeeFields) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  // Payee cards are created with a specific employee already bound from
  // the palette, so the binding is shown read-only here. To rebind, the
  // user deletes this card and drops a new Payee tile for the other
  // employee — this keeps "one card = one employee" invariant intact.
  const selected = payee.employeeId
    ? employees.find((e) => e.id === payee.employeeId) ?? null
    : null
  const selectedIsGhost = payee.employeeId.length > 0 && !selected

  return (
    <>
      {selected ? (
        <div
          style={{
            padding: '6px 8px',
            background: '#f7f7fc',
            border: '1px solid ' + BORDER,
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div
            style={{
              fontFamily: sansFont,
              fontSize: 11,
              fontWeight: 600,
              color: NAVY,
              lineHeight: 1.2,
            }}
          >
            {selected.displayName}
            {selected.status !== 'active' && (
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 8,
                  letterSpacing: '0.12em',
                  color: MUTED,
                  marginLeft: 6,
                }}
              >
                · {selected.status}
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 9,
              color: MUTED,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {selected.cantonPartyId ?? '— no party id —'}
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 9,
              color: MUTED,
            }}
          >
            {`${selected.country ?? '?'} · ${selected.payCurrency ?? '?'}`}
          </div>
        </div>
      ) : selectedIsGhost ? (
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 9,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#c83030',
            padding: '6px 8px',
            background: 'rgba(200,48,48,0.06)',
            borderRadius: 4,
            border: '1px dashed #c83030',
            lineHeight: 1.4,
            whiteSpace: 'normal',
          }}
        >
          Employee id not found in roster — id: {payee.employeeId}
        </div>
      ) : (
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: MUTED,
            padding: '6px 8px',
            background: '#f7f7fc',
            borderRadius: 4,
            border: '1px dashed ' + BORDER,
            lineHeight: 1.4,
            whiteSpace: 'normal',
          }}
        >
          No employee bound to this card
        </div>
      )}

      <Field label="FX rate" hint="CC per 1 unit of payCurrency">
        <input
          type="text"
          inputMode="decimal"
          value={payee.fxRate ?? ''}
          onChange={(e) => onChange({ ...payee, fxRate: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="e.g. 0.087 (CC per USD)"
          style={textInputStyle}
        />
      </Field>

      <Field
        label="Amount override"
        hint="leave blank to use employee's salary"
      >
        <input
          type="text"
          inputMode="decimal"
          value={payee.amountOverride ?? ''}
          onChange={(e) => onChange({ ...payee, amountOverride: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="e.g. 1000 (in payCurrency)"
          style={textInputStyle}
        />
      </Field>

      <Field label="Note">
        <input
          type="text"
          value={payee.note ?? ''}
          onChange={(e) => onChange({ ...payee, note: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="optional note"
          style={textInputStyle}
        />
      </Field>
    </>
  )
}