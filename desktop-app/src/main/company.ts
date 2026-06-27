/**
 * IPC handlers for the employer company profile.
 *
 * Owns the wire surface for `company:*` — get / save / export / import /
 * reset / onChange. The persistence layer is in `companyStore.ts`.
 *
 * Pattern matches `wallet.ts`: a single `registerCompanyIpcHandlers`
 * function exported and called from `main/index.ts`. Save and reset
 * push `company:onChange` so any subscribed renderer (the gate AND the
 * Settings tab) react in lock-step.
 */
import { ipcMain, BrowserWindow, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { companyStore, CompanyStore } from './companyStore'
import type { CompanyProfile } from '../preload/index.d'

function notifyChange(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('company:onChange', companyStore.get())
  }
}

/**
 * Slugify a company name for the default export filename.
 *   "Acme Japan KK" → "acme-japan-kk"
 */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'company'
  )
}

export function registerCompanyIpcHandlers(): void {
  ipcMain.handle('company:get', () => companyStore.get())

  ipcMain.handle('company:save', (_e, profile: CompanyProfile) => {
    const file = companyStore.save(profile)
    notifyChange()
    return file
  })

  ipcMain.handle('company:reset', () => {
    companyStore.reset()
    notifyChange()
    return { success: true }
  })

  ipcMain.handle('company:export', async () => {
    const file = companyStore.get()
    if (!file) {
      return { success: false, error: 'No company profile to export' }
    }
    const win = BrowserWindow.getFocusedWindow()
    if (!win) {
      return { success: false, error: 'No active window' }
    }
    const result = await dialog.showSaveDialog(win, {
      title: 'Export Company Profile',
      defaultPath: `tamaflow-company-${slugify(file.profile.companyName)}.json`,
      filters: [{ name: 'Company Profile', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }
    try {
      writeFileSync(result.filePath, JSON.stringify(file, null, 2), 'utf-8')
      return { success: true, path: result.filePath }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Could not write file: ${msg}` }
    }
  })

  ipcMain.handle('company:import', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) {
      return { success: false, error: 'No active window' }
    }
    const result = await dialog.showOpenDialog(win, {
      title: 'Import Company Profile',
      properties: ['openFile'],
      filters: [
        { name: 'Company Profile', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    const path = result.filePaths[0]
    let raw: string
    try {
      raw = readFileSync(path, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Could not read file: ${msg}` }
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { success: false, error: 'Invalid JSON' }
    }
    try {
      // `CompanyStore.validate` throws with a human-readable message;
      // we wrap and return it in the result envelope rather than
      // rethrowing, so the renderer can show it inline in the modal
      // (rethrowing would surface as an unhandled promise rejection).
      const profile = CompanyStore.validate(parsed)
      return { success: true, file: { version: 1, profile } }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  console.log('[company] IPC handlers registered')
}
