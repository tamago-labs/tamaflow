// Inline edit form for the `payment` card category. Mirrors the styling
// of EditForm's `SourceFields` and `PayeeFieldsForm` (mono uppercase
// labels, Field wrapper, gap: 6) so the three forms look identical when
// the user double-clicks a card.
//
// Three layouts depending on the linked template:
//   • Custom template (paymentTemplate = PaymentTemplate)
//       → template identity strip shows the template name + rates + memo
//         fallback so the user sees which rules will apply at settle time.
//   • Direct Payment (paymentTemplate === null, no templateId)
//       → template identity strip reads "Direct Payment · no deductions"
//         and the memo input placeholder shows the company's
//         directPaymentDefaultMemo (if set) so the user knows where the
//         fallback comes from.
//   • Stale (paymentTemplate === null but templateId is set)
//       → red "Template deleted" banner instead of the identity strip;
//         the card is falling back to Direct Payment.
//
// The Payment card carries only its per-card memo (optional; falls back
// to template.defaultMemo → companyProfile.directPaymentDefaultMemo →
// ""). Amount is always derived from the employee's salary — there is
// no per-card amount override.

import { MUTED, NAVY, monoFont, sansFont } from './theme'
import type { PaymentFields } from './types'
import type { PaymentTemplate } from '../../../preload/index.d'
import { paymentTemplateSubtitle } from '../data/flowCards'

interface PaymentFieldsFormProps {
  payment: PaymentFields
  /**
   * Resolved payment template. `null` for Direct Payment OR when the
   * referenced templateId was deleted from Settings. Drives the
   * template identity strip at the top of the form.
   */
  paymentTemplate: PaymentTemplate | null
  /**
   * Set when `paymentTemplate === null` AND `payment.templateId` is
   * truthy — i.e. the card references a template that no longer
   * exists. Used to render the red "Template deleted" banner.
   */
  hasStaleTemplateId?: boolean
  onChange: (v: PaymentFields) => void
  /**
   * Fallback memo used in the placeholder when there's no linked
   * template (Direct Payment). Comes from
   * `CompanyProfile.directPaymentDefaultMemo`.
   */
  fallbackMemo?: string
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

export default function PaymentFieldsForm({
  payment,
  paymentTemplate,
  hasStaleTemplateId = false,
  onChange,
  fallbackMemo = '',
  onKeyDown,
}: PaymentFieldsFormProps) {
  const placeholder = paymentTemplate
    ? `e.g. ${paymentTemplate.defaultMemo} (template default)`
    : fallbackMemo
      ? `e.g. ${fallbackMemo} (company default)`
      : 'optional memo'

  return (
    <>
      {hasStaleTemplateId && !paymentTemplate ? (
        // Stale templateId — the card references a template that was
        // deleted from Settings. The route will fall back to Direct
        // Payment at settle time, so we surface that here as well as
        // on the canvas body.
        <div
          style={{
            padding: '6px 8px',
            background: 'rgba(200,48,48,0.06)',
            border: '1px dashed #c83030',
            borderRadius: 4,
            fontFamily: monoFont,
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#c83030',
            lineHeight: 1.4,
          }}
        >
          Template deleted — falling back to Direct Payment
        </div>
      ) : (
        // Template identity strip — shows the rules at-a-glance so the
        // user can confirm which template this Payment card will run as.
        <div
          style={{
            padding: '6px 8px',
            background: '#f7f7fc',
            border: '1px solid #e0e0f0',
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
            {paymentTemplate ? paymentTemplate.name : 'Direct Payment'}
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 9,
              letterSpacing: '0.04em',
              color: MUTED,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={
              paymentTemplate
                ? paymentTemplateSubtitle(paymentTemplate)
                : 'No deductions applied — built-in card.'
            }
          >
            {paymentTemplate
              ? paymentTemplateSubtitle(paymentTemplate)
              : 'No deductions · built-in card'}
          </div>
        </div>
      )}

      <Field
        label="Memo"
        hint="baked into the transfer"
      >
        <input
          type="text"
          value={payment.memo ?? ''}
          onChange={(e) => onChange({ ...payment, memo: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={textInputStyle}
        />
      </Field>

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
        Amount comes from the employee&apos;s salary · withholding &amp; social
        security applied per the linked template
      </div>
    </>
  )
}