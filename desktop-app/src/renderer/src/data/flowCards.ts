// Flow builder card catalog and connection rules.
//
// Three categories: `source` (treasury wallet), `payee` (employee to
// be paid), `payment` (terminal node — the actual on-ledger transfer).
// Deduction rules (withholding, social security) live on the linked
// payment template (`CompanyProfile.paymentTemplates`); Direct Payment
// is always available as a fixed palette tile with no deductions.
//
// Connection chain: source → payee → payment. Payment is terminal.
//
// Each card on the canvas is a `PlacedCard` — a `SimCardTemplate` with
// a unique `placementId` and a `tone` chosen at placement time.

import type { PlacedCard, SimCardTemplate, SimCategory, SimTone } from '../flow/types'
import type { Employee, PaymentTemplate } from '../../../preload/index.d'

export const CATEGORY_ORDER: SimCategory[] = ['source', 'payee', 'payment']

export const CATEGORY_LABELS: Record<SimCategory, string> = {
  source: 'Source',
  payee: 'Payee',
  payment: 'Payment',
}

export const CATEGORY_PREFIX: Record<SimCategory, string> = {
  source: 'SOURCE',
  payee: 'PAYEE',
  payment: 'PAYMENT',
}

// Palette entries — the user picks one of these from the popover to add
// a card to the canvas.
//
// • Source has 1 static tile (the live wallet).
// • Payee is generated per-employee at popover render time (see
//   `payeeTemplatesFor`) so the user picks the specific employee from
//   the palette rather than dropping a generic "Payee" card and binding
//   it later.
// • Payment has 1 fixed tile (Direct Payment, always present, no
//   deductions) PLUS one tile per user-defined payment template (see
//   `paymentTemplatesFor`). The user picks the specific template at
//   drop time.
//
// The Source template's title is intentionally left empty: FlowBuilder
// fills it in from the live wallet partyId at the moment the card is
// dropped, so the card immediately shows which wallet funds originate
// from instead of a "Treasury Wallet" placeholder.
export const DIRECT_PAYMENT_PALETTE_ID = 'pay-direct'

export const PALETTE_CARDS: SimCardTemplate[] = [
  {
    id: 'src-treasury',
    category: 'source',
    // Palette tile label only — FlowBuilder overrides this with
    // shortPartyId(walletPartyId) on placement so the card title on the
    // canvas shows the actual wallet, not this placeholder.
    title: 'Treasury Wallet',
    sourceFields: {
      // partyId is filled in by FlowBuilder.handleAddTemplate from the
      // current useWallet().status.partyId at the moment the card is
      // dropped on the canvas. Leaving it empty here keeps this catalog
      // module pure (no React context).
      partyId: '',
    },
  },
  {
    id: DIRECT_PAYMENT_PALETTE_ID,
    category: 'payment',
    title: 'Direct Payment',
    // `templateId` undefined → built-in Direct Payment (no deductions).
    // Memo is set per-card by the user via PaymentFieldsForm.
    paymentFields: {
      memo: '',
    },
  },
]

/**
 * Build one Payee palette tile per employee. The user picks a specific
 * employee from the popover and the resulting card carries that
 * employee's id from the moment of creation — no separate "bind to
 * employee at edit time" step. The card's title defaults to the
 * employee's displayName (user-renamable via the inline edit form).
 */
export function payeeTemplatesFor(employees: Employee[]): SimCardTemplate[] {
  return employees.map((e) => ({
    id: 'pay-' + e.id,
    category: 'payee',
    title: e.displayName,
    payeeFields: {
      employeeId: e.id,
    },
  }))
}

/**
 * Build one Payment palette tile per user-defined payment template.
 * Returns tiles sorted alphabetically by template name so the palette
 * stays stable as templates are added / renamed. The Direct Payment
 * tile lives in `PALETTE_CARDS` and is added separately by the
 * popover so this function does NOT include it.
 *
 * The `templateId` baked into each tile becomes the card's
 * `paymentFields.templateId` at drop time and is later used by
 * `enumerateRoutes` to look up which rules apply.
 */
export function paymentTemplatesFor(templates: PaymentTemplate[]): SimCardTemplate[] {
  return templates
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({
      id: 'pay-template-' + t.id,
      category: 'payment',
      title: t.name,
      paymentFields: {
        templateId: t.id,
        memo: '',
      },
    }))
}

/**
 * Subtitle shown under a payment-template palette tile. Summarises the
 * rules at-a-glance so the user can tell apart two templates with
 * similar names without clicking each one. Rate percentages are shown
 * with no leading zero; empty rates render as `—`.
 *
 * Examples:
 *   "22% WHT · 5% SS · memo \"March payroll\""
 *   "no deductions · memo \"Bonus\""
 *   "10% WHT · —"
 *   "— · memo \"Q1 contractor\""
 */
export function paymentTemplateSubtitle(t: PaymentTemplate): string {
  const wht = t.withholdingRate && t.withholdingRate.trim() !== ''
    ? `${formatRatePct(t.withholdingRate)}% WHT`
    : null
  const ss = t.socialSecurityRate && t.socialSecurityRate.trim() !== ''
    ? `${formatRatePct(t.socialSecurityRate)}% SS`
    : null
  const deductions =
    wht && ss ? `${wht} · ${ss}`
    : wht ? wht
    : ss ? ss
    : 'no deductions'
  const memoPart = t.defaultMemo ? `memo "${t.defaultMemo}"` : '—'
  return `${deductions} · ${memoPart}`
}

/** Format a 0–1 decimal rate as a percentage string with no trailing
 *  zeros, e.g. "0.05" → "5", "0.225" → "22.5", "0.1234" → "12.34". */
function formatRatePct(rate: string): string {
  const num = Number(rate)
  if (!Number.isFinite(num)) return rate
  const pct = num * 100
  // toFixed(2) then strip trailing zeros / dangling dot.
  return pct
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
}

/**
 * Collapse a Canton party id like
 * `fivenorth::1220a3...7b91::01c8c...` into a short prefix/suffix form
 * for use on cards (full ids don't fit in 220px). Returns the original
 * string when it's already short enough. Shared between CanvasCard
 * (summary line) and FlowBuilder (default title for new Source cards).
 */
export function shortPartyId(partyId: string): string {
  if (partyId.length <= 18) return partyId
  return partyId.slice(0, 10) + '…' + partyId.slice(-6)
}

export const TONE_COLORS: Record<SimTone, string> = {
  blue: '#1A1AE8',
  teal: '#3EC4C0',
  navy: '#0a0a5c',
  muted: '#9999bb',
}

const TONE_VALUES: SimTone[] = ['blue', 'teal', 'navy', 'muted']

/**
 * Pick a stable tone per category. Keeps the canvas visually consistent
 * — Source → blue, Payee → teal, Payment → navy.
 */
export function toneForCategory(category: SimCategory): SimTone {
  switch (category) {
    case 'source':
      return 'blue'
    case 'payee':
      return 'teal'
    case 'payment':
      return 'navy'
  }
}

/**
 * Pick a tone for a palette tile (used by AddCardPopover). Random per
 * tile so the palette looks varied; the actual placed card uses
 * `toneForCategory` for stability.
 */
export function randomToneForTile(seed: string): SimTone {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return TONE_VALUES[Math.abs(hash) % TONE_VALUES.length]
}

/** Connection chain: Source → Payee → Payment. Payment is terminal. */
const VALID_CONNECTIONS: Record<SimCategory, SimCategory[]> = {
  source: ['payee'],
  payee: ['payment'],
  payment: [],
}

export function canConnect(from: SimCategory, to: SimCategory): boolean {
  return VALID_CONNECTIONS[from]?.includes(to) ?? false
}

export function describeConnectionRule(target: SimCategory): string {
  const allowed = Object.entries(VALID_CONNECTIONS)
    .filter(([, targets]) => targets.includes(target))
    .map(([src]) => CATEGORY_LABELS[src as SimCategory])
  return allowed.length === 0
    ? `${CATEGORY_LABELS[target]} cannot accept connections.`
    : `${CATEGORY_LABELS[target]} can only accept connections from ${allowed.join(' or ')}.`
}

export function toPlacedCard(template: SimCardTemplate, placementId: string): PlacedCard {
  return { ...template, placementId, tone: toneForCategory(template.category) }
}

/** Cards that have an input port (can be connected TO). */
export function cardHasInput(category: SimCategory): boolean {
  // Payee and Payment both have inputs. Source is the head of the chain.
  return category === 'payee' || category === 'payment'
}

/** Cards that have an output port (can be connected FROM). */
export function cardHasOutput(category: SimCategory): boolean {
  // Source → Payee (only). Payment is terminal.
  return category === 'source' || category === 'payee'
}