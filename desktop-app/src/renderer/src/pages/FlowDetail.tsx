// `/flows/:id` route — the flow detail page.
//
// Owns the canonical `canvas` + `flowName` state for ONE flow and
// persists changes to disk via `FlowContext.save`. <FlowBuilder> is a
// controlled component (props + callbacks) so the lifecycle
// (mount → load → edit → debounce-save → unmount) lives here rather
// than inside the builder.
//
// Three views driven by `flow.status`:
//   • draft     — editable canvas + Start button.
//   • active    — locked canvas + live routes table + Stop button.
//   • completed — read-only history (routes table) + Delete button.
//
// Save strategy
// -------------
// • 1.2s debounce after the last edit. The same duration used by
//   `CompanyGate` so the "Saving…" affordance is perceptible.
// • On unmount, any pending debounced save is flushed synchronously
//   (via a cancel + immediate save) so the user doesn't lose a
//   last-second edit when they navigate away.
// • The badge is computed from a local `saveStatus` state machine
//   (`idle` / `saving` / `saved` / `error`).
// • On `flows:onChange`, if the remote id no longer exists (someone
//   deleted the flow from another surface), we navigate back to
//   `/flows` so the user doesn't sit on a stale editor.
// • `flows:onChange` also bumps `flowStatus` so the view flips to
//   `completed` the instant the worker flips it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Play, Square, X, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import FlowBuilder from '../flow/FlowBuilder'
import RoutesPreviewModal from '../flow/RoutesPreviewModal'
import RouteStatusPill from '../components/RouteStatusPill'
import type { CanvasCard as RendererCanvasCard, CanvasState, Connection as RendererConnection } from '../flow/types'
import { useFlows } from '../context/FlowContext'
import { useEmployees } from '../context/EmployeeContext'
import { useCompany } from '../context/CompanyContext'
import type { FlowStatus, FlowSummary, RouteSummary } from '../../../preload/index.d'

/**
 * Map the IPC `FlowFile` payload (preload's `CanvasCard` / `Connection`)
 * to the renderer's stricter shapes.
 */
function toRendererCanvasState(file: {
  flow: { cards?: unknown; connections?: unknown }
}): CanvasState {
  const cards = (file.flow.cards ?? []) as unknown as RendererCanvasCard[]
  const connections = (file.flow.connections ?? []) as unknown as RendererConnection[]
  return { cards, connections }
}

function errMsg(err: unknown): string {
  if (err === null || err === undefined) return String(err)
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    try {
      return JSON.stringify(err)
    } catch {
      return 'Unknown error'
    }
  }
  return String(err)
}

type LoadStatus = 'loading' | 'present' | 'absent' | 'error'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 1200
const MIN_SAVED_MS = 800
const SAVED_HOLD_MS = 1800

export default function FlowDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    flows,
    get,
    save,
    remove,
    start,
    stop,
    listRoutes,
    onProgress,
  } = useFlows()
  const { employees } = useEmployees()
  const { profile: companyProfile } = useCompany()

  // ─── Load state ────────────────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  // ─── Editable state ────────────────────────────────────────────
  const [canvas, setCanvas] = useState<CanvasState>({ cards: [], connections: [] })
  const [flowName, setFlowName] = useState('')
  const [flowStatus, setFlowStatus] = useState<FlowStatus>('draft')
  const [nameReady, setNameReady] = useState(false)

  // ─── Save state ────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveStatusRef = useRef<SaveStatus>('idle')

  // ─── Refs for debounce + flush-on-unmount ──────────────────────
  const saveTimer = useRef<number | null>(null)
  const pendingFlush = useRef<{
    canvas: CanvasState
    name: string
    id: string
  } | null>(null)
  const latestCanvas = useRef<CanvasState>(canvas)
  const latestName = useRef<string>(flowName)
  const mounted = useRef(true)

  useEffect(() => {
    latestCanvas.current = canvas
  }, [canvas])
  useEffect(() => {
    latestName.current = flowName
  }, [flowName])

  // ─── Mount: load flow ──────────────────────────────────────────
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    setLoadStatus('loading')
    setLoadError(null)
    setNameReady(false)

    void (async () => {
      try {
        const file = await get(id)
        if (cancelled) return
        if (!file) {
          setLoadStatus('absent')
          return
        }
        setCanvas(toRendererCanvasState(file))
        setFlowName(file.flow.name || '')
        setFlowStatus(file.flow.status ?? 'draft')
        setNameReady(true)
        setLoadStatus('present')
      } catch (e) {
        if (cancelled) return
        setLoadStatus('error')
        setLoadError(errMsg(e))
      }
    })()

    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [id, get])

  // ─── External status sync (flows:onChange push channel) ───────
  // When the worker flips status to 'completed' or the user stops from
  // another surface, the local flowStatus should follow.
  useEffect(() => {
    if (loadStatus !== 'present') return
    const summary: FlowSummary | undefined = flows.find((f) => f.id === id)
    if (!summary) return
    if (summary.status !== flowStatus) setFlowStatus(summary.status)
  }, [flows, id, loadStatus, flowStatus])

  // ─── Save (debounced) ──────────────────────────────────────────
  const performSave = useCallback(
    async (
      next: CanvasState,
      name: string,
      targetId: string,
    ) => {
      setSaveStatus('saving')
      saveStatusRef.current = 'saving'
      setSaveError(null)
      const startedAt = Date.now()
      try {
        await save({
          id: targetId,
          name,
          cards: next.cards as unknown as Parameters<typeof save>[0]['cards'],
          connections: next.connections as unknown as Parameters<typeof save>[0]['connections'],
        } as Parameters<typeof save>[0])
        if (!mounted.current) return
        const elapsed = Date.now() - startedAt
        const remaining = MIN_SAVED_MS - elapsed
        if (remaining > 0) {
          await new Promise<void>((r) => setTimeout(r, remaining))
        }
        if (!mounted.current) return
        setSaveStatus('saved')
        saveStatusRef.current = 'saved'
        setSaveError(null)
        window.setTimeout(() => {
          if (!mounted.current) return
          if (saveStatusRef.current === 'saved') {
            setSaveStatus('idle')
            saveStatusRef.current = 'idle'
          }
        }, SAVED_HOLD_MS)
      } catch (e) {
        if (!mounted.current) return
        const msg = errMsg(e)
        setSaveStatus('error')
        saveStatusRef.current = 'error'
        setSaveError(msg)
      }
    },
    [save],
  )

  const scheduleSave = useCallback(
    (
      next: CanvasState,
      name: string,
    ) => {
      pendingFlush.current = { canvas: next, name, id }
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
      }
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null
        const pending = pendingFlush.current
        pendingFlush.current = null
        if (pending)
          void performSave(pending.canvas, pending.name, pending.id)
      }, DEBOUNCE_MS)
    },
    [id, performSave],
  )

  // ─── Edit handlers (controlled FlowBuilder) ────────────────────
  const handleCanvasChange = useCallback(
    (next: CanvasState) => {
      setCanvas(next)
      scheduleSave(next, latestName.current)
    },
    [scheduleSave],
  )

  const handleNameChange = useCallback(
    (next: string) => {
      setFlowName(next)
      scheduleSave(latestCanvas.current, next)
    },
    [scheduleSave],
  )

  // ─── External delete ───────────────────────────────────────────
  useEffect(() => {
    if (loadStatus !== 'present') return
    if (!flows.some((f) => f.id === id)) {
      navigate('/flows', { replace: true })
    }
  }, [flows, id, loadStatus, navigate])

  // ─── Unmount flush ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      const pending = pendingFlush.current
      if (pending) {
        pendingFlush.current = null
        void save({
          id: pending.id,
          name: pending.name,
          cards: pending.canvas.cards as unknown as Parameters<typeof save>[0]['cards'],
          connections: pending.canvas.connections as unknown as Parameters<typeof save>[0]['connections'],
        } as Parameters<typeof save>[0]).catch((e) => {
          console.error('[FlowDetail] unmount flush failed:', e)
        })
      }
    }
  }, [save])

  // ─── Manual save ───────────────────────────────────────────────
  const handleManualSave = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
      pendingFlush.current = null
    }
    void performSave(latestCanvas.current, latestName.current, id)
  }, [id, performSave])

  // ─── Delete flow ───────────────────────────────────────────────
  const [deleting, setDeleting] = useState(false)
  const handleDelete = useCallback(async () => {
    if (deleting) return
    const ok = window.confirm(
      flowStatus === 'active'
        ? 'Delete this active flow? In-flight routes will be cancelled.'
        : "Delete this flow? This can't be undone.",
    )
    if (!ok) return
    setDeleting(true)
    try {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
        pendingFlush.current = null
      }
      await remove(id)
      navigate('/flows', { replace: true })
    } catch (e) {
      console.error('[FlowDetail] delete failed:', e)
      setDeleting(false)
    }
  }, [deleting, flowStatus, id, navigate, remove])

  // ─── Start / stop lifecycle ────────────────────────────────────
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [startInFlight, setStartInFlight] = useState(false)
  const [stopping, setStopping] = useState(false)

  const openStartModal = useCallback(() => {
    setStartError(null)
    setStartModalOpen(true)
  }, [])

  const handleStart = useCallback(async () => {
    setStartInFlight(true)
    setStartError(null)
    try {
      // Flush any pending debounced save so the worker sees the
      // most-recent canvas before settling.
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
        pendingFlush.current = null
      }
      await performSave(latestCanvas.current, latestName.current, id)
      const result = await start(id)
      if (result.ok) {
        setFlowStatus('active')
        setStartModalOpen(false)
      } else {
        setStartError(result.error)
      }
    } catch (e) {
      setStartError(errMsg(e))
    } finally {
      setStartInFlight(false)
    }
  }, [id, performSave, start])

  const handleStop = useCallback(async () => {
    if (stopping) return
    setStopping(true)
    try {
      const result = await stop(id)
      if (result.ok) {
        setFlowStatus('draft')
      } else {
        setSaveError(result.error)
      }
    } catch (e) {
      setSaveError(errMsg(e))
    } finally {
      setStopping(false)
    }
  }, [id, stop, stopping])

  // ─── Routes subscription ──────────────────────────────────────
  // Polled on mount + via flows:onProgress push. Used by both active
  // and completed views.
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  useEffect(() => {
    if (loadStatus !== 'present') return
    if (flowStatus === 'draft') {
      // Draft flows have no persisted routes yet — clear the list so
      // a stale view from a previous flow id doesn't bleed in.
      setRoutes([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const list = await listRoutes(id)
        if (!cancelled) setRoutes(list)
      } catch (e) {
        console.error('[FlowDetail] listRoutes failed:', e)
      }
    })()
    const off = onProgress((flowId, next) => {
      if (cancelled) return
      if (flowId !== id) return
      setRoutes(next)
    })
    return () => {
      cancelled = true
      off?.()
    }
  }, [id, loadStatus, flowStatus, listRoutes, onProgress])

  // ─── Preview modal ────────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false)

  // Counters for the start confirmation modal. Computed unconditionally
  // (before the early returns) so the hook count stays stable across
  // renders — the work is trivial, no memoisation needed.
  const routeCount = canvas.cards.filter((c) => c.category === 'payee').length

  // ─── Render ────────────────────────────────────────────────────
  if (loadStatus === 'loading') {
    return <div className="font-sans text-sm text-brand-muted">Loading flow…</div>
  }

  if (loadStatus === 'absent') {
    return <NotFoundView id={id} />
  }

  if (loadStatus === 'error') {
    return <ErrorView error={loadError} />
  }

  // ─── Loaded ─────────────────────────────────────────────────────
  const badgeLabel =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'saved'
        ? 'Saved'
        : saveStatus === 'error'
          ? 'Save failed'
          : ''

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <FlowBuilder
        flowId={id}
        canvas={canvas}
        onCanvasChange={handleCanvasChange}
        flowName={flowName}
        onFlowNameChange={handleNameChange}
        onRequestPreview={() => setPreviewOpen(true)}
        locked={flowStatus === 'active'}
        {...(badgeLabel
          ? {
              saveBadge: {
                label: badgeLabel,
                tone: saveStatus as 'idle' | 'saving' | 'saved' | 'error',
              },
            }
          : {})}
      />

      {/* Bottom-right action cluster — different set per status. */}
      <ActionCluster
        status={flowStatus}
        saving={saveStatus === 'saving'}
        deleting={deleting}
        stopping={stopping}
        saveError={saveError}
        onBackToList={() => navigate('/flows')}
        onPreview={() => setPreviewOpen(true)}
        onSave={handleManualSave}
        onDelete={handleDelete}
        onStart={openStartModal}
        onStop={handleStop}
      />

      {/* Routes panel — sits below the canvas for active + completed
          views. Active: live progress; completed: read-only history. */}
      {(flowStatus === 'active' || flowStatus === 'completed') && (
        <RoutesPanel
          status={flowStatus}
          routes={routes}
          employees={employees}
          canvas={canvas}
        />
      )}

      {/* Pre-submit preview modal — uses the shared enumerateRoutes +
          computeOutcome modules so the table matches what the worker
          will eventually send. */}
      <RoutesPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        flowId={id}
        canvas={canvas}
        employees={employees}
        companyProfile={companyProfile}
      />

      {/* Start-flow confirmation modal. */}
      <AnimatePresence>
        {startModalOpen && (
          <StartConfirmModal
            routeCount={routeCount}
            inFlight={startInFlight}
            error={startError}
            onConfirm={handleStart}
            onCancel={() => {
              if (startInFlight) return
              setStartModalOpen(false)
              setStartError(null)
            }}
          />
        )}
      </AnimatePresence>

      {!nameReady && <span className="sr-only">Loading flow name…</span>}
    </div>
  )
}

// ─── Status views ───────────────────────────────────────────────────

function NotFoundView({ id }: { id: string }) {
  return (
    <div className="max-w-xl">
      <Link
        to="/flows"
        className="inline-flex items-center gap-1 font-mono text-[11px] tracking-wider2 uppercase text-brand-blue no-underline mb-4"
      >
        <ArrowLeft size={12} />
        Back to Active Flows
      </Link>
      <div className="bg-white border border-brand-border rounded-md p-8">
        <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-2 m-0">
          Workflow
        </p>
        <h1 className="text-[28px] font-light text-brand-navy tracking-tight leading-[1.15] m-0">
          Flow not found
        </h1>
        <p className="font-sans text-sm text-brand-muted mt-2 mb-0">
          The flow <span className="font-mono">{id}</span> doesn't exist
          (it may have been deleted from another window).
        </p>
      </div>
    </div>
  )
}

function ErrorView({ error }: { error: string | null }) {
  return (
    <div className="max-w-xl">
      <Link
        to="/flows"
        className="inline-flex items-center gap-1 font-mono text-[11px] tracking-wider2 uppercase text-brand-blue no-underline mb-4"
      >
        <ArrowLeft size={12} />
        Back to Active Flows
      </Link>
      <div className="bg-white border border-brand-border rounded-md p-8">
        <p className="font-mono text-[11px] font-medium tracking-wider3 text-[#c83030] uppercase mb-2 m-0">
          Load failed
        </p>
        <p className="font-sans text-sm text-brand-navy m-0">
          {error ?? 'Unknown error'}
        </p>
      </div>
    </div>
  )
}

// ─── Action cluster ─────────────────────────────────────────────────

interface ActionClusterProps {
  status: FlowStatus
  saving: boolean
  deleting: boolean
  stopping: boolean
  saveError: string | null
  onBackToList: () => void
  onPreview: () => void
  onSave: () => void
  onDelete: () => void
  onStart: () => void
  onStop: () => void
}

function ActionCluster({
  status,
  saving,
  deleting,
  stopping,
  saveError,
  onBackToList,
  onPreview,
  onSave,
  onDelete,
  onStart,
  onStop,
}: ActionClusterProps) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'auto',
      }}
    >
      <Link
        to="/flows"
        className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-white/90 text-brand-blue border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase no-underline backdrop-blur"
        style={{ boxShadow: '0 2px 8px rgba(10,10,92,0.06)' }}
      >
        <ArrowLeft size={11} />
        Active Flows
      </Link>
      {saveError && (
        <span
          role="alert"
          className="font-mono text-[10px] tracking-wider2 uppercase text-[#c83030] bg-white/90 border border-[#c83030] rounded-md px-2.5 py-1.5 backdrop-blur"
        >
          {saveError}
        </span>
      )}

      {status === 'draft' && (
        <>
          <button
            type="button"
            onClick={onPreview}
            className="py-1.5 px-3 bg-white/90 text-brand-blue border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-white backdrop-blur"
            style={{ boxShadow: '0 2px 8px rgba(10,10,92,0.06)' }}
          >
            Preview Routes
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="py-1.5 px-3 bg-white/90 text-brand-blue border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed backdrop-blur"
            style={{ boxShadow: '0 2px 8px rgba(10,10,92,0.06)' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onStart}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-brand-blue text-white border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 backdrop-blur"
            style={{ boxShadow: '0 2px 8px rgba(10,10,92,0.18)' }}
          >
            <Play size={11} />
            Start Flow
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="py-1.5 px-3 bg-white/90 text-[#c83030] border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed backdrop-blur"
            style={{ boxShadow: '0 2px 8px rgba(10,10,92,0.06)' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </>
      )}

      {status === 'active' && (
        <>
          <button
            type="button"
            onClick={onStop}
            disabled={stopping}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-white/90 text-[#c83030] border border-[#c83030] rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed backdrop-blur"
            style={{ boxShadow: '0 2px 8px rgba(200,48,48,0.18)' }}
          >
            <Square size={11} />
            {stopping ? 'Stopping…' : 'Stop'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="py-1.5 px-3 bg-white/90 text-[#c83030] border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed backdrop-blur"
            style={{ boxShadow: '0 2px 8px rgba(10,10,92,0.06)' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </>
      )}

      {status === 'completed' && (
        <>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="py-1.5 px-3 bg-white/90 text-[#c83030] border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed backdrop-blur"
            style={{ boxShadow: '0 2px 8px rgba(10,10,92,0.06)' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={onBackToList}
            className="py-1.5 px-3 bg-brand-blue text-white border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 backdrop-blur"
            style={{ boxShadow: '0 2px 8px rgba(10,10,92,0.18)' }}
          >
            Active Flows
          </button>
        </>
      )}
    </div>
  )
}

// ─── Routes panel ───────────────────────────────────────────────────

interface RoutesPanelProps {
  status: FlowStatus
  routes: RouteSummary[]
  employees: import('../../../preload/index.d').Employee[]
  canvas: CanvasState
}

function RoutesPanel({ status, routes, employees, canvas }: RoutesPanelProps) {
  const sorted = useMemo(
    () => [...routes].sort((a, b) => a.payeePlacementId.localeCompare(b.payeePlacementId)),
    [routes],
  )
  const settledCount = routes.filter((r) => r.status === 'settled').length
  const failedCount = routes.filter((r) => r.status === 'failed').length
  const settled = settledCount + failedCount
  const total = routes.length
  const pct = total > 0 ? Math.round((settled / total) * 100) : 0

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 80,
        maxHeight: 280,
        background: '#fff',
        border: '1px solid #e0e0f0',
        borderRadius: 8,
        boxShadow: '0 4px 14px rgba(10,10,92,0.06)',
        zIndex: 80,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-2.5 border-b border-brand-border"
        style={{ background: '#fafaff' }}
      >
        <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-bold m-0">
          Routes
        </p>
        <span className="font-mono text-[10px] text-brand-muted uppercase tracking-wider2">
          {status === 'active' ? 'Live progress' : 'Settlement history'}
        </span>
        <span className="font-mono text-[10px] text-brand-navy uppercase tracking-wider2 ml-auto">
          {settled}
          <span className="text-brand-muted"> / {total} settled</span>
          {failedCount > 0 && (
            <span className="text-brand-err ml-2">· {failedCount} failed</span>
          )}
        </span>
        {status === 'active' && total > 0 && (
          <div className="h-1 w-28 bg-brand-light rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-blue rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {sorted.length === 0 ? (
          <div className="py-8 text-center font-sans text-xs italic text-brand-muted">
            No routes to display.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr
                style={{
                  background: '#f7f7fc',
                  fontFamily: 'inherit',
                }}
              >
                <Th>Payee</Th>
                <Th>Status</Th>
                <Th right>Amount</Th>
                <Th right>CC</Th>
                <Th>Tx / Error</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const employee = employees.find((e) => e.id === r.employeeId)
                const payeeCard = canvas.cards.find(
                  (c) => c.placementId === r.payeePlacementId,
                )
                return (
                  <tr key={r.id} className="border-t border-brand-border">
                    <Td>
                      <div className="font-sans text-xs font-medium text-brand-navy">
                        {employee?.displayName ?? '(unknown)'}
                      </div>
                      <div className="font-mono text-[10px] text-brand-muted">
                        {payeeCard?.title ?? r.payeePlacementId.slice(0, 12)}
                      </div>
                    </Td>
                    <Td>
                      <StatusPill status={r.status} />
                    </Td>
                    <Td right>
                      <span className="font-mono text-xs text-brand-navy">
                        {r.grossPay}
                      </span>
                      <span className="font-mono text-[10px] text-brand-muted ml-1">
                        {r.payCurrency}
                      </span>
                    </Td>
                    <Td right>
                      <span className="font-mono text-xs font-bold text-brand-navy">
                        {r.amountCC}
                      </span>
                      <span className="font-mono text-[10px] text-brand-muted ml-1">
                        CC
                      </span>
                    </Td>
                    <Td>
                      {r.txHash ? (
                        <span
                          className="font-mono text-[10px] text-brand-blue"
                          title={r.txHash}
                        >
                          {r.txHash.slice(0, 10)}…
                        </span>
                      ) : r.error ? (
                        <span className="font-mono text-[10px] text-brand-err">
                          {r.error}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-brand-muted">
                          —
                        </span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      style={{
        padding: '8px 12px',
        textAlign: right ? 'right' : 'left',
        fontFamily: 'inherit',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--brand-muted, #7a7a99)',
        fontWeight: 700,
        borderBottom: '1px solid #ececf5',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  right,
}: {
  children: React.ReactNode
  right?: boolean
}) {
  return (
    <td
      style={{
        padding: '8px 12px',
        textAlign: right ? 'right' : 'left',
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  )
}

function StatusPill({ status }: { status: RouteSummary['status'] }) {
  return <RouteStatusPill status={status} />
}

// ─── Start confirmation modal ───────────────────────────────────────

interface StartConfirmModalProps {
  routeCount: number
  inFlight: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

function StartConfirmModal({
  routeCount,
  inFlight,
  error,
  onConfirm,
  onCancel,
}: StartConfirmModalProps) {
  return (
    <>
      <motion.div
        key="start-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10,10,92,0.32)',
          zIndex: 250,
        }}
      />
      <motion.div
        key="start-card"
        initial={{ opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }}
        animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
        exit={{ opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          width: 480,
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 20px 50px rgba(10,10,92,0.22)',
          zIndex: 260,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #ececf5' }}>
          <p
            style={{
              fontFamily: 'inherit',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#1a1ae8',
              margin: 0,
              fontWeight: 700,
            }}
          >
            Start flow
          </p>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#0a0a5c',
              margin: '4px 0 0',
              letterSpacing: '0.01em',
            }}
          >
            Settle {routeCount} {routeCount === 1 ? 'route' : 'routes'}?
          </h2>
          <p
            style={{
              fontSize: 12,
              color: '#7a7a99',
              margin: '6px 0 0',
              lineHeight: 1.4,
            }}
          >
            This locks the canvas — you&apos;ll need to stop the flow to edit it.
            You can still delete the flow or view its routes. Routes settle as
            soon as the worker picks the flow up.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 22px',
              background: '#fdecec',
              borderBottom: '1px solid #f0c8c8',
              fontSize: 12,
              color: '#c83030',
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            padding: '14px 22px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={inFlight}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <X size={11} />
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={inFlight || routeCount === 0}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-brand-blue text-white border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Check size={11} />
            {inFlight ? 'Starting…' : 'Start'}
          </button>
        </div>
      </motion.div>
    </>
  )
}