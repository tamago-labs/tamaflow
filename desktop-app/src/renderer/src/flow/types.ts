// Flow builder shared types. Mirror the structure of my-doctor-ai's
// simulation types but for the payroll domain (Source / Payee /
// Transfer × Contractor/Employee variants).

// ─── Categories & variants ───────────────────────────────────────

export type SimCategory = 'source' | 'payee' | 'transfer'

export type TransferVariant = 'contractor' | 'employee'

export type SimTone = 'blue' | 'teal' | 'navy' | 'muted'

// ─── Per-category fields ─────────────────────────────────────────

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
  /** Decimal string. Worker aborts the run if treasury CC balance < this. */
  minBalanceCC?: string
  /** Baked into every outcome's transfer memo. */
  memo?: string
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
  note?: string
}

export interface ContractorTransferFields {
  variant: 'contractor'
  /** CC per 1 unit of payCurrency. Required when payCurrency !== 'CC'. */
  fxRate?: string
}

export interface EmployeeTransferFields {
  variant: 'employee'
  /** Decimal string, e.g. "0.22" for 22%. */
  withholdingRate: string
  /** Decimal string, e.g. "0.05" for 5%. Optional, defaults to 0. */
  socialSecurityRate?: string
  /** CC per 1 unit of payCurrency. Required when payCurrency !== 'CC'. */
  fxRate?: string
}

// ─── Connection ──────────────────────────────────────────────────

export interface Connection {
  id: string
  from: string // placementId of the source card
  to: string   // placementId of the target card
}

// ─── Card template (palette entry) ───────────────────────────────

export interface SimCardTemplate {
  id: string
  category: SimCategory
  title: string
  /** Only set when category === 'transfer'. */
  transferVariant?: TransferVariant
  sourceFields?: SourceFields
  payeeFields?: PayeeFields
  contractorTransferFields?: ContractorTransferFields
  employeeTransferFields?: EmployeeTransferFields
}

// ─── Placed card (a specific instance on the canvas) ─────────────

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

// ─── Edit payload (returned from CanvasCard's edit form) ────────

export interface CanvasCardEdit {
  title: string
  sourceFields?: SourceFields
  payeeFields?: PayeeFields
  contractorTransferFields?: ContractorTransferFields
  employeeTransferFields?: EmployeeTransferFields
}