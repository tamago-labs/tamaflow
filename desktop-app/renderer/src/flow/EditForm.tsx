import { useEffect, useMemo, useRef } from 'react'
import { BLUE, BORDER, MUTED, NAVY, monoFont, sansFont } from './theme'
import type { CanvasCard as CanvasCardType, PayeeFields, PaymentFields, SourceFields } from './types'
import type { Employee } from '../ai/types'
import PaymentFieldsForm from './PaymentFieldsForm'
import CheckInSection from './CheckInSection'
import { useWallet } from '../context/WalletContext'
import { useCompany } from '../context/CompanyContext'
import { usePrice } from '../context/PriceContext'

interface PaymentTemplate { id: string; name: string; withholdingRate: string; defaultMemo: string; createdAt: string; updatedAt: string }

interface EditFormProps {
  card: CanvasCardType
  title: string
  source: SourceFields
  payee: PayeeFields
  payment: PaymentFields
  employees: Employee[]
  walletReady: boolean
  paymentTemplate: PaymentTemplate | null
  onTitleChange: (v: string) => void
  onPaymentChange: (v: PaymentFields) => void
  onSave: () => void
  onCancel: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

const textInputStyle: React.CSSProperties = { width: '100%', padding: '3px 6px', border: '1px solid #d0d0e8', borderRadius: 4, fontFamily: sansFont, fontSize: 11, color: NAVY, outline: 'none', boxSizing: 'border-box' }
const titleInputStyle: React.CSSProperties = { ...textInputStyle, fontSize: 13, fontWeight: 600, padding: '5px 6px' }
const buttonRowStyle: React.CSSProperties = { display: 'flex', gap: 6, marginTop: 4 }
const primaryButtonStyle: React.CSSProperties = { flex: 1, padding: '5px 8px', background: BLUE, color: '#fff', border: 'none', borderRadius: 4, fontFamily: monoFont, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }
const ghostButtonStyle: React.CSSProperties = { flex: 1, padding: '5px 8px', background: '#fff', color: NAVY, border: '1px solid ' + BORDER, borderRadius: 4, fontFamily: monoFont, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <label style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
        <span>{label}</span>
        {hint && <span style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.06em', textTransform: 'none', color: MUTED, opacity: 0.7 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

export default function EditForm({ card, title, source, payee, payment, employees, walletReady, paymentTemplate, onTitleChange, onPaymentChange, onSave, onCancel, onKeyDown }: EditFormProps) {
  const titleInputRef = useRef<HTMLInputElement>(null)
  const { profile: companyProfile } = useCompany()

  useEffect(() => {
    const t = setTimeout(() => { const el = titleInputRef.current; if (!el) return; el.focus(); const len = el.value.length; el.setSelectionRange(len, len) }, 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <div data-card-edit="1" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
      <Field label="Title">
        <input ref={titleInputRef} type="text" value={title} onChange={(e) => onTitleChange(e.target.value)} onKeyDown={onKeyDown} placeholder="Card title" style={titleInputStyle} />
      </Field>
      {card.category === 'source' && <SourceFieldsForm source={source} walletReady={walletReady} />}
      {card.category === 'payee' && <PayeeFieldsForm payee={payee} employees={employees} />}
      {card.category === 'payment' && <PaymentFieldsForm payment={payment} paymentTemplate={paymentTemplate} hasStaleTemplateId={!!(card.paymentFields?.templateId && !paymentTemplate)} fallbackMemo={companyProfile?.directPaymentDefaultMemo ?? ''} onChange={onPaymentChange} onKeyDown={onKeyDown} />}
      <div style={buttonRowStyle}>
        <button type="button" onClick={onCancel} style={ghostButtonStyle}>Cancel</button>
        <button type="button" onClick={onSave} style={primaryButtonStyle}>Save</button>
      </div>
      {card.category === 'source' && <SourceBalanceFooter />}
      {card.category === 'payee' && card.payeeFields?.employeeId && <CheckInSection employeeId={card.payeeFields.employeeId} />}
    </div>
  )
}

function SourceBalanceFooter() {
  const { holdings } = useWallet()
  const { profile } = useCompany()
  const { convert, formatConverted } = usePrice()
  const baseCurrency = profile?.baseCurrency ?? 'USD'
  const ccBalance = useMemo(() => { const ccHolding = holdings.find((h) => h.symbol === 'CC'); if (!ccHolding) return null; const n = Number(ccHolding.amount); return Number.isFinite(n) ? n : null }, [holdings])
  const baseEquivalent = useMemo(() => { if (ccBalance === null) return null; return convert(ccBalance, 'CC', baseCurrency as any) }, [ccBalance, baseCurrency, convert])

  if (ccBalance === null) return <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px dashed ' + BORDER, fontFamily: monoFont, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, textAlign: 'center' }}>Balance unavailable</div>
  return (
    <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px dashed ' + BORDER, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <div style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED }}>Balance</div>
        <div style={{ fontFamily: monoFont, fontSize: 11, fontWeight: 700, color: NAVY, letterSpacing: '0.02em' }}>{formatConverted(ccBalance, 'CC')} CC</div>
      </div>
      {baseEquivalent !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <div style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED }}>≈ {baseCurrency}</div>
          <div style={{ fontFamily: monoFont, fontSize: 10, color: MUTED, letterSpacing: '0.04em' }}>{formatConverted(baseEquivalent, baseCurrency as any)} {baseCurrency}</div>
        </div>
      )}
    </div>
  )
}

function SourceFieldsForm({ source, walletReady }: { source: SourceFields; walletReady: boolean }) {
  const hasPartyId = source.partyId.trim().length > 0
  return (
    <>
      <Field label="Wallet Party ID">
        <input type="text" value={source.partyId} readOnly tabIndex={-1} style={{ ...textInputStyle, color: hasPartyId ? NAVY : '#c83030', background: '#f7f7fc', fontFamily: monoFont, fontSize: 10 }} placeholder={walletReady ? 'No wallet selected' : 'No wallet set up yet'} />
      </Field>
      {!walletReady && <div style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c83030', padding: '4px 6px', background: 'rgba(200,48,48,0.06)', borderRadius: 4, border: '1px dashed #c83030', lineHeight: 1.4, whiteSpace: 'normal' }}>No wallet set up. Create one in Assets before running this flow.</div>}
    </>
  )
}

function PayeeFieldsForm({ payee, employees }: { payee: PayeeFields; employees: Employee[] }) {
  const { convert, formatConverted } = usePrice()
  const selected = payee.employeeId ? employees.find((e) => e.id === payee.employeeId) ?? null : null
  const selectedIsGhost = payee.employeeId.length > 0 && !selected

  const fxHelper = useMemo(() => {
    if (!selected) return null
    const payCcy = (selected.payCurrency ?? '') as any
    if (!payCcy) return null
    if (payCcy === 'CC') return 'paid in CC — no FX applied'
    const ccPerUnit = convert(1, payCcy, 'CC')
    if (ccPerUnit === null) return null
    return `1 ${payCcy} ≈ ${formatConverted(ccPerUnit, 'CC')} CC · auto from price provider`
  }, [selected, convert, formatConverted])

  return (
    <>
      {selected ? (
        <div style={{ padding: '6px 8px', background: '#f7f7fc', border: '1px solid ' + BORDER, borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontFamily: sansFont, fontSize: 11, fontWeight: 600, color: NAVY, lineHeight: 1.2 }}>{selected.displayName}{selected.status !== 'active' && <span style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.12em', color: MUTED, marginLeft: 6 }}>· {selected.status}</span>}</div>
          <div style={{ fontFamily: monoFont, fontSize: 9, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.cantonPartyId ?? '— no party id —'}</div>
          <div style={{ fontFamily: monoFont, fontSize: 9, color: MUTED }}>{`${selected.country ?? '?'} · ${selected.payCurrency ?? '?'}`}</div>
        </div>
      ) : selectedIsGhost ? (
        <div style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#c83030', padding: '6px 8px', background: 'rgba(200,48,48,0.06)', borderRadius: 4, border: '1px dashed #c83030', lineHeight: 1.4, whiteSpace: 'normal' }}>Employee id not found in roster — id: {payee.employeeId}</div>
      ) : (
        <div style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, padding: '6px 8px', background: '#f7f7fc', borderRadius: 4, border: '1px dashed ' + BORDER, lineHeight: 1.4, whiteSpace: 'normal' }}>No employee bound to this card</div>
      )}
      {fxHelper && <div style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, lineHeight: 1.4, paddingTop: 2 }}>{fxHelper}</div>}
    </>
  )
}
