// Pre-submit preview modal.
//
// Computes one row per Payee card on the canvas using the same
// `enumerateOutcomes` + `computeOutcome` modules the worker will use
// (Phase 4) — guarantees the preview matches the eventual settlement
// byte-for-byte. The user reviews the table before clicking Submit
// (Phase 4) so surprises don't show up on Canton.
//
// Centered modal (matches the canvas ConfirmPanel pattern in
// FlowBuilder.tsx). Backdrop click closes. Width is generous — the
// table needs ~7 columns to show the variant × jurisdiction breakdown
// clearly.

import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { CanvasCard as PreloadCanvasCard, Employee, CompanyProfile } from '../../../preload/index.d'
import type { CanvasState } from './types'
import { enumerateOutcomes } from '../../../shared/flowPaths'
import { describeRule, type PayCurrency } from '../../../shared/computeOutcome'
import { BLUE, MUTED, NAVY, monoFont, sansFont } from './theme'

interface OutcomesPreviewModalProps {
  open: boolean
  onClose: () => void
  flowId: string
  canvas: CanvasState
  employees: Employee[]
  companyProfile: CompanyProfile | null
}

export default function OutcomesPreviewModal({
  open,
  onClose,
  flowId,
  canvas,
  employees,
  companyProfile,
}: OutcomesPreviewModalProps) {
  const { outcomes, warnings } = useMemo(
    () =>
      enumerateOutcomes({
        flowId,
        // Cast the renderer's strictly-typed `CanvasCard` to the
        // preload's loose shape — they share the same runtime keys
        // (typed-vs-loose only differs in `sourceFields` etc., which
        // are structurally compatible).
        cards: canvas.cards as unknown as PreloadCanvasCard[],
        connections: canvas.connections,
        employees,
        companyProfile,
      }),
    [flowId, canvas.cards, canvas.connections, employees, companyProfile],
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — clicking cancels (no destructive action; we
              don't want a user closing-and-losing to feel heavy). */}
          <motion.div
            key="outcomes-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(10,10,92,0.32)',
              zIndex: 250,
            }}
          />
          <motion.div
            key="outcomes-card"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 920,
              maxHeight: '85vh',
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 20px 50px rgba(10,10,92,0.22)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 260,
              fontFamily: sansFont,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 22px 14px',
                borderBottom: '1px solid #ececf5',
              }}
            >
              <p
                style={{
                  fontFamily: monoFont,
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: BLUE,
                  margin: 0,
                  fontWeight: 700,
                }}
              >
                Preview outcomes
              </p>
              <h2
                style={{
                  fontFamily: sansFont,
                  fontSize: 18,
                  fontWeight: 700,
                  color: NAVY,
                  margin: '4px 0 0',
                  letterSpacing: '0.01em',
                }}
              >
                {outcomes.length} {outcomes.length === 1 ? 'payment' : 'payments'} ready to send
              </h2>
              <p
                style={{
                  fontFamily: sansFont,
                  fontSize: 12,
                  color: MUTED,
                  margin: '6px 0 0',
                  lineHeight: 1.4,
                }}
              >
                One row per Payee. Each row shows the gross amount, any
                withholding / social security applied, and the final on-ledger
                amount in CC.
              </p>
            </div>

            {/* Warnings — shown ABOVE the table so users fix problems
                before reviewing amounts. */}
            {warnings.length > 0 && (
              <div
                style={{
                  padding: '12px 22px',
                  background: 'rgba(200,120,30,0.06)',
                  borderBottom: '1px solid #f0d8b8',
                  fontFamily: sansFont,
                  fontSize: 12,
                  color: '#8a5a18',
                }}
              >
                <p
                  style={{
                    fontFamily: monoFont,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#8a5a18',
                    fontWeight: 700,
                    margin: '0 0 6px',
                  }}
                >
                  {warnings.length} {warnings.length === 1 ? 'payee skipped' : 'payees skipped'}
                </p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {warnings.map((w, i) => (
                    <li key={i} style={{ marginBottom: 2 }}>
                      {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Table — scrolls independently of the modal so a long
                payroll batch doesn't push the footer off-screen. */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: sansFont,
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: '#f7f7fc',
                      fontFamily: monoFont,
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: MUTED,
                      fontWeight: 700,
                    }}
                  >
                    <th style={thStyle}>Payee</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Location</th>
                    <th style={thRightStyle}>Gross</th>
                    <th style={thRightStyle}>Withhold</th>
                    <th style={thRightStyle}>SS</th>
                    <th style={thRightStyle}>CC amount</th>
                    <th style={thStyle}>Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          padding: '24px 22px',
                          textAlign: 'center',
                          color: MUTED,
                          fontStyle: 'italic',
                        }}
                      >
                        No outcomes to preview — add Payee cards on the canvas
                        and connect them to a Transfer.
                      </td>
                    </tr>
                  )}
                  {outcomes.map((o) => {
                    const employee = employees.find((e) => e.id === o.employeeId)
                    const payee = canvas.cards.find((c) => c.placementId === o.payeePlacementId)
                    return (
                      <tr
                        key={o.id}
                        style={{
                          borderTop: '1px solid #ececf5',
                        }}
                      >
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: NAVY }}>
                            {employee?.displayName ?? '(unknown)'}
                          </div>
                          <div style={{ fontSize: 10, color: MUTED }}>
                            {payee?.title ?? 'Payee'} · {o.payeePlacementId.slice(0, 12)}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontFamily: monoFont,
                              fontSize: 9,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: 3,
                              background:
                                o.transferVariant === 'employee' ? '#eef0fc' : '#fdf6ec',
                              color:
                                o.transferVariant === 'employee' ? BLUE : '#8a5a18',
                            }}
                          >
                            {o.transferVariant}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, color: NAVY }}>
                            {o.jurisdiction === 'inside_jurisdiction' ? 'Inside' : 'Outside'}
                          </span>
                        </td>
                        <td style={tdRightStyle}>
                          <span style={{ color: NAVY, fontWeight: 600 }}>
                            {o.grossPay}
                          </span>{' '}
                          <span style={{ color: MUTED, fontSize: 10 }}>
                            {currencyLabel(o.payCurrency)}
                          </span>
                        </td>
                        <td style={tdRightStyle}>
                          {o.withholdingAmount ? (
                            <>
                              <span style={{ color: '#8a5a18' }}>
                                −{o.withholdingAmount}
                              </span>{' '}
                              <span style={{ color: MUTED, fontSize: 10 }}>
                                ({formatPct(o.withholdingRate)})
                              </span>
                            </>
                          ) : (
                            <span style={{ color: MUTED }}>—</span>
                          )}
                        </td>
                        <td style={tdRightStyle}>
                          {o.socialSecurityAmount && o.socialSecurityAmount !== '0' ? (
                            <>
                              <span style={{ color: '#8a5a18' }}>
                                −{o.socialSecurityAmount}
                              </span>{' '}
                              <span style={{ color: MUTED, fontSize: 10 }}>
                                ({formatPct(o.socialSecurityRate)})
                              </span>
                            </>
                          ) : (
                            <span style={{ color: MUTED }}>—</span>
                          )}
                        </td>
                        <td style={tdRightStyle}>
                          <span style={{ color: NAVY, fontWeight: 700 }}>
                            {o.amountCC}
                          </span>{' '}
                          <span style={{ color: MUTED, fontSize: 10 }}>CC</span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 10, color: MUTED, maxWidth: 220 }}>
                          {describeRule(outcomeRule(o))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid #ececf5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <p
                style={{
                  fontFamily: monoFont,
                  fontSize: 10,
                  color: MUTED,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                Preview only — nothing has been sent yet
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  height: 32,
                  padding: '0 14px',
                  background: BLUE,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontFamily: monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 700,
  borderBottom: '1px solid #ececf5',
}

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: 'right',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'top',
}

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
}

function currencyLabel(code: PayCurrency): string {
  if ((code as string) === 'CC') return 'CC'
  return code
}

/** Map a decimal-string rate ("0.22") to a percentage label ("22%"). */
function formatPct(rate: string | undefined): string {
  if (!rate) return '—'
  const n = Number(rate)
  if (!isFinite(n)) return rate
  return `${Math.round(n * 100)}%`
}

/** Recover the rule label from the outcome's combination of fields.
 *  Mirrors computeOutcome's branch table. */
function outcomeRule(o: {
  transferVariant: 'contractor' | 'employee'
  jurisdiction: 'inside_jurisdiction' | 'outside_jurisdiction'
  withholdingAmount?: string
}):
  | 'contractor-convert-send'
  | 'employee-inside-withhold-ss-convert-send'
  | 'employee-outside-convert-send' {
  if (o.transferVariant === 'contractor') return 'contractor-convert-send'
  if (o.jurisdiction === 'inside_jurisdiction') {
    return 'employee-inside-withhold-ss-convert-send'
  }
  return 'employee-outside-convert-send'
}
