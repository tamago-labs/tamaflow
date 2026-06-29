// Inline edit form rendered inside <CanvasCard> when `editing === true`.
//
// Three card categories — `source`, `payee`, `payment` — so the form
// switches on `card.category` between three field shapes:
//
//   • source   — wallet party id (read-only) + live CC balance +
//                baseCurrency equivalent in a footer BELOW the
//                Cancel/Save buttons (SourceBalanceFooter).
//   • payee    — employee summary (read-only — the binding is locked
//                at creation) + the auto-fetched FX rate + the
//                LastPaidSection history below the Cancel/Save buttons.
//   • payment  — per-card memo only. The amount comes from the
//                employee's salary and is NOT editable here.
//
// The form is contained in a div with `data-card-edit="1"` so
// click/pointer-down/double-click events stopPropagation and don't
// fall through to the card body (which would otherwise re-select,
// start a drag, or re-open edit mode).
//
// The title input is auto-focused on mount and the caret is placed at
// the end of the pre-filled text. Enter saves, Escape cancels — both
// bubble through `onKeyDown` from the parent.

import { useEffect, useMemo, useRef } from 'react'
import { BLUE, BORDER, MUTED, NAVY, monoFont, sansFont } from './theme'
import type {
  CanvasCard as CanvasCardType,
  PayeeFields,
  PaymentFields,
  SourceFields,
} from './types'
import type { Employee, PaymentTemplate } from '../../../preload/index.d'
import PaymentFieldsForm from './PaymentFieldsForm'
import LastPaidSection from './LastPaidSection'
import { useWallet } from '../context/WalletContext'
import { useCompany } from '../context/CompanyContext'
import { usePrice } from '../context/PriceContext'

interface EditFormProps {
  card: CanvasCardType
  title: string
  source: SourceFields
  payee: PayeeFields
  payment: PaymentFields
  /** Roster used by the Payee card to resolve employeeId → Employee. */
  employees: Employee[]
  /** Drives the Source section's "no wallet set up" warning. */
  walletReady: boolean
  /**
   * Resolved payment template for a Payment card. `null` for Direct
   * Payment (no template) OR when the referenced templateId was deleted
   * from Settings (stale — PaymentFieldsForm surfaces the warning).
   * Drives the template identity strip + memo placeholder at the top of
   * the payment edit form.
   */
  paymentTemplate: PaymentTemplate | null
  /** Flow id — threaded into LastPaidSection so it can subscribe to
   *  this flow's route progress. */
  flowId: string
  onTitleChange: (v: string) => void
  onPaymentChange: (v: PaymentFields) => void
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
  payment,
  employees,
  walletReady,
  paymentTemplate,
  flowId,
  onTitleChange,
  onPaymentChange,
  onSave,
  onCancel,
  onKeyDown,
}: EditFormProps) {
  const titleInputRef = useRef<HTMLInputElement>(null)
  const { profile: companyProfile } = useCompany()

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
        />
      )}

      {card.category === 'payment' && (
        <PaymentFieldsForm
          payment={payment}
          paymentTemplate={paymentTemplate}
          hasStaleTemplateId={!!(card.paymentFields?.templateId && !paymentTemplate)}
          fallbackMemo={companyProfile?.directPaymentDefaultMemo ?? ''}
          onChange={onPaymentChange}
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

      {card.category === 'source' && <SourceBalanceFooter />}
      {card.category === 'payee' && card.payeeFields?.employeeId && (
        <LastPaidSection
          flowId={flowId}
          employeeId={card.payeeFields.employeeId}
        />
      )}
    </div>
  )
}

// ─── Per-category field forms ─────────────────────────────────────

/**
 * Balance footer for the Source card's edit form.
 *
 * Shows the live CC balance from the wallet, plus the same amount
 * converted to the company's base currency. Rendered BELOW the
 * Cancel/Save button row so the user sees the converted number only
 * when they're actively editing the source card.
 */
function SourceBalanceFooter() {
  const { holdings } = useWallet()
  const { profile } = useCompany()
  const { convert, formatConverted } = usePrice()
  const baseCurrency = profile?.baseCurrency ?? 'USD'

  const ccBalance = useMemo(() => {
    const ccHolding = holdings.find((h) => h.symbol === 'CC')
    if (!ccHolding) return null
    const n = Number(ccHolding.amount)
    return Number.isFinite(n) ? n : null
  }, [holdings])

  const baseEquivalent = useMemo(() => {
    if (ccBalance === null) return null
    return convert(ccBalance, 'CC', baseCurrency as 'CC' | 'USD' | 'EUR' | 'JPY' | 'THB')
  }, [ccBalance, baseCurrency, convert])

  if (ccBalance === null) {
    return (
      <div
        style={{
          marginTop: 4,
          paddingTop: 6,
          borderTop: '1px dashed ' + BORDER,
          fontFamily: monoFont,
          fontSize: 9,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: MUTED,
          textAlign: 'center',
        }}
      >
        Balance unavailable
      </div>
    )
  }

  return (
    <div
      style={{
        marginTop: 4,
        paddingTop: 6,
        borderTop: '1px dashed ' + BORDER,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 11,
          fontWeight: 700,
          color: NAVY,
          letterSpacing: '0.02em',
        }}
      >
        {formatConverted(ccBalance, 'CC')} CC
      </div>
      {baseEquivalent !== null && (
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 10,
            color: MUTED,
            letterSpacing: '0.04em',
          }}
        >
          {formatConverted(baseEquivalent, baseCurrency as 'CC' | 'USD' | 'EUR' | 'JPY' | 'THB')} {baseCurrency}
        </div>
      )}
    </div>
  )
}

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
}: {
  payee: PayeeFields
  employees: Employee[]
}) {
  // Payee cards are created with a specific employee already bound from
  // the palette, so the binding is shown read-only here. To rebind, the
  // user deletes this card and drops a new Payee tile for the other
  // employee — this keeps "one card = one employee" invariant intact.
  //
  // The FX rate is NOT user-editable. It's auto-fetched from
  // `priceProvider` (USD-relative, 2-step via USD bridge) and surfaced
  // as a read-only helper line so the user can sanity-check the rate
  // against the price provider before running the flow.
  const { convert, formatConverted } = usePrice()
  const selected = payee.employeeId
    ? employees.find((e) => e.id === payee.employeeId) ?? null
    : null
  const selectedIsGhost = payee.employeeId.length > 0 && !selected

  // 1 unit of `payCurrency` → CC. e.g. for USD with the table's
  // PRICE_TABLE = { USD: 1.0, CC: 0.15 }, the helper shows
  // "1 USD ≈ 0.15 CC". Multiplied through the bridge:
  //   ccPerUnit = convert(1, payCurrency, 'CC')
  const fxHelper = useMemo(() => {
    if (!selected) return null
    const payCcy = (selected.payCurrency ?? '') as 'CC' | 'USD' | 'EUR' | 'JPY' | 'THB'
    if (!payCcy) return null
    if (payCcy === 'CC') return 'paid in CC — no FX applied'
    const ccPerUnit = convert(1, payCcy, 'CC')
    if (ccPerUnit === null) return null
    return `1 ${payCcy} ≈ ${formatConverted(ccPerUnit, 'CC')} CC · auto from price provider`
  }, [selected, convert, formatConverted])

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

      {fxHelper && (
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 8,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: MUTED,
            lineHeight: 1.4,
            paddingTop: 2,
          }}
        >
          {fxHelper}
        </div>
      )}
    </>
  )
}