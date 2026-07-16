// Payslip AI template generation.
//
// Two modes:
//   1. Streaming (`payslip:generate`) — pushes thinking/content events to renderer
//   2. Non-streaming (`payslip:generateTemplate`) — returns full result at once
//
// The actual payslip sending now goes through the Tamaflow P2P
// room (Autobase + HyperDB @tamaflow/payslip collection), not
// through IPC or a local file directory.

const { ipcMain, BrowserWindow } = require('electron')
const { completion } = require('@qvac/sdk')
const { getActiveModelId, setStreamingNow, mapError } = require('./qvac')

const HTML_SYSTEM_PROMPT = `You are a professional payroll assistant. Generate a payslip TEMPLATE as a full HTML document.

Rules:
1. Output a complete HTML document (<!DOCTYPE html>...<body>...</body>...</html>)
2. Use ONLY the placeholders listed below. Do NOT invent any other placeholder names.
3. Include standard payslip sections: header with company name, employee info, earnings/deductions table, net pay, footer
4. Do NOT include any text outside the HTML document
5. Use inline CSS only — no external stylesheets
6. Use clean, professional styling: system fonts, light borders, good spacing
7. Format numbers appropriately for the currency
8. Do NOT include any hardcoded or mock values. Every data point MUST use a placeholder from the list below.
9. For Japanese layout, use Japanese labels (給与明細書, 支給, 控除, 差引) but still use the same placeholder names from the list below.

Available placeholders — use ONLY these:
  {{companyName}}      — Company name
  {{period}}           — Pay period (e.g. "June 2026")
  {{employeeName}}     — Employee name
  {{country}}          — Country code (e.g. JP, TH)
  {{currency}}         — Currency code (e.g. JPY, USD)
  {{grossPay}}         — Gross pay before deductions
  {{netPay}}           — Net pay after deductions
  {{fxRate}}           — FX conversion rate (may be empty)
  {{memo}}             — Transfer memo (may be empty)
  {{txHash}}           — Transaction hash (may be empty)
  {{taxAmount}}        — Tax deduction amount (may be empty)
  {{socialSecurity}}   — Social security deduction (may be empty)
  {{withholding}}      — Withholding deduction (may be empty)

IMPORTANT: Placeholders that are marked "may be empty" should still be included in the template. Wrap them in conditionals or leave them as-is — they will render as empty strings when not available.

Example of correct usage:
  <td>{{grossPay}}</td>        ✓ correct — uses a valid placeholder
  <td>3,000</td>               ✗ wrong — hardcoded value
  <td>{{basicSalary}}</td>     ✗ wrong — not in the available list`

function sendToRenderer(window, channel, data) {
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, data)
  }
}

function registerPayslipIpc() {
  // ── Streaming generation (for PayslipManager) ──
  ipcMain.handle('payslip:generate', async (_e, { prompt, fields, useRealExample, currentHtml }) => {
    const modelId = getActiveModelId()
    if (!modelId) return { success: false, error: 'No AI model loaded.' }

    const fieldHint = fields && fields.length > 0
      ? `\nInclude these fields: ${fields.map((f) => '{{' + f + '}}').join(', ')}`
      : ''
    const exampleHint = useRealExample
      ? '\nUse realistic values for a Japanese company paying 500,000 JPY/month to a Tokyo employee with 10% withholding.'
      : ''
    const refineHint = currentHtml
      ? `\n\nCurrent template to refine:\n\n${currentHtml}`
      : ''

    const userMessage = `${prompt}${fieldHint}${exampleHint}${refineHint}`

    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    setStreamingNow(true)
    try {
      const run = completion({
        modelId,
        history: [
          { role: 'system', content: HTML_SYSTEM_PROMPT },
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
          sendToRenderer(win, 'payslip:thinking', { text: event.text })
        }
        if (event.type === 'contentDelta') {
          content += event.text
          sendToRenderer(win, 'payslip:token', { text: event.text })
        }
      }

      const final = await run.final
      sendToRenderer(win, 'payslip:done', { content: final.contentText, thinking })
      return { success: true, html: final.contentText }
    } catch (err) {
      const mapped = mapError(err)
      sendToRenderer(win, 'payslip:error', { error: mapped.message })
      console.error('[payslip] generate failed:', err.message)
      return { success: false, error: mapped.message }
    } finally {
      setStreamingNow(false)
    }
  })

  // ── Non-streaming generation (for AI Assist quick refine) ──
  ipcMain.handle('payslip:generateTemplate', async (_e, { prompt, realDataExample, currentHtml }) => {
    const modelId = getActiveModelId()
    if (!modelId) return { success: false, error: 'No AI model loaded.' }

    let userMessage = prompt || 'Generate a standard payslip template.'
    if (realDataExample) {
      userMessage += `\n\nUse this data as reference:\n${JSON.stringify(realDataExample, null, 2)}`
    }
    if (currentHtml) {
      userMessage += `\n\nCurrent template to refine:\n\n${currentHtml}`
    }

    try {
      setStreamingNow(true)
      const result = await completion({
        modelId,
        history: [
          { role: 'system', content: HTML_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        stream: false,
        captureThinking: false
      })
      return { success: true, html: result.text || '' }
    } catch (err) {
      return { success: false, error: err.message }
    } finally {
      setStreamingNow(false)
    }
  })

  console.log('[payslip] IPC handlers registered')
}

module.exports = { registerPayslipIpc }
