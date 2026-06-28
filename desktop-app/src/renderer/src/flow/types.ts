// Flow builder shared types. Mirror the structure of my-doctor-ai's
// simulation types but for the payroll domain (Source / Payee /
// Transfer × Contractor/Employee variants).

// ─── Categories & variants ───────────────────────────────────────

export type SimCategory = 'source' | 'payee' | 'transfer'

export type TransferVariant = 'contractor' | 'employee'

export type SimTone = 'blue' | 'teal' | 'navy' | 'muted'

// ─── Per-category fields ─────────────────────────────────────────

export interface SourceFields {
  walletRef: 'treasury'
  minBalanceCC?: string
  memo?: string
}

export interface PayeeFields {
  /** FK into employees.json — set when the user picks an employee. */
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