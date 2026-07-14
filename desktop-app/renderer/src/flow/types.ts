export type SimCategory = 'source' | 'payee' | 'payment'
export type SimTone = 'blue' | 'teal' | 'navy' | 'muted'

export interface SourceFields {
  partyId: string
}

export interface PayeeFields {
  employeeId: string
}

export interface PaymentFields {
  templateId?: string
  memo?: string
}

export interface Connection {
  id: string
  from: string
  to: string
}

export interface SimCardTemplate {
  id: string
  category: SimCategory
  title: string
  sourceFields?: SourceFields
  payeeFields?: PayeeFields
  paymentFields?: PaymentFields
}

export interface PlacedCard extends SimCardTemplate {
  placementId: string
  tone: SimTone
}

export interface CanvasCard extends PlacedCard {
  x: number
  y: number
  collapsed: boolean
}

export interface CanvasState {
  cards: CanvasCard[]
  connections: Connection[]
}

export interface CanvasCardEdit {
  title: string
  sourceFields?: SourceFields
  payeeFields?: PayeeFields
  paymentFields?: PaymentFields
}
