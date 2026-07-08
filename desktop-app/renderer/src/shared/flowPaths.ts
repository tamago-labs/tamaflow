import type { Employee, CompanyProfile, PaymentTemplate, RouteSummary, CanvasCard, Connection, TaxObligation } from '../ai/types'
import { computeOutcome, type ComputeInput, type PayCurrency } from './computeOutcome'
import { convert, type PricedCurrency } from '../lib/priceProvider'
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

/**
 * Normalize an obligation amount based on pay frequency.
 * - per_year: divide by 12 for monthly, by 2 for biweekly, etc.
 * - per_month: use as-is for monthly, multiply for biweekly, etc.
 */
function normalizeObligationAmount(
  obligation: TaxObligation | undefined,
  payFrequency: string,
  grossPayCurrency: string
): { amount: string; converted: boolean } {
  if (!obligation || !obligation.amount || parseDecimal(obligation.amount) === null) {
    return { amount: '0', converted: false }
  }

  let amount = parseDecimal(obligation.amount) ?? 0

  // Convert currency if different from pay currency
  let converted = false
  if (obligation.currency !== grossPayCurrency) {
    const rate = convert(1, obligation.currency as any, grossPayCurrency as any)
    if (rate !== null) {
      amount = amount * rate
      converted = true
    }
  }

  // Normalize based on term and pay frequency
  const periodsPerYear = getPeriodsPerYear(payFrequency)
  if (obligation.term === 'per_year') {
    // Divide annual amount by number of pay periods per year
    amount = amount / periodsPerYear
  }
  // per_month: already monthly, no adjustment needed for monthly pay
  // For other frequencies, multiply by months in period
  else if (obligation.term === 'per_month') {
    if (payFrequency === 'biweekly') amount = amount * 2
    else if (payFrequency === 'weekly') amount = amount * 4.33
    else if (payFrequency === 'hourly') amount = amount * (160 / 160) // hourly is already monthly equivalent
  }

  return { amount: Math.max(0, amount).toFixed(2), converted }
}

function getPeriodsPerYear(payFrequency: string): number {
  switch (payFrequency) {
    case 'monthly': return 12
    case 'biweekly': return 26
    case 'weekly': return 52
    case 'hourly': return 12
    case 'one-off': return 1
    default: return 12
  }
}

/**
 * Apply deductions based on the payment template's settings.
 * - If template has withholdingRate, apply it as a percentage
 * - If template has applyEmployeeTax, deduct employee's tax obligation
 * - If template has applyEmployeeSocialSecurity, deduct employee's SS
 * - Direct Payment (no template) = no deductions
 */
function applyDeductionsFromTemplate(
  grossPay: string,
  employee: Employee,
  template: PaymentTemplate | null
): { adjustedGross: string; taxAmount?: string; socialSecurityAmount?: string; netPay: string } {
  let taxAmount = '0'
  let ssAmount = '0'
  let net = parseDecimal(grossPay) ?? 0

  // Direct Payment (no template) = no deductions
  if (!template) {
    return { adjustedGross: grossPay, netPay: grossPay }
  }

  // Apply withholding rate from template if set
  if (template.withholdingRate && template.withholdingRate.trim() !== '') {
    const rate = parseDecimal(template.withholdingRate)
    if (rate !== null && rate > 0) {
      const deduction = net * rate
      taxAmount = deduction.toFixed(2)
      net = net - deduction
    }
  }

  // Apply per-employee tax if template enables it
  if (template.applyEmployeeTax && employee.taxObligation) {
    const { amount } = normalizeObligationAmount(employee.taxObligation, employee.payFrequency, employee.payCurrency)
    const taxAmt = parseDecimal(amount) ?? 0
    if (taxAmt > 0) {
      taxAmount = (parseDecimal(taxAmount) ?? 0 + taxAmt).toFixed(2)
      net = net - taxAmt
    }
  }

  // Apply per-employee social security if template enables it
  if (template.applyEmployeeSocialSecurity && employee.socialSecurity) {
    const { amount } = normalizeObligationAmount(employee.socialSecurity, employee.payFrequency, employee.payCurrency)
    const ssAmt = parseDecimal(amount) ?? 0
    if (ssAmt > 0) {
      ssAmount = ssAmt.toFixed(2)
      net = net - ssAmt
    }
  }

  return {
    adjustedGross: Math.max(0, net).toFixed(2),
    taxAmount: (parseDecimal(taxAmount) ?? 0) > 0 ? taxAmount : undefined,
    socialSecurityAmount: (parseDecimal(ssAmount) ?? 0) > 0 ? ssAmount : undefined,
    netPay: Math.max(0, net).toFixed(2)
  }
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

    // Find the template for this payment card
    const templateId = paymentFields?.templateId
    console.log('[flowPaths] templateId:', templateId, 'paymentTemplates:', companyProfile?.paymentTemplates?.map(t => ({ id: t.id, name: t.name, applyTax: t.applyEmployeeTax, applySS: t.applyEmployeeSocialSecurity })))
    let template: PaymentTemplate | null = null
    if (templateId && templateId !== 'direct') {
      template = companyProfile?.paymentTemplates?.find((t) => t.id === templateId) ?? null
      console.log('[flowPaths] found template:', template)
    }
    console.log('[flowPaths] employee taxObligation:', employee.taxObligation, 'socialSecurity:', employee.socialSecurity)

    const gross = resolveGrossPay(employee)
    if ('error' in gross) {
      warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: ${gross.error}` })
      continue
    }

    // Apply deductions based on template settings
    let adjustedGross: string
    let taxAmount: string | undefined
    let socialSecurityAmount: string | undefined
    let netPay: string
    try {
      const result = applyDeductionsFromTemplate(gross.value, employee, template)
      adjustedGross = result.adjustedGross
      taxAmount = result.taxAmount
      socialSecurityAmount = result.socialSecurityAmount
      netPay = result.netPay
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

    const computeInput: ComputeInput = { grossPay: netPay, payCurrency: gross.payCurrency, fxRate }

    let computed
    try {
      computed = computeOutcome(computeInput)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: ${msg}` })
      continue
    }

    const memo = paymentFields?.memo?.trim() || companyProfile?.directPaymentDefaultMemo?.trim() || ''

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
      netPay,
      recipientPartyId: employee.cantonPartyId ?? '',
      memo,
      createdAt: new Date().toISOString(),
    }
    if (computed.fxRateApplied !== undefined) route.fxRate = computed.fxRateApplied
    if (taxAmount) route.taxAmount = taxAmount
    if (socialSecurityAmount) route.socialSecurityAmount = socialSecurityAmount
    void payeeFields
    routes.push(route)
  }

  return { routes, warnings }
}
