// Flow builder card catalog and connection rules.
//
// Three categories: source / payee / transfer.
// Transfer has two variants: contractor / employee.
//
// Connection rules form a strict linear pipeline:
//   source  → payee
//   payee   → transfer
//   transfer (terminal)
//
// Each card on the canvas is a `PlacedCard` — a `SimCardTemplate` with
// a unique `placementId` and a `tone` chosen at placement time.

import type { PlacedCard, SimCardTemplate, SimCategory, SimTone, TransferVariant } from '../flow/types'

export const CATEGORY_ORDER: SimCategory[] = ['source', 'payee', 'transfer']

export const CATEGORY_LABELS: Record<SimCategory, string> = {
  source: 'Source',
  payee: 'Payee',
  transfer: 'Transfer',
}

export const CATEGORY_PREFIX: Record<SimCategory, string> = {
  source: 'SRC',
  payee: 'PAY',
  transfer: 'XFR',
}

export const TRANSFER_VARIANT_LABELS: Record<TransferVariant, string> = {
  contractor: 'Contractor',
  employee: 'Employee',
}

export const TRANSFER_VARIANT_PREFIX: Record<TransferVariant, string> = {
  contractor: 'CTR',
  employee: 'EMP',
}

// Palette entries — the user picks one of these from the popover to add
// a card to the canvas. Source has 1, Payee has 1 (it gets bound to a
// specific employee at edit time), Transfer has 2 (one per variant).
export const PALETTE_CARDS: SimCardTemplate[] = [
  {
    id: 'src-treasury',
    category: 'source',
    title: 'Treasury Wallet',
    sourceFields: {
      walletRef: 'treasury',
      memo: 'Payroll batch',
    },
  },
  {
    id: 'pay-payee',
    category: 'payee',
    title: 'Payee',
    payeeFields: {
      employeeId: '',
    },
  },
  {
    id: 'xfr-contractor',
    category: 'transfer',
    transferVariant: 'contractor',
    title: 'Contractor Transfer',
    contractorTransferFields: {
      variant: 'contractor',
      fxRate: '',
    },
  },
  {
    id: 'xfr-employee',
    category: 'transfer',
    transferVariant: 'employee',
    title: 'Employee Transfer',
    employeeTransferFields: {
      variant: 'employee',
      withholdingRate: '',
      socialSecurityRate: '',
      fxRate: '',
    },
  },
]

export const TONE_COLORS: Record<SimTone, string> = {
  blue: '#1A1AE8',
  teal: '#3EC4C0',
  navy: '#0a0a5c',
  muted: '#9999bb',
}

const TONE_VALUES: SimTone[] = ['blue', 'teal', 'navy', 'muted']

/**
 * Pick a stable tone per category. Keeps the canvas visually consistent
 * — Source → blue, Payee → teal, Transfer → navy. No random hashing.
 */
export function toneForCategory(category: SimCategory): SimTone {
  switch (category) {
    case 'source':
      return 'blue'
    case 'payee':
      return 'teal'
    case 'transfer':
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

/** Connection rules (strict linear pipeline). */
const VALID_CONNECTIONS: Record<SimCategory, SimCategory[]> = {
  source: ['payee'],
  payee: ['transfer'],
  transfer: [],
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
  return category !== 'source'
}

export function cardHasOutput(category: SimCategory): boolean {
  return category !== 'transfer'
}