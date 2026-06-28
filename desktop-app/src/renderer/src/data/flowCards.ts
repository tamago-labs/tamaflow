// Flow builder card catalog and connection rules.
//
// Two categories only — `source` (treasury wallet) and `payee`
// (employee to be paid). Source connects directly to Payee; Payee
// is terminal. The compute step derives gross pay from the employee
// roster and converts to CC via the FX rate stamped on the Payee.
//
// Each card on the canvas is a `PlacedCard` — a `SimCardTemplate` with
// a unique `placementId` and a `tone` chosen at placement time.

import type { PlacedCard, SimCardTemplate, SimCategory, SimTone } from '../flow/types'
import type { Employee } from '../../../preload/index.d'

export const CATEGORY_ORDER: SimCategory[] = ['source', 'payee']

export const CATEGORY_LABELS: Record<SimCategory, string> = {
  source: 'Source',
  payee: 'Payee',
}

export const CATEGORY_PREFIX: Record<SimCategory, string> = {
  source: 'SOURCE',
  payee: 'PAYEE',
}

// Palette entries — the user picks one of these from the popover to add
// a card to the canvas. Source has 1 static tile; Payee is NOT here —
// tiles are generated per-employee at popover render time (see
// `payeeTemplatesFor`) so the user picks the specific employee from the
// palette rather than dropping a generic "Payee" card and binding it
// later.
//
// The Source template's title is intentionally left empty: FlowBuilder
// fills it in from the live wallet partyId at the moment the card is
// dropped, so the card immediately shows which wallet funds originate
// from instead of a "Treasury Wallet" placeholder.
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
]

/**
 * Build one Payee palette tile per employee. The user picks a specific
 * employee from the popover and the resulting card carries that employee's
 * id from the moment of creation — no separate "bind to employee at edit
 * time" step. The card's title defaults to the employee's displayName
 * (user-renamable via the inline edit form).
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
 * — Source → blue, Payee → teal. No random hashing.
 */
export function toneForCategory(category: SimCategory): SimTone {
  switch (category) {
    case 'source':
      return 'blue'
    case 'payee':
      return 'teal'
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

/** Connection rules (Source → Payee; Payee is terminal). */
const VALID_CONNECTIONS: Record<SimCategory, SimCategory[]> = {
  source: ['payee'],
  payee: [],
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

export function cardHasInput(category: SimCategory): boolean {
  // Only Payee accepts a connection from Source. Source is the head of
  // the pipeline.
  return category === 'payee'
}

export function cardHasOutput(category: SimCategory): boolean {
  // Only Source has an output port (it connects downstream to Payees).
  return category === 'source'
}