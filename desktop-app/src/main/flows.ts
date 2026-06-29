import { ipcMain, BrowserWindow } from 'electron'
import { flowStore, FlowStore } from './flowStore'
import { routeStore } from './routeStore'
import { flowWorker } from './flowWorker'
import { loadWallet } from './wallet'
import type {
  FlowFile,
  FlowSummary,
  RouteRecord,
  RouteSummary,
} from '../preload/index.d'

/**
 * IPC handlers for the payroll flow builder.
 *
 * Mirrors the `company.ts` / `employee.ts` patterns:
 *   - one `registerFlowIpcHandlers` function exported and called
 *     from `main/index.ts`
 *   - save / remove / start / stop push `flows:onChange` so every
 *     subscribed renderer (the list page AND the builder) react in
 *     lock-step
 *
 * Two push channels:
 *   - `flows:onChange`  — full summary list (cheap: summaries only).
 *     Fires after lifecycle mutations.
 *   - `flows:onProgress` — (flowId, routes) for one flow. Fires after
 *     every route status transition the worker drives.
 */

function notifyChange(list: FlowSummary[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('flows:onChange', list)
  }
}

function notifyProgress(flowId: string, routes: RouteSummary[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('flows:onProgress', flowId, routes)
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
      raw: Parameters<typeof flowStore.save>[0],
    ): FlowFile => {
      const file = flowStore.save(raw)
      notifyChange(flowStore.list())
      return file
    },
  )

  ipcMain.handle('flows:remove', (_e, id: string): FlowSummary[] => {
    // Fail in-flight routes first so the worker doesn't try to write
    // a record under a flow that's been deleted.
    flowWorker.stopFlow(id, 'Flow deleted')
    const next = flowStore.remove(id)
    notifyChange(next)
    return next
  })

  /**
   * Flip a draft flow to 'active' and prime the worker with one route
   * per Payee card. Worker picks them up on its next tick.
   *
   * Validation:
   *   - flow must exist
   *   - flow must be in 'draft' (re-starting a 'completed' flow is
   *     handled by the user deleting + recreating, or via the same
   *     path with reset of routes — kept simple for MVP)
   *   - wallet must be set up (the worker needs it to send funds)
   */
  ipcMain.handle(
    'flows:start',
    async (_e, id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const file = flowStore.get(id)
      if (!file) return { ok: false, error: 'Flow not found' }
      if (file.flow.status === 'active') {
        return { ok: false, error: 'Flow is already active' }
      }
      if (file.flow.status === 'completed') {
        return {
          ok: false,
          error: 'Flow already completed — delete it and create a new one to re-run.',
        }
      }
      // Verify a wallet exists up front so the user gets a clear
      // error before any routes are written.
      const wallet = await loadWallet()
      if (!wallet) {
        return { ok: false, error: 'No wallet — set one up in Settings → Wallet first.' }
      }
      // Prime the worker: write one pending route per Payee card.
      const primed = flowWorker.primeFlow(id)
      if (!primed.ok) return primed
      // Flip the flow to active.
      flowStore.setStatus(id, 'active')
      // Tell the worker to pick up the new routes immediately rather
      // than waiting up to 1.5s for the next tick.
      void flowWorker.tickNow().catch((err) => {
        console.error('[flows] worker tickNow after start failed:', err)
      })
      notifyChange(flowStore.list())
      notifyProgress(id, routeStore.list(id))
      return { ok: true }
    },
  )

  /**
   * Stop an active flow. In-flight routes flip to 'failed' with
   * reason='Stopped by user'. Pending routes stay pending so re-start
   * picks them up. Status flips back to 'draft'.
   */
  ipcMain.handle(
    'flows:stop',
    (_e, id: string): { ok: true } | { ok: false; error: string } => {
      const file = flowStore.get(id)
      if (!file) return { ok: false, error: 'Flow not found' }
      if (file.flow.status !== 'active') {
        return { ok: false, error: 'Flow is not active' }
      }
      flowWorker.stopFlow(id, 'Stopped by user')
      flowStore.setStatus(id, 'draft')
      notifyChange(flowStore.list())
      notifyProgress(id, routeStore.list(id))
      return { ok: true }
    },
  )

  ipcMain.handle('flows:routes:list', (_e, flowId: string): RouteSummary[] => {
    return routeStore.list(flowId)
  })

  /**
   * Cross-flow route aggregator for the Settlement History page.
   * Returns a single flat list of every route across every flow,
   * sorted by completedAt desc (fallback to createdAt desc). The
   * renderer filters by status + display.
   */
  ipcMain.handle('flows:routes:listAll', (): RouteSummary[] => {
    return routeStore.listAll()
  })

  ipcMain.handle(
    'flows:routes:get',
    (_e, flowId: string, routeId: string): RouteRecord | null => {
      return routeStore.get(flowId, routeId)
    },
  )

  console.log('[flows] IPC handlers registered')
}

// Re-export the validator so callers (e.g. a future import-from-file
// flow) can validate before saving without reaching into the store.
export { FlowStore }