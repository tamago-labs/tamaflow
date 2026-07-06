import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Employee, CompanyProfile, CanvasCard, Connection } from '../ai/types'
import type { CanvasState } from './types'
import { enumerateRoutes } from '../shared/flowPaths'
import { usePrice } from '../context/PriceContext'
import { BLUE, MUTED, NAVY, monoFont, sansFont } from './theme'

interface RoutesPreviewModalProps {
  open: boolean
  onClose: () => void
  flowId: string
  canvas: CanvasState
  employees: Employee[]
  companyProfile: CompanyProfile | null
}

export default function RoutesPreviewModal({ open, onClose, flowId, canvas, employees, companyProfile }: RoutesPreviewModalProps) {
  const { convert, formatConverted, updated } = usePrice()
  const { routes, warnings } = useMemo(() => enumerateRoutes({ flowId, cards: canvas.cards as unknown as CanvasCard[], connections: canvas.connections as unknown as Connection[], employees, companyProfile }), [flowId, canvas.cards, canvas.connections, employees, companyProfile])

  const totals = useMemo(() => {
    let totalCC = 0
    for (const r of routes) { const n = Number(r.amountCC); if (Number.isFinite(n)) totalCC += n }
    const baseCurrency = companyProfile?.baseCurrency ?? 'USD'
    const totalBase = convert(totalCC, 'CC', baseCurrency as any)
    return { totalCC, totalBase, baseCurrency }
  }, [routes, companyProfile?.baseCurrency, convert])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="routes-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,92,0.32)', zIndex: 250 }} />
          <motion.div key="routes-card" initial={{ opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} exit={{ opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }} transition={{ duration: 0.15 }} onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: '50%', left: '50%', width: 880, maxHeight: '85vh', background: '#fff', borderRadius: 8, boxShadow: '0 20px 50px rgba(10,10,92,0.22)', display: 'flex', flexDirection: 'column', zIndex: 260, fontFamily: sansFont }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #ececf5' }}>
              <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: BLUE, margin: 0, fontWeight: 700 }}>Preview routes</p>
              <h2 style={{ fontFamily: sansFont, fontSize: 18, fontWeight: 700, color: NAVY, margin: '4px 0 0', letterSpacing: '0.01em' }}>{routes.length} {routes.length === 1 ? 'payment' : 'payments'} ready to send</h2>
              <p style={{ fontFamily: sansFont, fontSize: 12, color: MUTED, margin: '6px 0 0', lineHeight: 1.4 }}>One row per Payee. Each row shows the gross amount, deductions, FX rate, and final CC amount.</p>
            </div>
            {warnings.length > 0 && <div style={{ padding: '12px 22px', background: 'rgba(200,120,30,0.06)', borderBottom: '1px solid #f0d8b8', fontFamily: sansFont, fontSize: 12, color: '#8a5a18' }}><p style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a5a18', fontWeight: 700, margin: '0 0 6px' }}>{warnings.length} {warnings.length === 1 ? 'payee skipped' : 'payees skipped'}</p><ul style={{ margin: 0, paddingLeft: 18 }}>{warnings.map((w, i) => <li key={i} style={{ marginBottom: 2 }}>{w.message}</li>)}</ul></div>}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: sansFont, fontSize: 12 }}>
                <thead><tr style={{ background: '#f7f7fc', fontFamily: monoFont, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, fontWeight: 700 }}><th style={thStyle}>Payee</th><th style={thStyle}>Country</th><th style={thRightStyle}>Gross</th><th style={thStyle}>Deductions</th><th style={thRightStyle}>FX</th><th style={thRightStyle}>CC amount</th></tr></thead>
                <tbody>
                  {routes.length === 0 && <tr><td colSpan={6} style={{ padding: '24px 22px', textAlign: 'center', color: MUTED, fontStyle: 'italic' }}>No routes to preview.</td></tr>}
                  {routes.map((r) => { const employee = employees.find((e) => e.id === r.employeeId); const payee = canvas.cards.find((c) => c.placementId === r.payeePlacementId); const deductionsLabel = (() => { const w = r.withholdingAmount; const s = r.socialSecurityAmount; if (!w && !s) return '—'; const parts: string[] = []; if (w) parts.push(`−${w}`); if (s) parts.push(`−${s} SS`); return parts.join(' · ') })(); return <tr key={r.id} style={{ borderTop: '1px solid #ececf5' }}><td style={tdStyle}><div style={{ fontWeight: 600, color: NAVY }}>{employee?.displayName ?? '(unknown)'}</div><div style={{ fontSize: 10, color: MUTED }}>{payee?.title ?? 'Payee'}</div></td><td style={tdStyle}><span style={{ fontSize: 11, color: NAVY }}>{employee?.country ?? '—'}</span></td><td style={tdRightStyle}><span style={{ color: NAVY, fontWeight: 600 }}>{r.grossPay}</span> <span style={{ color: MUTED, fontSize: 10 }}>{r.payCurrency}</span></td><td style={tdStyle}><span style={{ fontSize: 10, color: deductionsLabel === '—' ? MUTED : '#8a5a18', fontFamily: monoFont, letterSpacing: '0.02em' }}>{deductionsLabel}</span></td><td style={tdRightStyle}>{r.fxRate ? <span style={{ color: MUTED, fontSize: 10 }}>{r.fxRate}</span> : <span style={{ color: MUTED }}>—</span>}</td><td style={tdRightStyle}><span style={{ color: NAVY, fontWeight: 700 }}>{r.amountCC}</span> <span style={{ color: MUTED, fontSize: 10 }}>CC</span></td></tr> })}
                </tbody>
                {routes.length > 0 && <tfoot><tr style={{ borderTop: '2px solid #ececf5', background: '#fafaff' }}><td colSpan={5} style={{ ...tdStyle, textAlign: 'right', fontFamily: monoFont, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, fontWeight: 700 }}>Total</td><td style={tdRightStyle}><div style={{ color: NAVY, fontWeight: 700 }}>{formatConverted(totals.totalCC, 'CC')} CC</div>{totals.totalBase !== null && <div style={{ fontSize: 10, color: MUTED, fontFamily: monoFont, marginTop: 2 }}>≈ {formatConverted(totals.totalBase, totals.baseCurrency as any)} {totals.baseCurrency}</div>}</td></tr></tfoot>}
              </table>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #ececf5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <p style={{ fontFamily: monoFont, fontSize: 10, color: MUTED, letterSpacing: '0.10em', textTransform: 'uppercase', margin: 0 }}>Preview only · price as of {updated}</p>
              <button type="button" onClick={onClose} style={{ height: 32, padding: '0 14px', background: BLUE, color: '#fff', border: 'none', borderRadius: 6, fontFamily: monoFont, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Close</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #ececf5' }
const thRightStyle: React.CSSProperties = { ...thStyle, textAlign: 'right' }
const tdStyle: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' }
const tdRightStyle: React.CSSProperties = { ...tdStyle, textAlign: 'right' }
