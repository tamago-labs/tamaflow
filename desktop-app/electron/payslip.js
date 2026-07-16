// Payslip generation via QVAC local AI.
//
// Template generation: AI generates a full HTML payslip document with
// {{placeholder}} syntax. The renderer fills placeholders at send time.
// No streaming — a single non-streaming completion call is used.

const { ipcMain, BrowserWindow } = require('electron')
const { completion } = require('@qvac/sdk')
const { getActiveModelId, setStreamingNow, mapError } = require('./qvac')
const { sendToRecipient, getHistoryForEmployee } = require('./payslipDrive')

// ============================================
// Style prompts (for template generation)
// ============================================

const TEMPLATE_STYLE_PROMPTS = {
  standard: `Generate a professional payslip TEMPLATE in markdown format.
Use placeholders like {{employeeName}}, {{companyName}}, {{period}}, {{grossPay}}, {{taxAmount}}, {{netPay}} etc.
Include clear section headers, aligned columns, and a summary footer.
The template will be filled with actual numbers later.`,

  japanese: `Generate a Japanese-style payslip TEMPLATE (給与明細書) in markdown format.
Use Japanese terminology:
- 支給 (earnings), 控除 (deductions), 差引 (net)
- Basic salary (基本給), Overtime (残業手当), Commuting allowance (通勤手当)
- Health insurance (健康保険), Pension (厚生年付), Employment insurance (雇用保険)
- Income tax (所得税), Resident tax (住民税)
Use placeholders like {{employeeName}}, {{grossPay}}, {{taxAmount}} etc.`,

  detailed: `Generate a highly detailed payslip TEMPLATE in markdown format.
Include separate sections for:
- Earnings (itemized with descriptions)
- Tax deductions (each tax type separately)
- Social security deductions
- Other deductions
- Net pay calculation
Use placeholders like {{employeeName}}, {{grossPay}}, {{taxAmount}} etc.
Use tables for clear presentation.`
}

const TEMPLATE_SYSTEM_PROMPT = `You are a professional payroll assistant. Generate a payslip TEMPLATE with placeholders.

Rules:
1. Output ONLY the template in markdown — no explanations
2. Use {{placeholderName}} syntax for all variable values
3. Use the specified style
4. Include standard payslip sections (header, earnings, deductions, net pay, footer)
5. Do NOT include any text outside the template`

const FILL_SYSTEM_PROMPT = `You are a payroll assistant. Fill in the placeholders in a payslip template with actual values.

Rules:
1. Replace ALL {{placeholderName}} with actual values from the data
2. Keep the exact same markdown structure
3. Format numbers appropriately for the currency
4. Do NOT add any text outside the payslip
5. Output the complete filled payslip`

// ============================================
// Template generation (streaming)
// ============================================

/**
 * Generate a payslip template via streaming AI.
 * Pushes thinking/content events to renderer.
 */
async function generateTemplate({ settlementData, companyProfile, style, window }) {
  const modelId = getActiveModelId()
  if (!modelId) throw new Error('No AI model loaded.')

  const stylePrompt = TEMPLATE_STYLE_PROMPTS[style] || TEMPLATE_STYLE_PROMPTS.standard

  const userMessage = buildTemplatePrompt(settlementData, companyProfile)

  setStreamingNow(true)
  try {
    const run = completion({
      modelId,
      history: [
        { role: 'system', content: TEMPLATE_SYSTEM_PROMPT + '\n\n' + stylePrompt },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      captureThinking: true
    })

    let thinking = ''
    let content = ''

    for await (const event of run.events) {
      if (event.type === 'thinkingDelta') {
        thinking += event.text
        if (window && !window.isDestroyed()) {
          window.webContents.send('payslip:thinking', { text: event.text })
        }
      }
      if (event.type === 'contentDelta') {
        content += event.text
        if (window && !window.isDestroyed()) {
          window.webContents.send('payslip:token', { text: event.text })
        }
      }
    }

    const final = await run.final
    if (window && !window.isDestroyed()) {
      window.webContents.send('payslip:done', { content: final.contentText, thinking })
    }
    return final.contentText
  } catch (err) {
    const mapped = mapError(err)
    if (window && !window.isDestroyed()) {
      window.webContents.send('payslip:error', { error: mapped.message })
    }
    throw new Error(mapped.message || 'Template generation failed')
  } finally {
    setStreamingNow(false)
  }
}

/**
 * Fill placeholders in a template with actual settlement data.
 * This is a simple string replacement, not AI-powered.
 */
function fillTemplate(template, settlementData, companyProfile) {
  const replacements = {
    '{{employeeName}}': settlementData.displayName || settlementData.employeeId || '',
    '{{companyName}}': companyProfile.companyName || '',
    '{{period}}': settlementData.period || settlementData.createdAt || '',
    '{{grossPay}}': settlementData.grossPay || '0',
    '{{withholding}}': settlementData.withholdingAmount || '0',
    '{{taxAmount}}': settlementData.taxAmount || '0',
    '{{socialSecurity}}': settlementData.socialSecurityAmount || '0',
    '{{netPay}}': settlementData.netPay || '0',
    '{{currency}}': settlementData.payCurrency || companyProfile.settlementCurrency || 'USD',
    '{{country}}': companyProfile.country || '',
    '{{fxRate}}': settlementData.fxRate || '',
    '{{memo}}': settlementData.memo || '',
    '{{txHash}}': settlementData.txHash || '',
  }

  let filled = template
  for (const [placeholder, value] of Object.entries(replacements)) {
    filled = filled.replaceAll(placeholder, value)
  }
  return filled
}

/**
 * Build the user prompt for template generation.
 */
function buildTemplatePrompt(settlementData, companyProfile) {
  const lines = []
  lines.push('Generate a payslip template for this type of settlement:')
  lines.push('')
  lines.push(`**Company:** ${companyProfile.companyName || 'Unknown'}`)
  lines.push(`**Country:** ${companyProfile.country || 'Unknown'}`)
  lines.push(`**Currency:** ${companyProfile.settlementCurrency || 'USD'}`)
  lines.push('')
  lines.push('**Available fields (use as placeholders):**')
  lines.push('- {{employeeName}}, {{companyName}}, {{period}}')
  lines.push('- {{grossPay}}, {{withholding}}, {{taxAmount}}, {{socialSecurity}}, {{netPay}}')
  lines.push('- {{currency}}, {{country}}, {{fxRate}}, {{memo}}, {{txHash}}')
  lines.push('')
  lines.push('Generate the template now.')

  return lines.join('\n')
}

/**
 * Build a payslip payload for P2P transmission.
 */
function buildPayslipPayload({ html, settlementData, companyProfile, style }) {
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
    html,
    companyName: companyProfile.companyName,
    createdAt: new Date().toISOString()
  }
}

module.exports = {
  generateTemplate,
  fillTemplate,
  buildPayslipPayload,
  registerPayslipIpc,
  TEMPLATE_STYLE_PROMPTS
}

// ============================================
// IPC registration
// ============================================

let payslipStore = null

function registerPayslipIpc() {
  // ── Hyperdrive-based per-employee payslip sending ──────────────
  ipcMain.handle('payslip:sendToRecipient', (_e, opts) => {
    try {
      return sendToRecipient(opts)
    } catch (err) {
      console.error('[payslip] sendToRecipient failed:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('payslip:getHistoryForEmployee', (_e, employeePartyId) => {
    try {
      return getHistoryForEmployee(employeePartyId)
    } catch (err) {
      console.error('[payslip] getHistoryForEmployee failed:', err.message)
      return { success: false, error: err.message }
    }
  })

  // ── AI template generation (non-streaming, for the new modal) ──
  ipcMain.handle('payslip:generateTemplate', async (_e, { prompt, realDataExample, currentHtml }) => {
    const modelId = getActiveModelId()
    if (!modelId) return { success: false, error: 'No AI model loaded.' }

    const systemPrompt = `You are a professional payroll assistant. Generate or refine a payslip TEMPLATE as a full HTML document.

Rules:
1. Output a complete HTML document (<!DOCTYPE html>...<body>...</body>...</html>)
2. Use {{placeholderName}} syntax for all variable values (e.g. {{employeeName}}, {{grossPay}})
3. Include standard payslip sections: header with company name, employee info, earnings table, deductions, net pay, footer
4. Do NOT include any text outside the HTML document
5. Use inline CSS only — no external stylesheets
6. Use clean, professional styling: system fonts, light borders, good spacing
7. Format numbers appropriately for the currency`

    let userMessage = prompt || 'Generate a standard payslip template.'
    if (realDataExample) {
      userMessage += `\n\nUse this employee and settlement data as reference for placeholder types and values:\n${JSON.stringify(realDataExample, null, 2)}`
    }
    if (currentHtml) {
      userMessage += `\n\nCurrent template to refine:\n\n${currentHtml}`
    }

    try {
      setStreamingNow(true)
      const result = await completion({
        modelId,
        history: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false,
        captureThinking: false
      })
      return { success: true, html: result.text || '' }
    } catch (err) {
      console.error('[payslip] generateTemplate failed:', err.message)
      return { success: false, error: err.message }
    } finally {
      setStreamingNow(false)
    }
  })

  // ── Legacy: build payload (still used by the drawer) ───────────
  ipcMain.handle('payslip:buildPayload', (_e, { html, settlementData, companyProfile, style }) => {
    try {
      const payload = buildPayslipPayload({ html, settlementData, companyProfile, style })
      return { success: true, payload }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  console.log('[payslip] IPC handlers registered')
}
