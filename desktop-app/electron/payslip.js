// Payslip AI template generation.
//
// Single non-streaming completion call generates a full HTML
// payslip document with {{placeholder}} syntax.
//
// The actual payslip sending now goes through the Tamaflow P2P
// room (Autobase + HyperDB @tamaflow/payslip collection), not
// through IPC or a local file directory.

const { ipcMain } = require('electron')
const { completion } = require('@qvac/sdk')
const { getActiveModelId, setStreamingNow } = require('./qvac')

function registerPayslipIpc() {
  // ── AI template generation (non-streaming, for the modal) ──
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

  console.log('[payslip] IPC handlers registered')
}

module.exports = { registerPayslipIpc }
