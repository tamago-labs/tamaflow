import { MUTED, NAVY, monoFont, sansFont } from './theme'
import type { PaymentFields } from './types'
import type { PaymentTemplate } from '../ai/types'
import { paymentTemplateSubtitle } from './flowCards'

interface PaymentFieldsFormProps {
  payment: PaymentFields
  paymentTemplate: PaymentTemplate | null
  hasStaleTemplateId?: boolean
  onChange: (v: PaymentFields) => void
  fallbackMemo?: string
  onKeyDown: (e: React.KeyboardEvent) => void
}

const textInputStyle: React.CSSProperties = { width: '100%', padding: '3px 6px', border: '1px solid #d0d0e8', borderRadius: 4, fontFamily: sansFont, fontSize: 11, color: NAVY, outline: 'none', boxSizing: 'border-box' }

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

export default function PaymentFieldsForm({ payment, paymentTemplate, hasStaleTemplateId = false, onChange, fallbackMemo = '', onKeyDown }: PaymentFieldsFormProps) {
  const placeholder = paymentTemplate ? `e.g. ${paymentTemplate.defaultMemo} (template default)` : fallbackMemo ? `e.g. ${fallbackMemo} (company default)` : 'optional memo'

  return (
    <>
      {hasStaleTemplateId && !paymentTemplate ? (
        <div style={{ padding: '6px 8px', background: 'rgba(200,48,48,0.06)', border: '1px dashed #c83030', borderRadius: 4, fontFamily: monoFont, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c83030', lineHeight: 1.4 }}>
          Template deleted — falling back to Direct Payment
        </div>
      ) : (
        <div style={{ padding: '6px 8px', background: '#f7f7fc', border: '1px solid #e0e0f0', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontFamily: sansFont, fontSize: 11, fontWeight: 600, color: NAVY, lineHeight: 1.2 }}>{paymentTemplate ? paymentTemplate.name : 'Direct Payment'}</div>
          <div style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.04em', color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={paymentTemplate ? paymentTemplateSubtitle(paymentTemplate) : 'No deductions applied — built-in card.'}>
            {paymentTemplate ? paymentTemplateSubtitle(paymentTemplate) : 'No deductions · built-in card'}
          </div>
          {paymentTemplate?.html && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const win = window.open('', '_blank', 'noopener,noreferrer')
                if (win) {
                  win.document.write(paymentTemplate.html)
                  win.document.close()
                }
              }}
              style={{ marginTop: 2, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: monoFont, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1A1AE8', textAlign: 'left' }}
            >
              Preview template
            </button>
          )}
        </div>
      )}
      <Field label="Memo" hint="baked into the transfer">
        <input type="text" value={payment.memo ?? ''} onChange={(e) => onChange({ ...payment, memo: e.target.value })} onKeyDown={onKeyDown} placeholder={placeholder} style={textInputStyle} />
      </Field>
      <div style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, lineHeight: 1.4, paddingTop: 2 }}>
        Amount comes from the employee&apos;s salary · withholding &amp; social security applied per the linked template
      </div>
    </>
  )
}
