import { ipcMain, BrowserWindow } from 'electron'
import { flowStore, FlowStore } from './flowStore'
import type { FlowDefinition, FlowFile, FlowSummary } from '../preload/index.d'

/**
 * IPC handlers for the payroll flow builder.
 *
 * Mirrors the `company.ts` / `employee.ts` patterns:
 *   - one `registerFlowIpcHandlers` function exported and called
 *     from `main/index.ts`
 *   - save / remove push `flows:onChange` so every subscribed
 *     renderer (the list page AND the builder) react in lock-step
 *
 * The push payload is the FULL summary list — the list page wants the
 * whole thing on every change anyway (cheap: summaries only, no card
 * bodies), and the builder page uses it to detect external deletes.
 */
function notifyChange(list: FlowSummary[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('flows:onChange', list)
  }
}

export function registerFlowIpcHandlers(): void {
  ipcMain.handle('flows:list', (): FlowSummary[] => flowStore.list())

  ipcMain.handle('flows:get', (_e, id: string): FlowFile | null => {
    return flowStore.get(id)
  })

  ipcMain.handle(
    'flows:save',
    (
      _e,
      raw: Partial<FlowDefinition> & { name?: string },
    ): FlowFile => {
      const file = flowStore.save(raw)
      notifyChange(flowStore.list())
      return file
    },
  )

  ipcMain.handle('flows:remove', (_e, id: string): FlowSummary[] => {
    const next = flowStore.remove(id)
    notifyChange(next)
    return next
  })

  console.log('[flows] IPC handlers registered')
}

// Re-export the validator so callers (e.g. a future import-from-file
// flow) can validate before saving without reaching into the store.
export { FlowStore }