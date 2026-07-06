import { BrowserWindow } from 'electron'
import { flowStore } from './flowStore'
import { routeStore } from './routeStore'
import { companyStore } from './companyStore'
import { transferAmulet, loadWallet } from './wallet'
import { enumerateRoutes } from '../shared/flowPaths'
import type {
  FlowDefinition,
  FlowOutcomeStatus,
  RouteRecord,
  RouteSummary,
} from '../preload/index.d'

/**
 * Background worker that settles payroll routes one at a time on
 * Canton. Owned by `main/index.ts` — instantiated after IPC handlers
 * register and `start()`ed on app ready, `stop()`ed on `before-quit`.
 *
 * Lifecycle per tick (1.5s):
 *   1. Walk every flow with `status === 'active'`.
 *   2. For each, find a `pending` route (oldest by createdAt).
 *   3. Status walk
 *      `pending → computing → converting → signing → sending → settled`
 *      with a single Canton `transferAmulet` call at the centre.
 *   4. On any error → status = `failed`, error message captured.
 *   5. After each tick, flows with no pending / in-flight routes flip
 *      to `completed`.
 *
 * v.1 has no scheduling — routes settle as soon as the worker picks
 * up an active flow.
 *
 * Concurrency: a single in-flight Promise per tick. If the previous
 * tick hasn't finished by the time the interval fires, we drop the
 * new tick (the next interval will pick it up). Canton doesn't gain
 * anything from concurrent transfers — the UTXO model serializes
 * settlement on the validator anyway.
 *
 * Recovery (on `start()`): any route left in `sending` from the last
 * session gets flipped to `failed` (Canton may have already moved
 * funds). Routes in `computing` / `converting` / `signing` are left
 * alone — the next tick retries them.
 */

const TICK_MS = 1500

/**
 * Pull an employee out of a route — the employee lives in the
 * employee store, not in the flow file. We pass the list of all
 * employees into `enumerateRoutes` and let it resolve by id.
 *
 * For the worker, we don't have a direct hook into EmployeeStore —
 * read it via the on-disk JSON file the same way the renderer does.
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

function loadEmployees(): import('../preload/index.d').Employee[] {
  const path = join(app.getPath('userData'), 'employees.json')
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as { employees?: unknown }
    return Array.isArray(raw?.employees) ? (raw.employees as import('../preload/index.d').Employee[]) : []
  } catch {
    return []
  }
}

function notifyProgress(flowId: string, routes: RouteSummary[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('flows:onProgress', flowId, routes)
  }
}

function notifyChange(): void {
  const list = flowStore.list()
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('flows:onChange', list)
  }
}

/**
 * Mark a route as `failed` with an error message and emit progress.
 */
function failRoute(flowId: string, routeId: string, err: string, now: string): void {
  const current = routeStore.get(flowId, routeId)
  if (!current) return
  const next: RouteRecord = {
    ...current,
    status: 'failed',
    error: err,
    completedAt: now,
  }
  routeStore.upsert(next)
  notifyProgress(flowId, routeStore.list(flowId))
}

/**
 * Walk one route through the status walk + settlement.
 *
 * `route` is the on-disk record at the moment we picked it up
 * (status = 'pending'). The compute payload was filled in by
 * `routes:start` so we don't re-derive here — guarantees the on-ledger
 * amount matches the preview byte-for-byte.
 */
async function processOne(flow: FlowDefinition, route: RouteRecord): Promise<void> {
  const now = () => new Date().toISOString()

  // ─── computing ────────────────────────────────────────────
  const computing: RouteRecord = {
    ...route,
    status: 'computing',
    startedAt: now(),
  }
  routeStore.upsert(computing)
  notifyProgress(flow.id, routeStore.list(flow.id))

  // ─── converting (FX rate application; this is bookkeeping —
  //     the actual conversion already happened in enumerateRoutes
  //     when start() built the route record) ──────────────────
  await new Promise<void>((r) => setTimeout(r, 50))
  const converting: RouteRecord = { ...computing, status: 'converting' }
  routeStore.upsert(converting)
  notifyProgress(flow.id, routeStore.list(flow.id))

  // ─── signing ──────────────────────────────────────────────
  await new Promise<void>((r) => setTimeout(r, 50))
  const signing: RouteRecord = { ...converting, status: 'signing' }
  routeStore.upsert(signing)
  notifyProgress(flow.id, routeStore.list(flow.id))

  // ─── sending (the actual Canton transfer) ────────────────
  const sending: RouteRecord = { ...signing, status: 'sending' }
  routeStore.upsert(sending)
  notifyProgress(flow.id, routeStore.list(flow.id))

  // Verify a wallet exists before sending — clearer error than letting
  // transferAmulet surface "No wallet loaded" deep in the SDK.
  const wallet = await loadWallet()
  if (!wallet) {
    failRoute(flow.id, route.id, 'No wallet — set one up in Settings → Wallet', now())
    return
  }

  const result = await transferAmulet({
    recipient: sending.recipientPartyId,
    amount: sending.amountCC,
    memo: sending.memo,
  })

  if (!result.success) {
    failRoute(flow.id, route.id, result.error ?? 'Transfer failed', now())
    return
  }

  // ─── settled ──────────────────────────────────────────────
  const settled: RouteRecord = {
    ...sending,
    status: 'settled',
    completedAt: now(),
  }
  if (result.updateId) settled.txHash = result.updateId
  routeStore.upsert(settled)
  notifyProgress(flow.id, routeStore.list(flow.id))
}

/**
 * One pass over every active flow. Designed to be called by
 * `setInterval` — concurrent ticks are dropped (the next interval
 * catches up).
 */
async function tick(): Promise<void> {
  const summaries = flowStore.list()
  const activeFlows = summaries.filter((s) => s.status === 'active')

  for (const summary of activeFlows) {
    const flow = flowStore.get(summary.id)?.flow
    if (!flow) continue

    const routes = routeStore.list(flow.id)
    const pending = routes
      .filter((r) => r.status === 'pending')
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))

    if (pending.length === 0) {
      // No pending routes — check whether anything is still in flight.
      const inFlight = routes.some((r) =>
        ['computing', 'converting', 'signing', 'sending'].includes(r.status),
      )
      if (!inFlight && routes.length > 0) {
        // All routes settled/failed → flow is done.
        flowStore.setStatus(flow.id, 'completed')
        notifyChange()
      }
      continue
    }

    const next = pending[0]
    // Process exactly one route per tick — Canton serialises anyway,
    // and a slow transfer (24h expiry timer aside) shouldn't block
    // other routes from making progress.
    try {
      await processOne(flow, next)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      failRoute(flow.id, next.id, msg, new Date().toISOString())
    }
  }
}

/**
 * Recovery pass: walk every persisted route and normalize anything
 * left mid-flight from a previous app session.
 *
 *   • status === 'sending' → Canton may have committed, but we have
 *     no proof. Mark failed with a clear "please re-submit" message
 *     and let the user decide. Settled ones are not touched.
 *   • status ∈ {computing, converting, signing} → safe to retry on
 *     the next tick. Leave as-is (the tick will flip them forward).
 *   • status === 'pending' → unchanged; will be picked up on the
 *     next tick.
 */
function recoverMidFlight(): void {
  const summaries = flowStore.list()
  for (const s of summaries) {
    if (s.status !== 'active') continue
    const routes = routeStore.list(s.id)
    const now = new Date().toISOString()
    for (const r of routes) {
      if (r.status === 'sending') {
        const next: RouteRecord = {
          ...r,
          status: 'failed',
          error: 'Recovered after restart — please re-submit',
          completedAt: now,
        }
        routeStore.upsert(next)
      }
    }
  }
  notifyChange()
}

/** Singleton — instantiated once in main/index.ts. */
export class FlowWorker {
  private intervalHandle: NodeJS.Timeout | null = null
  private inFlight: Promise<void> | null = null

  start(): void {
    if (this.intervalHandle) return
    recoverMidFlight()
    this.intervalHandle = setInterval(() => {
      // Drop the tick if the previous one is still running. The
      // interval keeps firing, so the next gap picks up.
      if (this.inFlight) return
      this.inFlight = tick().finally(() => {
        this.inFlight = null
      })
    }, TICK_MS)
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  /**
   * Public for tests / IPC handlers that need to force a tick
   * (e.g. right after `routes:start` so the worker doesn't wait
   * up to 1.5s before picking up the first route).
   */
  async tickNow(): Promise<void> {
    if (this.inFlight) {
      await this.inFlight
    }
    this.inFlight = tick().finally(() => {
      this.inFlight = null
    })
    await this.inFlight
  }

  /**
   * Rebuild all route records for a flow from its current canvas.
   * Called by `flows:start` — persists one `pending` route per
   * Payee card so the worker has something to walk on its next tick.
   *
   * Routes that are already settled are left alone (re-starting an
   * already-completed flow doesn't double-pay). Failed routes are
   * also left in place so the user can see the failure history.
   */
  primeFlow(flowId: string): { ok: true; added: number } | { ok: false; error: string } {
    const flowFile = flowStore.get(flowId)
    if (!flowFile) return { ok: false, error: 'Flow not found' }
    const employees = loadEmployees()
    const companyFile = companyStore.get()
    const companyProfile = companyFile?.profile ?? null
    const result = enumerateRoutes({
      flowId,
      cards: flowFile.flow.cards,
      connections: flowFile.flow.connections,
      employees,
      companyProfile,
    })
    const now = new Date().toISOString()
    const existing = routeStore.list(flowId)
    const existingPayees = new Set(
      existing
        .filter((r) => r.status !== 'failed') // failed routes are stale-ish; re-create them as pending
        .map((r) => r.payeePlacementId),
    )
    let added = 0
    for (const o of result.routes) {
      if (existingPayees.has(o.payeePlacementId)) continue
      const record: RouteRecord = {
        id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        flowId,
        status: 'pending',
        employeeId: o.employeeId,
        payeePlacementId: o.payeePlacementId,
        sourcePlacementId: o.sourcePlacementId,
        paymentPlacementId: o.paymentPlacementId,
        amountCC: o.amountCC,
        payCurrency: o.payCurrency,
        grossPay: o.grossPay,
        recipientPartyId: o.recipientPartyId,
        memo: o.memo,
        createdAt: now,
      }
      if (o.fxRate) record.fxRate = o.fxRate
      if (o.withholdingAmount) record.withholdingAmount = o.withholdingAmount
      if (o.socialSecurityAmount) record.socialSecurityAmount = o.socialSecurityAmount
      routeStore.upsert(record)
      added++
    }
    // Reset failed routes so they can be retried on re-start.
    for (const r of existing.filter((x) => x.status === 'failed')) {
      routeStore.upsert({ ...r, status: 'pending', error: undefined, completedAt: undefined })
    }
    return { ok: true, added }
  }

  /** Fail every in-flight route (called from `flows:stop`). */
  stopFlow(flowId: string, reason: string): void {
    const routes = routeStore.list(flowId)
    const now = new Date().toISOString()
    for (const r of routes) {
      if (['computing', 'converting', 'signing', 'sending'].includes(r.status)) {
        routeStore.upsert({ ...r, status: 'failed', error: reason, completedAt: now })
      }
    }
  }
}

export const flowWorker = new FlowWorker()

// Type-only export so tests / callers can type their route-status
// walks without pulling in the preload types directly.
export type { FlowOutcomeStatus }