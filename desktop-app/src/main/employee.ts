/**
 * IPC handlers for the employee roster.
 *
 * Mirrors `company.ts` — a single `registerEmployeeIpcHandlers` exported
 * and called from `main/index.ts`. Save / remove / reset push
 * `employees:onChange` so any subscribed renderer reacts in lock-step.
 *
 * Defensive wrapping: export / import return `{ success, error }`
 * envelopes rather than throwing, so the renderer can surface failures
 * inline in the modal.
 */
import { ipcMain, BrowserWindow, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { employeeStore, EmployeeStore } from './employeeStore'
import type { Employee, EmployeeImportDiff } from '../preload/index.d'

function notifyChange(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('employees:onChange', employeeStore.get())
  }
}

/** Slugify a name for the default export filename. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'roster'
  )
}

/**
 * Compute the import diff against the current roster (if any).
 * Used by `employees:import` to power the preview modal.
 */
function computeDiff(
  imported: Employee[],
  current: Employee[] | null
): EmployeeImportDiff {
  const byId = new Map<string, Employee>()
  if (current) for (const e of current) byId.set(e.id, e)
  let toAdd = 0
  let toUpdate = 0
  let toSkip = 0
  const importedIds = new Set<string>()
  for (const next of imported) {
    importedIds.add(next.id)
    const existing = byId.get(next.id)
    if (!existing) {
      toAdd++
      continue
    }
    if (employeesEqual(existing, next)) toSkip++
    else toUpdate++
  }
  const willBeRemoved = current ? current.filter((e) => !importedIds.has(e.id)).length : 0
  return { toAdd, toUpdate, toSkip, willBeRemoved }
}

/** Deep-equality on the meaningful fields (ignore updatedAt). */
function employeesEqual(a: Employee, b: Employee): boolean {
  return (
    a.displayName === b.displayName &&
    (a.email ?? '') === (b.email ?? '') &&
    a.type === b.type &&
    (a.role ?? '') === (b.role ?? '') &&
    a.country === b.country &&
    a.payCurrency === b.payCurrency &&
    (a.salaryAmount ?? '') === (b.salaryAmount ?? '') &&
    a.payFrequency === b.payFrequency &&
    (a.hourlyRate ?? '') === (b.hourlyRate ?? '') &&
    (a.cantonPartyId ?? '') === (b.cantonPartyId ?? '') &&
    a.status === b.status &&
    (a.startDate ?? '') === (b.startDate ?? '') &&
    (a.endDate ?? '') === (b.endDate ?? '') &&
    (a.note ?? '') === (b.note ?? '')
  )
}

export function registerEmployeeIpcHandlers(): void {
  ipcMain.handle('employees:get', () => employeeStore.get())

  ipcMain.handle('employees:save', (_e, employees: Employee[]) => {
    const file = employeeStore.save(employees)
    notifyChange()
    return file
  })

  ipcMain.handle('employees:remove', (_e, id: string) => {
    const file = employeeStore.remove(id)
    notifyChange()
    return file
  })

  ipcMain.handle('employees:reset', () => {
    employeeStore.reset()
    notifyChange()
    return { success: true }
  })

  ipcMain.handle('employees:export', async () => {
    const file = employeeStore.get()
    if (!file || file.employees.length === 0) {
      return { success: false, error: 'No employees to export' }
    }
    const win = BrowserWindow.getFocusedWindow()
    if (!win) {
      return { success: false, error: 'No active window' }
    }
    const stamp = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog(win, {
      title: 'Export Employees Roster',
      defaultPath: `tamaflow-employees-${slugify(file.employees[0].displayName) || 'roster'}-${stamp}.json`,
      filters: [{ name: 'Employees Roster', extensions: ['json'] }]
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

  ipcMain.handle('employees:import', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) {
      return { success: false, error: 'No active window' }
    }
    const result = await dialog.showOpenDialog(win, {
      title: 'Import Employees Roster',
      properties: ['openFile'],
      filters: [
        { name: 'Employees Roster', extensions: ['json'] },
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
      const employees = EmployeeStore.validate(parsed)
      const current = employeeStore.get()?.employees ?? null
      const diff = computeDiff(employees, current)
      return { success: true, file: { version: 1, employees }, diff }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  console.log('[employees] IPC handlers registered')
}