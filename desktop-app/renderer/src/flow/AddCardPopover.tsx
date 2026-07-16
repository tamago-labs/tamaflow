import { useEffect, useMemo, useRef, useState } from 'react'
import { MUTED, NAVY, monoFont, sansFont, BORDER } from './theme'
import { CATEGORY_LABELS, CATEGORY_ORDER, PALETTE_CARDS, TONE_COLORS, payeeTemplatesFor, paymentTemplateSubtitle, paymentTemplatesFor, shortPartyId, toneForCategory } from './flowCards'
import type { SimCardTemplate } from './types'
import type { Employee } from '../ai/types'

interface PaymentTemplate { id: string; name: string; withholdingRate: string; defaultMemo: string; html: string; defaultPlaceholders: string[]; createdAt: string; updatedAt: string }

interface AddCardPopoverProps {
  open: boolean
  hasWallet: boolean
  walletPartyId: string
  hasEmployees: boolean
  employees: Employee[]
  paymentTemplates?: PaymentTemplate[]
  onPick: (template: SimCardTemplate) => void
  onClose: () => void
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = { source: 'Where funds originate', payee: 'Who gets paid (employee / contractor)', payment: 'The on-ledger transfer (terminal)' }

export default function AddCardPopover({ open, hasWallet, walletPartyId, hasEmployees, employees, paymentTemplates = [], onPick, onClose }: AddCardPopoverProps) {
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { const t = setTimeout(() => inputRef.current?.focus(), 50); return () => clearTimeout(t) }; setQuery(''); return undefined }, [open])
  useEffect(() => { if (!open) return; function onDown(e: MouseEvent) { if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose() } function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() } window.addEventListener('mousedown', onDown); window.addEventListener('keydown', onKey); return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) } }, [open, onClose])

  const filteredByCategory = useMemo(() => {
    const q = query.trim().toLowerCase()
    const catAvailable: Record<string, boolean> = { source: hasWallet, payee: hasEmployees, payment: true }
    const out: Record<string, SimCardTemplate[]> = {}
    for (const cat of CATEGORY_ORDER) {
      if (!catAvailable[cat]) { out[cat] = []; continue }
      const all = cat === 'payee' ? payeeTemplatesFor(employees) : cat === 'payment' ? [...PALETTE_CARDS.filter((c) => c.category === 'payment'), ...paymentTemplatesFor(paymentTemplates)] : PALETTE_CARDS.filter((c) => c.category === cat)
      out[cat] = all.filter((c) => q === '' || c.title.toLowerCase().includes(q))
    }
    return out
  }, [query, hasWallet, hasEmployees, employees, paymentTemplates])

  if (!open) return null
  const totalMatches = CATEGORY_ORDER.reduce((sum, c) => sum + (filteredByCategory[c]?.length ?? 0), 0)

  return (
    <div ref={containerRef} style={{ position: 'absolute', top: 76, left: 16, width: 360, maxHeight: 'calc(100vh - 110px)', background: '#fff', border: '1px solid ' + BORDER, borderRadius: 8, boxShadow: '0 12px 32px rgba(10,10,92,0.14)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' as const }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid ' + BORDER, background: '#fafaff' }}>
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards…" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0d0e8', borderRadius: 6, fontFamily: sansFont, fontSize: 13, color: NAVY, background: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
      </div>
      <div style={{ overflowY: 'auto', padding: '8px 12px 16px' }}>
        {CATEGORY_ORDER.map((cat) => {
          const items = filteredByCategory[cat]
          const catAvailable: Record<string, boolean> = { source: hasWallet, payee: hasEmployees, payment: true }
          const prereqMissing = !catAvailable[cat]
          if ((!items || items.length === 0) && !prereqMissing) return null
          return (
            <section key={cat} style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <p style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' as const, margin: 0 }}>{CATEGORY_LABELS[cat]}</p>
                <span style={{ color: '#d0d0e8', fontSize: 10 }}>·</span>
                <p style={{ fontFamily: sansFont, fontSize: 10, color: '#b0b0cc', margin: 0 }}>{CATEGORY_DESCRIPTIONS[cat]}</p>
              </div>
              {prereqMissing ? (
                <div style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#a5a5c4', padding: '6px 8px', background: '#f7f7fc', borderRadius: 4, border: '1px dashed ' + BORDER, lineHeight: 1.4 }}>
                  {cat === 'source' ? 'Set up a wallet in Assets to add a Source card' : 'Add employees in Employees to add a Payee card'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {items!.map((c) => (
                      <PopoverTile key={c.id} template={c} employees={employees} paymentTemplates={paymentTemplates} walletPartyId={walletPartyId} onClick={() => onPick(c)} />
                    ))}
                  </div>
                  {cat === 'payment' && paymentTemplates.length === 0 && (
                    <div style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#a5a5c4', padding: '6px 8px', background: '#f7f7fc', borderRadius: 4, border: '1px dashed ' + BORDER, lineHeight: 1.4 }}>
                      Create payment templates in Settings to add custom Payment tiles.
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        })}
        {totalMatches === 0 && (hasWallet || hasEmployees) && (
          <p style={{ fontFamily: sansFont, fontSize: 12, color: MUTED, textAlign: 'center', margin: '20px 0' }}>No cards match "{query}".</p>
        )}
      </div>
    </div>
  )
}

function PopoverTile({ template, employees, paymentTemplates, walletPartyId, onClick }: { template: SimCardTemplate; employees: Employee[]; paymentTemplates: PaymentTemplate[]; walletPartyId: string; onClick: () => void }) {
  const accent = TONE_COLORS[toneForCategory(template.category)]
  const subtitle = (() => {
    if (template.category === 'source') return 'Treasury wallet'
    if (template.category === 'payee') { const employeeId = template.payeeFields?.employeeId; if (!employeeId) return 'Payee'; const emp = employees.find((e) => e.id === employeeId); if (!emp) return 'Payee'; return `${emp.country ?? '?'} · ${emp.payCurrency ?? '?'}` }
    if (template.category === 'payment') { const tid = template.paymentFields?.templateId; if (!tid) return 'No deductions'; const tpl = paymentTemplates.find((t) => t.id === tid); if (!tpl) return 'Template missing'; return paymentTemplateSubtitle(tpl) }
    return ''
  })()
  const title = template.category === 'source' && walletPartyId ? shortPartyId(walletPartyId) : template.title

  return (
    <button type="button" onClick={onClick} style={{ background: '#fff', border: '1px solid ' + BORDER, borderLeft: '3px solid ' + accent, borderRadius: 6, padding: '8px 10px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase' as const, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span>
      <span style={{ fontFamily: sansFont, fontSize: 12, fontWeight: 600, color: NAVY, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
    </button>
  )
}
