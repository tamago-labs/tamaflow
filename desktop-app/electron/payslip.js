// Payslip generation via QVAC local AI.
//
// Takes settlement data + company profile + style preference,
// generates a formatted payslip in markdown using local inference.

const { ipcMain } = require('electron')
const { completion } = require('@qvac/sdk')
const { getActiveModelId, setStreamingNow, mapError } = require('./qvac')

// ============================================
// Payslip style templates
// ============================================

const STYLE_PROMPTS = {
  standard: `Generate a clean, professional payslip in markdown format.
Use clear section headers, aligned columns, and a summary footer.
Include company name, employee name, pay period, and all financial details.`,

  japanese: `Generate a Japanese-style payslip (給与明細書) in markdown format.
Use Japanese terminology where appropriate:
- 支給 (earnings), 控除 (deductions), 差引 (net)
- Basic salary (基本給), Overtime (残業手当), Commuting allowance (通勤手当)
- Health insurance (健康保険), Pension (厚生年付), Employment insurance (雇用保険)
- Income tax (所得税), Resident tax (住民税)
Format with clear sections and aligned amounts.`,

  detailed: `Generate a highly detailed payslip in markdown format.
Include separate sections for:
- Earnings (itemized with descriptions)
- Tax deductions (each tax type separately)
- Social security deductions
- Other deductions
- Net pay calculation
- Year-to-date totals if available
Use tables for clear presentation.`
}

const SYSTEM_PROMPT = `You are a professional payroll assistant. Generate formatted payslips based on settlement data.

Rules:
1. Output ONLY the formatted payslip in markdown — no explanations
2. Use the specified style template
3. Include all provided financial data
4. Calculate totals accurately
5. Use appropriate currency formatting
6. Add a professional footer with generation date
7. Do NOT include any text outside the payslip markdown`

// ============================================
// Main generation function
// ============================================

/**
 * Generate a payslip from settlement data using local QVAC AI.
 *
 * @param {object} opts
 * @param {object} opts.settlementData - Settlement record from routeStore
 * @param {object} opts.companyProfile - Company profile (name, country, currency)
 * @param {string} opts.style - Payslip style: 'standard' | 'japanese' | 'detailed'
 * @returns {Promise<string>} Formatted markdown payslip
 */
async function generatePayslip({ settlementData, companyProfile, style = 'standard' }) {
  const modelId = getActiveModelId()
  if (!modelId) throw new Error('No AI model loaded. Load a model in Settings > AI Models first.')

  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.standard

  const userMessage = buildUserPrompt(settlementData, companyProfile)

  setStreamingNow(true)
  try {
    const run = completion({
      modelId,
      history: [
        { role: 'system', content: SYSTEM_PROMPT + '\n\n' + stylePrompt },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      captureThinking: false
    })

    const final = await run.final
    return final.contentText
  } catch (err) {
    const mapped = mapError(err)
    throw new Error(mapped.message || 'AI generation failed')
  } finally {
    setStreamingNow(false)
  }
}

/**
 * Build the user prompt from settlement + company data.
 */
function buildUserPrompt(settlementData, companyProfile) {
  const lines = []
  lines.push('Generate a payslip for the following data:')
  lines.push('')
  lines.push(`**Company:** ${companyProfile.companyName || 'Unknown'}`)
  lines.push(`**Country:** ${companyProfile.country || 'Unknown'}`)
  lines.push(`**Currency:** ${companyProfile.settlementCurrency || 'USD'}`)
  lines.push('')
  lines.push('**Settlement Details:**')
  lines.push(`- Employee: ${settlementData.displayName || settlementData.employeeId || 'Unknown'}`)
  lines.push(`- Period: ${settlementData.period || settlementData.memo || settlementData.createdAt || 'Unknown'}`)
  lines.push(`- Gross Pay: ${settlementData.grossPay || '0'}`)
  lines.push(`- Withholding: ${settlementData.withholdingAmount || '0'}`)
  lines.push(`- Tax: ${settlementData.taxAmount || '0'}`)
  lines.push(`- Social Security: ${settlementData.socialSecurityAmount || '0'}`)
  lines.push(`- Net Pay: ${settlementData.netPay || '0'}`)
  lines.push(`- Currency: ${settlementData.payCurrency || 'USD'}`)
  if (settlementData.fxRate) {
    lines.push(`- FX Rate: ${settlementData.fxRate}`)
  }
  if (settlementData.memo) {
    lines.push(`- Memo: ${settlementData.memo}`)
  }
  if (settlementData.txHash) {
    lines.push(`- Transaction: ${settlementData.txHash}`)
  }
  lines.push('')
  lines.push('Generate the payslip now.')

  return lines.join('\n')
}

/**
 * Build a payslip payload for P2P transmission.
 */
function buildPayslipPayload({ markdown, settlementData, companyProfile, style }) {
  return {
    id: `payslip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'payslip',
    employee: settlementData.displayName || settlementData.employeeId,
    employeeId: settlementData.employeeId,
    period: settlementData.period || settlementData.createdAt,
    grossPay: settlementData.grossPay,
    netPay: settlementData.netPay,
    currency: settlementData.payCurrency || companyProfile.settlementCurrency || 'USD',
    style,
    markdown,
    companyName: companyProfile.companyName,
    createdAt: new Date().toISOString()
  }
}

module.exports = {
  generatePayslip,
  buildPayslipPayload,
  buildUserPrompt,
  registerPayslipIpc,
  STYLE_PROMPTS
}

// ============================================
// IPC registration
// ============================================

function registerPayslipIpc() {
  ipcMain.handle('payslip:generate', async (_e, { settlementData, companyProfile, style }) => {
    try {
      const markdown = await generatePayslip({ settlementData, companyProfile, style })
      return { success: true, markdown }
    } catch (err) {
      console.error('[payslip] Generate failed:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('payslip:buildPayload', async (_e, { markdown, settlementData, companyProfile, style }) => {
    try {
      const payload = buildPayslipPayload({ markdown, settlementData, companyProfile, style })
      return { success: true, payload }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  console.log('[payslip] IPC handlers registered')
}
