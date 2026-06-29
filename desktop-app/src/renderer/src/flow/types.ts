// Flow builder shared types. Three card categories:
//
//   source  → payee → payment (Direct Payment OR a custom template)
//   payment (terminal)
//
// Each Payment pays its upstream Payee from its upstream Source wallet.
// Gross pay is derived from the employee's roster record; withholding +
// social security come from the linked `PaymentTemplate`
// (`CompanyProfile.paymentTemplates[]` — see Settings → Payment
// templates). Direct Payment carries no deductions. The FX rate is
// fetched from the price provider at compute time — no per-card rate
// input.

// ─── Categories ────────────────────────────────────────────

export type SimCategory = 'source' | 'payee' | 'payment'

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

/**
 * Payee card fields. The only stored value is the employee id — every
 * other property (name, salary, currency, country) is resolved from the
 * Employee roster at render time, and the FX rate is auto-fetched from
 * the price provider. Storing these on the card would let stale snapshots
 * survive an employee being renamed or removed.
 */
export interface PayeeFields {
  /**
   * FK into the employee roster. Set when the card is created from the
   * palette (one tile per employee) and never rebound at edit time.
   */
  employeeId: string
}

/**
 * The Payment card carries a per-card memo + an optional FK into a
 * user-defined payment template (`CompanyProfile.paymentTemplates`).
 * When `templateId` is undefined (or `'direct'`), the card runs as
 * the built-in Direct Payment — no deductions, memo-only.
 *
 * Amount comes from the employee's salary — no per-card override.
 * Deductions (withholding, social security) live on the linked
 * template (Settings → Payment templates). If the template is later
 * deleted, the route falls back to Direct Payment and a warning chip
 * appears on the card.
 */
export interface PaymentFields {
  /** FK into `companyProfile.paymentTemplates[]`. `undefined` (or
   *  `'direct'`) = built-in Direct Payment. See shared
   *  `DIRECT_PAYMENT_TEMPLATE_ID` for the sentinel. */
  templateId?: string
  /** Optional per-card memo override. Falls back to the linked
   *  template's `defaultMemo`. Direct Payment has no template so the
   *  fallback is empty — see
   *  `CompanyProfile.directPaymentDefaultMemo` if you want a global
   *  fallback for Direct Payment. */
  memo?: string
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
  paymentFields?: PaymentFields
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
  paymentFields?: PaymentFields
}