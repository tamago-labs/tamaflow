import type { Employee, CompanyProfile, PaymentTemplate, RouteSummary, CanvasCard, Connection } from '../ai/types'
import { computeOutcome, type ComputeInput, type PayCurrency } from './computeOutcome'
import { convert, type PricedCurrency } from '../lib/priceProvider'
import { DIRECT_PAYMENT_TEMPLATE_ID } from './paymentTemplate'
import type { PayeeFields, PaymentFields } from '../flow/types'

export interface EnumerateInput {
  flowId: string
  cards: CanvasCard[]
  connections: Connection[]
  employees: Employee[]
  companyProfile: CompanyProfile | null
}

export interface EnumerationWarning {
  payeePlacementId: string
  message: string
}

export interface EnumerationResult {
  routes: RouteSummary[]
  warnings: EnumerationWarning[]
}

function resolveGrossPay(employee: Employee): { value: string; payCurrency: PayCurrency } | { error: string } {
  const payCurrency = employee.payCurrency as PayCurrency | null
  if (!payCurrency) return { error: 'payCurrency not set' }

  switch (employee.payFrequency) {
    case 'monthly':
    case 'one-off': {
      if (!employee.salaryAmount) return { error: 'salaryAmount required for monthly/one-off' }
      return { value: employee.salaryAmount, payCurrency }
    }
    case 'biweekly': {
      if (!employee.salaryAmount) return { error: 'salaryAmount required for biweekly' }
      const monthly = parseDecimal(employee.salaryAmount)
      if (monthly === null) return { error: `Invalid salaryAmount: ${employee.salaryAmount}` }
      return { value: (monthly / 2).toFixed(2), payCurrency }
    }
    case 'weekly': {
      if (!employee.salaryAmount) return { error: 'salaryAmount required for weekly' }
      const monthly = parseDecimal(employee.salaryAmount)
      if (monthly === null) return { error: `Invalid salaryAmount: ${employee.salaryAmount}` }
      return { value: (monthly / (52 / 12)).toFixed(2), payCurrency }
    }
    case 'hourly': {
      if (!employee.hourlyRate) return { error: 'hourlyRate required for hourly' }
      const rate = parseDecimal(employee.hourlyRate)
      if (rate === null) return { error: `Invalid hourlyRate: ${employee.hourlyRate}` }
      return { value: (rate * 160).toFixed(2), payCurrency }
    }
    default:
      return { error: `Unsupported payFrequency: ${String(employee.payFrequency)}` }
  }
}

function parseDecimal(s: string): number | null {
  const trimmed = s.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  return Number(trimmed)
}

function readPayeeFields(card: CanvasCard): PayeeFields | null {
  if (card.category !== 'payee') return null
  if (!card.payeeFields) return null
  return card.payeeFields as unknown as PayeeFields
}

function readPaymentFields(card: CanvasCard): PaymentFields | null {
  if (card.category !== 'payment') return null
  if (!card.paymentFields) return null
  return card.paymentFields as unknown as PaymentFields
}

function applyDeductions(grossPay: string, template: PaymentTemplate | null): { adjustedGross: string; withholdingAmount?: string; socialSecurityAmount?: string } {
  if (!template) return { adjustedGross: grossPay }
  let withholdingAmount: string | undefined
  let net = grossPay
  if (template.withholdingRate && template.withholdingRate.trim() !== '') {
    withholdingAmount = mulDecimal(grossPay, template.withholdingRate, 2)
    net = subDecimal(net, withholdingAmount, 2)
  }
  return { adjustedGross: net, ...(withholdingAmount && { withholdingAmount }) }
}

function mulDecimal(value: string, rate: string, precision: number): string {
  const trimValue = value.trim()
  const trimRate = rate.trim()
  if (!/^\d+(\.\d+)?$/.test(trimValue)) throw new Error(`Invalid value: ${value}`)
  if (!/^\d+(\.\d+)?$/.test(trimRate)) throw new Error(`Invalid rate: ${rate}`)
  const RATE_PRECISION = 18
  const toMinor = (s: string, d: number): bigint => {
    const [whole, frac = ''] = s.split('.')
    const padded = (frac + '0'.repeat(d)).slice(0, d)
    return BigInt(whole) * BigInt(10) ** BigInt(d) + BigInt(padded || '0')
  }
  const valueMinor = toMinor(trimValue, precision)
  const rateMinor = toMinor(trimRate, RATE_PRECISION)
  const product = valueMinor * rateMinor
  const divisor = BigInt(10) ** BigInt(RATE_PRECISION)
  const quotient = product / divisor
  const remainder = product % divisor
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient
  const factor = BigInt(10) ** BigInt(precision)
  const whole = rounded / factor
  const frac = rounded % factor
  const fracStr = frac.toString().padStart(precision, '0')
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed === '' ? whole.toString() : `${whole.toString()}.${trimmed}`
}

function subDecimal(a: string, b: string, precision: number): string {
  const trimA = a.trim()
  const trimB = b.trim()
  if (!/^\d+(\.\d+)?$/.test(trimA)) throw new Error(`Invalid value: ${a}`)
  if (!/^\d+(\.\d+)?$/.test(trimB)) throw new Error(`Invalid value: ${b}`)
  const toMinor = (s: string, d: number): bigint => {
    const [whole, frac = ''] = s.split('.')
    const padded = (frac + '0'.repeat(d)).slice(0, d)
    return BigInt(whole) * BigInt(10) ** BigInt(d) + BigInt(padded || '0')
  }
  const aMinor = toMinor(trimA, precision)
  const bMinor = toMinor(trimB, precision)
  const diff = aMinor - bMinor
  const factor = BigInt(10) ** BigInt(precision)
  const whole = diff / factor
  const frac = diff % factor
  if (diff < 0n) return '0'
  const fracStr = frac.toString().padStart(precision, '0')
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed === '' ? whole.toString() : `${whole.toString()}.${trimmed}`
}

function freshRouteId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return 'r_' + crypto.randomUUID().replace(/-/g, '')
  }
  return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

export function enumerateRoutes(input: EnumerateInput): EnumerationResult {
  const { flowId, cards, connections, employees, companyProfile } = input

  const payees = cards.filter((c) => c.category === 'payee')
  const sourcesById = new Map(cards.filter((c) => c.category === 'source').map((c) => [c.placementId, c]))
  const paymentsById = new Map(cards.filter((c) => c.category === 'payment').map((c) => [c.placementId, c]))

  const incoming = new Map<string, string[]>()
  for (const conn of connections) {
    const arr = incoming.get(conn.to) ?? []
    arr.push(conn.from)
    incoming.set(conn.to, arr)
  }

  const employeeById = new Map(employees.map((e) => [e.id, e]))
  const routes: RouteSummary[] = []
  const warnings: EnumerationWarning[] = []

  for (const payee of payees) {
    const employeeId = (payee.payeeFields?.employeeId as string) || ''
    if (!employeeId) {
      warnings.push({ payeePlacementId: payee.placementId, message: 'Payee card has no employee selected.' })
      continue
    }
    const employee = employeeById.get(employeeId)
    if (!employee) {
      warnings.push({ payeePlacementId: payee.placementId, message: `Employee ${employeeId} not found.` })
      continue
    }
    if (employee.status !== 'active') {
      warnings.push({ payeePlacementId: payee.placementId, message: `Employee ${employee.displayName} is ${employee.status} — skipped.` })
      continue
    }

    const upstreamIds = incoming.get(payee.placementId) ?? []
    if (upstreamIds.length === 0) {
      warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: Payee card has no connected Source.` })
      continue
    }
    const sourceCard = sourcesById.get(upstreamIds[0])
    if (!sourceCard) {
      warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: connected Source card not found.` })
      continue
    }

    const outgoingIds = connections.filter((c) => c.from === payee.placementId).map((c) => c.to)
    if (outgoingIds.length === 0) {
      warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: Payee has no connected Payment.` })
      continue
    }
    const paymentCard = paymentsById.get(outgoingIds[0])
    if (!paymentCard) {
      warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: connected Payment card not found.` })
      continue
    }

    const payeeFields = readPayeeFields(payee)
    const paymentFields = readPaymentFields(paymentCard)

    const templateId = paymentFields?.templateId
    let template: PaymentTemplate | null = null
    if (templateId && templateId !== DIRECT_PAYMENT_TEMPLATE_ID) {
      template = companyProfile?.paymentTemplates?.find((t) => t.id === templateId) ?? null
      if (template === null) {
        warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: payment template deleted — falling back to Direct Payment.` })
      }
    }

    const gross = resolveGrossPay(employee)
    if ('error' in gross) {
      warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: ${gross.error}` })
      continue
    }

    let adjustedGross: string
    let withholdingAmount: string | undefined
    let socialSecurityAmount: string | undefined
    try {
      const result = applyDeductions(gross.value, template)
      adjustedGross = result.adjustedGross
      withholdingAmount = result.withholdingAmount
      socialSecurityAmount = result.socialSecurityAmount
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: deduction error — ${msg}` })
      continue
    }

    let fxRate: string | undefined
    if ((gross.payCurrency as string) !== 'CC') {
      const ccPerUnit = convert(1, gross.payCurrency as PricedCurrency, 'CC')
      if (ccPerUnit === null) {
        warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: no FX rate for ${gross.payCurrency} — update the price provider.` })
        continue
      }
      fxRate = ccPerUnit.toFixed(18).replace(/0+$/, '').replace(/\.$/, '')
    }

    const computeInput: ComputeInput = { grossPay: adjustedGross, payCurrency: gross.payCurrency, fxRate }

    let computed
    try {
      computed = computeOutcome(computeInput)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: ${msg}` })
      continue
    }

    const memo = paymentFields?.memo?.trim() || template?.defaultMemo?.trim() || companyProfile?.directPaymentDefaultMemo?.trim() || ''

    const route: RouteSummary = {
      id: freshRouteId(),
      flowId,
      status: 'pending',
      employeeId,
      payeePlacementId: payee.placementId,
      sourcePlacementId: sourceCard.placementId,
      paymentPlacementId: paymentCard.placementId,
      amountCC: computed.amountCC,
      payCurrency: computed.payCurrency,
      grossPay: gross.value,
      recipientPartyId: employee.cantonPartyId ?? '',
      memo,
      createdAt: new Date().toISOString(),
    }
    if (computed.fxRateApplied !== undefined) route.fxRate = computed.fxRateApplied
    if (withholdingAmount) route.withholdingAmount = withholdingAmount
    if (socialSecurityAmount) route.socialSecurityAmount = socialSecurityAmount
    void payeeFields
    routes.push(route)
  }

  return { routes, warnings }
}
