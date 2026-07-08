// Backend enumerateRoutes — pure function that computes one Route per Payee card.
// Ported from renderer/src/shared/flowPaths.ts for Node.js (no React imports).

const DIRECT_PAYMENT_TEMPLATE_ID = 'direct'

const PRICE_TABLE = { USD: 1, EUR: 1.08, JPY: 0.0067, THB: 0.028, CC: 0.15 }

function convert(amount, from, to) {
  if (!Number.isFinite(amount)) return null
  if (from === to) return amount
  function usdPerUnit(ccy) { const r = PRICE_TABLE[ccy]; return typeof r === 'number' && r > 0 ? r : null }
  if (to !== 'USD' && from !== 'USD') {
    const fromUsd = usdPerUnit(from); const toUsd = usdPerUnit(to)
    if (fromUsd === null || toUsd === null) return null
    return (amount * fromUsd) / toUsd
  }
  if (to === 'USD') { const r = usdPerUnit(from); return r === null ? null : amount * r }
  const r = usdPerUnit(to)
  return r === null ? null : amount / r
}

function decimalToMinor(value, decimals) {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Invalid decimal: ${value}`)
  const [whole, frac = ''] = trimmed.split('.')
  const paddedFrac = (frac + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(paddedFrac || '0')
}

function minorToDecimal(minor, decimals) {
  const factor = BigInt(10) ** BigInt(decimals)
  const whole = minor / factor; const frac = minor % factor
  const fracStr = frac.toString().padStart(decimals, '0')
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed === '' ? whole.toString() : `${whole.toString()}.${trimmed}`
}

function decimalMul(value, rate, precision) {
  const RATE_PRECISION = 18
  const valueMinor = decimalToMinor(value, precision)
  const rateMinor = decimalToMinor(rate, RATE_PRECISION)
  const product = valueMinor * rateMinor
  const divisor = BigInt(10) ** BigInt(RATE_PRECISION)
  const quotient = product / divisor; const remainder = product % divisor
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient
  return minorToDecimal(rounded, precision)
}

function computeOutcome(input) {
  const { grossPay, payCurrency, fxRate } = input
  const CC_DECIMALS = 10
  let amountCC, fxRateApplied
  if (payCurrency === 'CC') {
    const minor = decimalToMinor(grossPay, CC_DECIMALS)
    amountCC = minorToDecimal(minor, CC_DECIMALS)
    fxRateApplied = undefined
  } else {
    if (!fxRate || fxRate === '') throw new Error(`FX rate required for ${payCurrency}`)
    fxRateApplied = fxRate
    const minor = decimalToMinor(decimalMul(grossPay, fxRate, CC_DECIMALS), CC_DECIMALS)
    amountCC = minorToDecimal(minor, CC_DECIMALS)
  }
  const result = { grossPay, payCurrency, amountCC }
  if (fxRateApplied !== undefined) result.fxRateApplied = fxRateApplied
  return result
}

function mulDecimal(value, rate, precision) {
  const trimValue = value.trim(); const trimRate = rate.trim()
  if (!/^\d+(\.\d+)?$/.test(trimValue)) throw new Error(`Invalid value: ${value}`)
  if (!/^\d+(\.\d+)?$/.test(trimRate)) throw new Error(`Invalid rate: ${rate}`)
  const RATE_PRECISION = 18
  const toMinor = (s, d) => { const [whole, frac = ''] = s.split('.'); const padded = (frac + '0'.repeat(d)).slice(0, d); return BigInt(whole) * BigInt(10) ** BigInt(d) + BigInt(padded || '0') }
  const valueMinor = toMinor(trimValue, precision); const rateMinor = toMinor(trimRate, RATE_PRECISION)
  const product = valueMinor * rateMinor; const divisor = BigInt(10) ** BigInt(RATE_PRECISION)
  const quotient = product / divisor; const remainder = product % divisor
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient
  const factor = BigInt(10) ** BigInt(precision)
  const whole = rounded / factor; const frac = rounded % factor
  const fracStr = frac.toString().padStart(precision, '0')
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed === '' ? whole.toString() : `${whole.toString()}.${trimmed}`
}

function subDecimal(a, b, precision) {
  const trimA = a.trim(); const trimB = b.trim()
  if (!/^\d+(\.\d+)?$/.test(trimA)) throw new Error(`Invalid: ${a}`)
  if (!/^\d+(\.\d+)?$/.test(trimB)) throw new Error(`Invalid: ${b}`)
  const toMinor = (s, d) => { const [whole, frac = ''] = s.split('.'); const padded = (frac + '0'.repeat(d)).slice(0, d); return BigInt(whole) * BigInt(10) ** BigInt(d) + BigInt(padded || '0') }
  const aMinor = toMinor(trimA, precision); const bMinor = toMinor(trimB, precision)
  const diff = aMinor - bMinor
  const factor = BigInt(10) ** BigInt(precision)
  const whole = diff / factor; const frac = diff % factor
  if (diff < 0n) return '0'
  const fracStr = frac.toString().padStart(precision, '0')
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed === '' ? whole.toString() : `${whole.toString()}.${trimmed}`
}

function resolveGrossPay(employee) {
  const payCurrency = employee.payCurrency
  if (!payCurrency) return { error: 'payCurrency not set' }
  switch (employee.payFrequency) {
    case 'monthly': case 'one-off':
      if (!employee.salaryAmount) return { error: 'salaryAmount required' }
      return { value: employee.salaryAmount, payCurrency }
    case 'biweekly':
      if (!employee.salaryAmount) return { error: 'salaryAmount required' }
      const m1 = Number(employee.salaryAmount)
      if (!Number.isFinite(m1)) return { error: 'Invalid salaryAmount' }
      return { value: (m1 / 2).toFixed(2), payCurrency }
    case 'weekly':
      if (!employee.salaryAmount) return { error: 'salaryAmount required' }
      const m2 = Number(employee.salaryAmount)
      if (!Number.isFinite(m2)) return { error: 'Invalid salaryAmount' }
      return { value: (m2 / (52 / 12)).toFixed(2), payCurrency }
    case 'hourly':
      if (!employee.hourlyRate) return { error: 'hourlyRate required' }
      const rate = Number(employee.hourlyRate)
      if (!Number.isFinite(rate)) return { error: 'Invalid hourlyRate' }
      return { value: (rate * 160).toFixed(2), payCurrency }
    default:
      return { error: `Unsupported payFrequency: ${employee.payFrequency}` }
  }
}

function applyDeductions(grossPay, template, employee) {
  if (!template) return { adjustedGross: grossPay, netPay: grossPay }
  let withholdingAmount = '0'
  let ssAmount = '0'
  let net = Number(grossPay) || 0

  // Apply withholding rate from template if set
  if (template.withholdingRate && template.withholdingRate.trim() !== '') {
    const rate = Number(template.withholdingRate)
    if (rate > 0) {
      const deduction = net * rate
      withholdingAmount = deduction.toFixed(2)
      net = net - deduction
    }
  }

  // Apply per-employee tax if template enables it
  if (template.applyEmployeeTax && employee?.taxObligation) {
    const taxAmt = normalizeObligationAmount(employee.taxObligation, employee.payFrequency, employee.payCurrency)
    if (taxAmt > 0) {
      withholdingAmount = (Number(withholdingAmount) + taxAmt).toFixed(2)
      net = net - taxAmt
    }
  }

  // Apply per-employee social security if template enables it
  if (template.applyEmployeeSocialSecurity && employee?.socialSecurity) {
    const ssAmt = normalizeObligationAmount(employee.socialSecurity, employee.payFrequency, employee.payCurrency)
    if (ssAmt > 0) {
      ssAmount = ssAmt.toFixed(2)
      net = net - ssAmt
    }
  }

  return {
    adjustedGross: Math.max(0, net).toFixed(2),
    netPay: Math.max(0, net).toFixed(2),
    ...(Number(withholdingAmount) > 0 && { withholdingAmount }),
    ...(Number(ssAmount) > 0 && { socialSecurityAmount: ssAmount })
  }
}

function normalizeObligationAmount(obligation, payFrequency, payCurrency) {
  if (!obligation || !obligation.amount) return 0
  let amount = Number(obligation.amount) || 0
  if (amount <= 0) return 0

  // Convert currency if different
  if (obligation.currency !== payCurrency) {
    const rate = convert(1, obligation.currency, payCurrency)
    if (rate !== null) amount = amount * rate
  }

  // Normalize based on term
  const periodsPerYear = getPeriodsPerYear(payFrequency)
  if (obligation.term === 'per_year') {
    amount = amount / periodsPerYear
  } else if (obligation.term === 'per_month') {
    if (payFrequency === 'biweekly') amount = amount * 2
    else if (payFrequency === 'weekly') amount = amount * 4.33
  }

  return Math.max(0, amount)
}

function getPeriodsPerYear(payFrequency) {
  switch (payFrequency) {
    case 'monthly': return 12
    case 'biweekly': return 26
    case 'weekly': return 52
    case 'hourly': return 12
    case 'one-off': return 1
    default: return 12
  }
}

function freshRouteId() {
  return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function enumerateRoutes(input) {
  const { flowId, cards, connections, employees, companyProfile } = input
  const payees = cards.filter(c => c.category === 'payee')
  const sourcesById = new Map(cards.filter(c => c.category === 'source').map(c => [c.placementId, c]))
  const paymentsById = new Map(cards.filter(c => c.category === 'payment').map(c => [c.placementId, c]))

  const incoming = new Map()
  for (const conn of connections) { const arr = incoming.get(conn.to) || []; arr.push(conn.from); incoming.set(conn.to, arr) }

  const employeeById = new Map(employees.map(e => [e.id, e]))
  const routes = []; const warnings = []

  for (const payee of payees) {
    const employeeId = payee.payeeFields?.employeeId || ''
    if (!employeeId) { warnings.push({ payeePlacementId: payee.placementId, message: 'No employee selected.' }); continue }
    const employee = employeeById.get(employeeId)
    if (!employee) { warnings.push({ payeePlacementId: payee.placementId, message: `Employee ${employeeId} not found.` }); continue }
    if (employee.status !== 'active') { warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName} is ${employee.status}.` }); continue }

    const upstreamIds = incoming.get(payee.placementId) || []
    if (upstreamIds.length === 0) { warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: no connected Source.` }); continue }
    const sourceCard = sourcesById.get(upstreamIds[0])
    if (!sourceCard) { warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: Source card not found.` }); continue }

    const outgoingIds = connections.filter(c => c.from === payee.placementId).map(c => c.to)
    if (outgoingIds.length === 0) { warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: no connected Payment.` }); continue }
    const paymentCard = paymentsById.get(outgoingIds[0])
    if (!paymentCard) { warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: Payment card not found.` }); continue }

    const paymentFields = paymentCard.paymentFields || {}
    const templateId = paymentFields.templateId
    let template = null
    if (templateId && templateId !== DIRECT_PAYMENT_TEMPLATE_ID) {
      template = companyProfile?.paymentTemplates?.find(t => t.id === templateId) || null
    }

    const gross = resolveGrossPay(employee)
    if ('error' in gross) { warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: ${gross.error}` }); continue }

    let adjustedGross, withholdingAmount, socialSecurityAmount, netPay
    try {
      const r = applyDeductions(gross.value, template, employee)
      adjustedGross = r.adjustedGross; withholdingAmount = r.withholdingAmount; socialSecurityAmount = r.socialSecurityAmount; netPay = r.netPay
    } catch (e) { warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: deduction error` }); continue }

    let fxRate
    if (gross.payCurrency !== 'CC') {
      const ccPerUnit = convert(1, gross.payCurrency, 'CC')
      if (ccPerUnit === null) { warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: no FX rate for ${gross.payCurrency}` }); continue }
      fxRate = ccPerUnit.toFixed(18).replace(/0+$/, '').replace(/\.$/, '')
    }

    let computed
    try { computed = computeOutcome({ grossPay: adjustedGross, payCurrency: gross.payCurrency, fxRate }) }
    catch (e) { warnings.push({ payeePlacementId: payee.placementId, message: `${employee.displayName}: ${e.message}` }); continue }

    const memo = paymentFields.memo?.trim() || template?.defaultMemo?.trim() || companyProfile?.directPaymentDefaultMemo?.trim() || ''

    const route = {
      id: freshRouteId(), flowId, status: 'pending', employeeId,
      payeePlacementId: payee.placementId, sourcePlacementId: sourceCard.placementId,
      paymentPlacementId: paymentCard.placementId, amountCC: computed.amountCC,
      payCurrency: computed.payCurrency, grossPay: gross.value,
      netPay, recipientPartyId: employee.cantonPartyId || '', memo,
      createdAt: new Date().toISOString()
    }
    if (computed.fxRateApplied) route.fxRate = computed.fxRateApplied
    if (withholdingAmount && Number(withholdingAmount) > 0) route.taxAmount = withholdingAmount
    if (socialSecurityAmount && Number(socialSecurityAmount) > 0) route.socialSecurityAmount = socialSecurityAmount
    routes.push(route)
  }

  return { routes, warnings }
}

module.exports = { enumerateRoutes }
