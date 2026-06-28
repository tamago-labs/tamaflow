// Flow builder shared types. Two card categories only:
//
//   source  → payee
//   payee   (terminal)
//
// Each Payee is paid from its upstream Source wallet. Gross pay is
// derived from the employee's roster record and converted to CC at
// the rate stamped on the Payee card (no Transfer card in MVP).

// ─── Categories ────────────────────────────────────────────

export type SimCategory = 'source' | 'payee'

export type SimTone = 'blue' | 'teal' | 'navy' | 'muted'

// ─── Per-category fields ──────────────────────────────────────────

export interface SourceFields {
  /**
   * Canton party id of the wallet funds originate from. Snapshotted from
   * `useWallet().status.partyId` at the moment the card is created so the
   * flow stays runnable even if the user later destroys and recreates
   * the wallet (the worker will still execute against the recorded id).
   * The card's display label lives on `CanvasCard.title` (user-editable;
   * FlowBuilder seeds it with the shortPartyId of the snapshot so the
   * wallet identity is visible at-a-glance) — renaming the card never
   * touches the party id.
   */
  partyId: string
}

export interface PayeeFields {
  /**
   * FK into the employee roster. Set when the card is created from the
   * palette (one tile per employee) and never rebound at edit time — the
   * renderer resolves this to a full Employee record (displayName,
   * cantonPartyId, jurisdiction, etc.) at render time so stale snapshots
   * can't survive an employee being renamed or removed.
   */
  employeeId: string
  /**
   * CC per 1 unit of payCurrency. Required when `payCurrency !== 'CC'`.
   * The Payee card owns the rate because the rate is a per-payment
   * decision (it changes with the market) rather than a per-employee
   * attribute. Optional on the type — runtime validation enforces
   * presence when the source isn't already CC.
   */
  fxRate?: string
  /**
   * Override of the gross pay amount (in payCurrency). When set,
   * compute uses this value instead of `employee.salaryAmount × payFrequency`.
   * Lets the user pay a one-off amount without editing the employee
   * record. Optional.
   */
  amountOverride?: string
  note?: string
}

// ─── Connection ──────────────────────────────────────────────────

export interface Connection {
  id: string
  from: string // placementId of the source card
  to: string   // placementId of the target card
}

// ─── Card template (palette entry) ────────────────────────────────

export interface SimCardTemplate {
  id: string
  category: SimCategory
  title: string
  sourceFields?: SourceFields
  payeeFields?: PayeeFields
}

// ─── Placed card (a specific instance on the canvas) ──────────────

export interface PlacedCard extends SimCardTemplate {
  placementId: string
  tone: SimTone
}

export interface CanvasCard extends PlacedCard {
  x: number
  y: number
  collapsed: boolean
}

// ─── Canvas state ────────────────────────────────────────────────

export interface CanvasState {
  cards: CanvasCard[]
  connections: Connection[]
}

// ─── Edit payload (returned from CanvasCard's edit form) ─────────

export interface CanvasCardEdit {
  title: string
  sourceFields?: SourceFields
  payeeFields?: PayeeFields
}