import type { PlacedCard, SimCardTemplate, SimCategory, SimTone } from '../flow/types'
import type { Employee } from '../ai/types'

type PaymentTemplate = { id: string; name: string; withholdingRate: string; defaultMemo: string; html: string; defaultPlaceholders: string[]; createdAt: string; updatedAt: string }

export const CATEGORY_ORDER: SimCategory[] = ['source', 'payee', 'payment']
export const CATEGORY_LABELS: Record<SimCategory, string> = { source: 'Source', payee: 'Payee', payment: 'Payment' }
export const CATEGORY_PREFIX: Record<SimCategory, string> = { source: 'SOURCE', payee: 'PAYEE', payment: 'PAYMENT' }
export const DIRECT_PAYMENT_PALETTE_ID = 'pay-direct'

export const PALETTE_CARDS: SimCardTemplate[] = [
  { id: 'src-treasury', category: 'source', title: 'Treasury Wallet', sourceFields: { partyId: '' } },
  { id: DIRECT_PAYMENT_PALETTE_ID, category: 'payment', title: 'Direct Payment', paymentFields: { memo: '' } },
]

export function payeeTemplatesFor(employees: Employee[]): SimCardTemplate[] {
  return employees.map((e) => ({ id: 'pay-' + e.id, category: 'payee', title: e.displayName, payeeFields: { employeeId: e.id } }))
}

export function paymentTemplatesFor(templates: PaymentTemplate[]): SimCardTemplate[] {
  return templates.slice().sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ id: 'pay-template-' + t.id, category: 'payment', title: t.name, paymentFields: { templateId: t.id, memo: '' } }))
}

export function paymentTemplateSubtitle(t: PaymentTemplate): string {
  const wht = t.withholdingRate && t.withholdingRate.trim() !== '' ? `${formatRatePct(t.withholdingRate)}% WHT` : null
  const deductions = wht ?? 'no deductions'
  const memoPart = t.defaultMemo ? `memo "${t.defaultMemo}"` : '—'
  return `${deductions} · ${memoPart}`
}

function formatRatePct(rate: string): string {
  const num = Number(rate)
  if (!Number.isFinite(num)) return rate
  const pct = num * 100
  return pct.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function shortPartyId(partyId: string): string {
  if (partyId.length <= 18) return partyId
  return partyId.slice(0, 10) + '…' + partyId.slice(-6)
}

export const TONE_COLORS: Record<SimTone, string> = { blue: '#1A1AE8', teal: '#3EC4C0', navy: '#0a0a5c', muted: '#9999bb' }
const TONE_VALUES: SimTone[] = ['blue', 'teal', 'navy', 'muted']

export function toneForCategory(category: SimCategory): SimTone {
  switch (category) { case 'source': return 'blue'; case 'payee': return 'teal'; case 'payment': return 'navy' }
}

export function randomToneForTile(seed: string): SimTone {
  let hash = 0
  for (let i = 0; i < seed.length; i++) { hash = (hash << 5) - hash + seed.charCodeAt(i); hash |= 0 }
  return TONE_VALUES[Math.abs(hash) % TONE_VALUES.length]
}

const VALID_CONNECTIONS: Record<SimCategory, SimCategory[]> = { source: ['payee'], payee: ['payment'], payment: [] }
export function canConnect(from: SimCategory, to: SimCategory): boolean { return VALID_CONNECTIONS[from]?.includes(to) ?? false }
export function describeConnectionRule(target: SimCategory): string {
  const allowed = Object.entries(VALID_CONNECTIONS).filter(([, targets]) => targets.includes(target)).map(([src]) => CATEGORY_LABELS[src as SimCategory])
  return allowed.length === 0 ? `${CATEGORY_LABELS[target]} cannot accept connections.` : `${CATEGORY_LABELS[target]} can only accept connections from ${allowed.join(' or ')}.`
}

export function toPlacedCard(template: SimCardTemplate, placementId: string): PlacedCard { return { ...template, placementId, tone: toneForCategory(template.category) } }
export function cardHasInput(category: SimCategory): boolean { return category === 'payee' || category === 'payment' }
export function cardHasOutput(category: SimCategory): boolean { return category === 'source' || category === 'payee' }
