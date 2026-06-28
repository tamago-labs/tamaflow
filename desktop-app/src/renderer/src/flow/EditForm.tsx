// Inline edit form rendered inside <CanvasCard> when `editing === true`.
//
// One Field list per card category — switches on `card.category` (and
// `card.transferVariant` for transfer cards). The form is contained in
// a div with `data-card-edit="1"` so click/pointer-down/double-click
// events stopPropagation and don't fall through to the card body
// (which would otherwise re-select, start a drag, or re-open edit mode).
//
// The title input is auto-focused on mount and the caret is placed at
// the end of the pre-filled text. Enter saves, Escape cancels — both
// bubble through `onKeyDown` from the parent.

import { useEffect, useRef } from 'react'
import {
  BLUE,
  BORDER,
  MUTED,
  NAVY,
  monoFont,
  sansFont,
} from './theme'
import type {
  CanvasCard as CanvasCardType,
  ContractorTransferFields,
  EmployeeTransferFields,
  PayeeFields,
  SourceFields,
} from './types'

interface EditFormProps {
  card: CanvasCardType
  title: string
  source: SourceFields
  payee: PayeeFields
  contractor: ContractorTransferFields
  employee: EmployeeTransferFields
  onTitleChange: (v: string) => void
  onSourceChange: (v: SourceFields) => void
  onPayeeChange: (v: PayeeFields) => void
  onContractorChange: (v: ContractorTransferFields) => void
  onEmployeeChange: (v: EmployeeTransferFields) => void
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
  contractor,
  employee,
  onTitleChange,
  onSourceChange,
  onPayeeChange,
  onContractorChange,
  onEmployeeChange,
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
        // EDIT_HEIGHT = 340 (set in CanvasCard). Subtract card padding so
        // the form scrolls inside the card's fixed height budget.
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
          onChange={onSourceChange}
          onKeyDown={onKeyDown}
        />
      )}

      {card.category === 'payee' && (
        <PayeeFieldsForm
          payee={payee}
          onChange={onPayeeChange}
          onKeyDown={onKeyDown}
        />
      )}

      {card.category === 'transfer' && card.transferVariant === 'contractor' && (
        <ContractorFields
          contractor={contractor}
          onChange={onContractorChange}
          onKeyDown={onKeyDown}
        />
      )}

      {card.category === 'transfer' && card.transferVariant === 'employee' && (
        <EmployeeFields
          employee={employee}
          onChange={onEmployeeChange}
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

// ─── Per-category field forms ─────────────────────────────────────────

function SourceFields({
  source,
  onChange,
  onKeyDown,
}: {
  source: SourceFields
  onChange: (v: SourceFields) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  return (
    <>
      <Field label="Wallet">
        <input
          type="text"
          value="Treasury (hardcoded)"
          disabled
          style={{ ...textInputStyle, color: MUTED, background: '#f7f7fc' }}
        />
      </Field>
      <Field label="Memo" hint="baked into transfer memo">
        <input
          type="text"
          value={source.memo ?? ''}
          onChange={(e) => onChange({ ...source, memo: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="e.g. March 2026 payroll"
          style={textInputStyle}
        />
      </Field>
      <Field label="Min balance (CC)" hint="abort run if below">
        <input
          type="text"
          inputMode="decimal"
          value={source.minBalanceCC ?? ''}
          onChange={(e) => onChange({ ...source, minBalanceCC: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="e.g. 1000"
          style={textInputStyle}
        />
      </Field>
    </>
  )
}

function PayeeFieldsForm({
  payee,
  onChange,
  onKeyDown,
}: {
  payee: PayeeFields
  onChange: (v: PayeeFields) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  return (
    <>
      <Field label="Employee ID" hint="FK into employees.json">
        <input
          type="text"
          value={payee.employeeId}
          onChange={(e) => onChange({ ...payee, employeeId: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="e.g. emp-001"
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

function ContractorFields({
  contractor,
  onChange,
  onKeyDown,
}: {
  contractor: ContractorTransferFields
  onChange: (v: ContractorTransferFields) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  return (
    <>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 9,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: MUTED,
          padding: '4px 6px',
          background: '#f7f7fc',
          borderRadius: 4,
          border: '1px dashed ' + BORDER,
        }}
      >
        No withholding — contractor payments skip tax + SS
      </div>
      <Field label="FX rate" hint="CC per 1 unit of payCurrency">
        <input
          type="text"
          inputMode="decimal"
          value={contractor.fxRate ?? ''}
          onChange={(e) => onChange({ ...contractor, fxRate: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="e.g. 0.087 (CC per USD)"
          style={textInputStyle}
        />
      </Field>
    </>
  )
}

function EmployeeFields({
  employee,
  onChange,
  onKeyDown,
}: {
  employee: EmployeeTransferFields
  onChange: (v: EmployeeTransferFields) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  return (
    <>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 9,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: MUTED,
          padding: '4px 6px',
          background: '#f7f7fc',
          borderRadius: 4,
          border: '1px dashed ' + BORDER,
          lineHeight: 1.35,
        }}
      >
        Withholding + SS applied only when payee is
        inside_jurisdiction
      </div>
      <Field label="Withholding rate" hint="decimal, e.g. 0.22 = 22%">
        <input
          type="text"
          inputMode="decimal"
          value={employee.withholdingRate}
          onChange={(e) =>
            onChange({ ...employee, withholdingRate: e.target.value })
          }
          onKeyDown={onKeyDown}
          placeholder="e.g. 0.22"
          style={textInputStyle}
        />
      </Field>
      <Field label="Social security rate" hint="optional, defaults to 0">
        <input
          type="text"
          inputMode="decimal"
          value={employee.socialSecurityRate ?? ''}
          onChange={(e) =>
            onChange({ ...employee, socialSecurityRate: e.target.value })
          }
          onKeyDown={onKeyDown}
          placeholder="e.g. 0.05"
          style={textInputStyle}
        />
      </Field>
      <Field label="FX rate" hint="CC per 1 unit of payCurrency">
        <input
          type="text"
          inputMode="decimal"
          value={employee.fxRate ?? ''}
          onChange={(e) => onChange({ ...employee, fxRate: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="e.g. 0.087 (CC per USD)"
          style={textInputStyle}
        />
      </Field>
    </>
  )
}