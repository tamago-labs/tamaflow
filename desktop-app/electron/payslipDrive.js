// Payslip Hyperdrive — per-employee drive for payslip storage.
//
// Each employee gets one Hyperdrive keyed by their Canton party id.
// The drive stores payslip files as JSON (not raw html) so metadata
// (id, routeId, period, employee, sentAt) is preserved alongside the body.
//
// Drive layout on disk (per employee):
//   <userData>/payslips/<employeePartyId>/manifest.json
//   <userData>/payslips/<employeePartyId>/<payslipId>.json
//
// manifest.json tracks all sent payslips for fast enumeration without
// scanning the drive directory.

const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const PAYSIPS_DIR = path.join(app.getPath('userData'), 'payslips')

/**
 * Send a payslip to a specific employee's hyperdrive.
 * Creates the employee directory if it doesn't exist.
 * Writes a JSON file + updates the manifest.
 *
 * @param {{ routeId: string, employeePartyId: string, employeeName: string, html: string, period: string, templateId?: string }} opts
 * @returns {{ success: boolean, sendId?: string, error?: string }}
 */
function sendToRecipient(opts) {
  const { routeId, employeePartyId, employeeName, html, period, templateId } = opts

  if (!employeePartyId || !employeePartyId.trim()) {
    return { success: false, error: 'employeePartyId is required' }
  }
  if (!html || !html.trim()) {
    return { success: false, error: 'html is required' }
  }

  const sendId = `payslip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const sentAt = new Date().toISOString()
  const employeeDir = path.join(PAYSIPS_DIR, employeePartyId)

  try {
    // Ensure employee directory exists
    if (!fs.existsSync(employeeDir)) {
      fs.mkdirSync(employeeDir, { recursive: true })
    }

    // Write the payslip JSON file
    const payslipFile = {
      id: sendId,
      routeId,
      employeePartyId,
      employeeName: employeeName || '',
      period: period || '',
      templateId: templateId || undefined,
      html,
      sentAt,
    }
    const filePath = path.join(employeeDir, `${sendId}.json`)
    fs.writeFileSync(filePath, JSON.stringify(payslipFile, null, 2), 'utf-8')

    // Update manifest
    const manifestPath = path.join(employeeDir, 'manifest.json')
    let manifest = { employeePartyId, payslips: [] }
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      } catch { /* start fresh */ }
    }
    manifest.employeePartyId = employeePartyId
    if (!Array.isArray(manifest.payslips)) manifest.payslips = []
    manifest.payslips.push({
      id: sendId,
      routeId,
      employeeName: employeeName || '',
      period: period || '',
      templateId: templateId || undefined,
      sentAt,
    })
    // Keep manifest sorted by sentAt desc
    manifest.payslips.sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0))
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

    return { success: true, sendId }
  } catch (err) {
    console.error('[payslipDrive] sendToRecipient failed:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Get all payslips for an employee (read from manifest + individual files).
 *
 * @param {string} employeePartyId
 * @returns {{ success: boolean, payslips?: object[], error?: string }}
 */
function getHistoryForEmployee(employeePartyId) {
  if (!employeePartyId || !employeePartyId.trim()) {
    return { success: false, error: 'employeePartyId is required' }
  }

  const employeeDir = path.join(PAYSIPS_DIR, employeePartyId)
  const manifestPath = path.join(employeeDir, 'manifest.json')

  if (!fs.existsSync(manifestPath)) {
    return { success: true, payslips: [] }
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    const entries = Array.isArray(manifest.payslips) ? manifest.payslips : []

    // Read each payslip file to get the full html
    const payslips = []
    for (const entry of entries) {
      const filePath = path.join(employeeDir, `${entry.id}.json`)
      if (fs.existsSync(filePath)) {
        try {
          const full = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          payslips.push(full)
        } catch {
          // Skip corrupt files, use manifest entry as fallback
          payslips.push({ ...entry, html: '(file unreadable)' })
        }
      } else {
        payslips.push({ ...entry, html: '(file missing)' })
      }
    }

    return { success: true, payslips }
  } catch (err) {
    console.error('[payslipDrive] getHistoryForEmployee failed:', err)
    return { success: false, error: err.message }
  }
}

module.exports = { sendToRecipient, getHistoryForEmployee }
