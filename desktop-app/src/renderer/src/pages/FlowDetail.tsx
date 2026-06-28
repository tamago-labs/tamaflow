// `/flows/:id` route — the flow builder page.
//
// Owns the canonical `canvas` and `flowName` state for ONE flow and
// persists changes to disk via `FlowContext.save`. <FlowBuilder>
// becomes a controlled component (props + callbacks) so the lifecycle
// (mount → load → edit → debounce-save → unmount) lives here rather
// than inside the builder.
//
// Save strategy
// -------------
// • 1.2s debounce after the last edit. The same duration used by
//   `CompanyGate` so the "Saving…" affordance is perceptible.
// • On unmount, any pending debounced save is flushed synchronously
//   (via a cancel + immediate save) so the user doesn't lose a
//   last-second edit when they navigate away.
// • The badge is computed from a local `saveStatus` state machine
//   (`idle` / `saving` / `saved` / `error`) — it tracks the most
//   recent in-flight attempt, NOT whether the on-disk content is
//   actually identical to in-memory (that would require a deep
//   compare on every render).
// • On `flows:onChange`, if the remote id no longer exists (someone
//   deleted the flow from another surface), we navigate back to
//   `/flows` so the user doesn't sit on a stale editor.
//
// Phase 2 scope: load, save, restore. Phase 3+ adds the "Preview
// Outcomes" + "Submit" affordances, but this page is the stable
// shell that hosts them.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import FlowBuilder from '../flow/FlowBuilder'
import type { CanvasCard as RendererCanvasCard, CanvasState, Connection as RendererConnection } from '../flow/types'
import { useFlows } from '../context/FlowContext'

/**
 * Map the IPC `FlowFile` payload (preload's `CanvasCard` / `Connection`)
 * to the renderer's stricter shapes. The two type surfaces are
 * structurally compatible at runtime — the preload type omits the
 * renderer's `id` field (a template id only relevant for palette
 * entries) and the renderer doesn't care about the explicit
 * `Record<string, unknown>` shape of the field envelopes. The casts
 * live at this one boundary so the rest of the page is fully typed.
 */
function toRendererCanvasState(file: {
  flow: { cards?: unknown; connections?: unknown }
}): CanvasState {
  const cards = (file.flow.cards ?? []) as unknown as RendererCanvasCard[]
  const connections = (file.flow.connections ?? []) as unknown as RendererConnection[]
  return { cards, connections }
}

/**
 * Extract a human-readable string from an arbitrary thrown value.
 * Mirrors the `errMsg` in FlowContext / CompanyContext — kept local
 * to this page so we don't have to reach across to the context file
 * for one helper.
 */
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
  const { flows, get, save, remove } = useFlows()

  // ─── Load state ────────────────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  // ─── Editable state ────────────────────────────────────────────
  const [canvas, setCanvas] = useState<CanvasState>({ cards: [], connections: [] })
  const [flowName, setFlowName] = useState('')
  const [nameReady, setNameReady] = useState(false)

  // ─── Save state ────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveStatusRef = useRef<SaveStatus>('idle')

  // ─── Refs for debounce + flush-on-unmount ──────────────────────
  const saveTimer = useRef<number | null>(null)
  // `id` is captured at schedule time so navigating from /flows/A to
  // /flows/B while a save for A is debounced doesn't accidentally
  // persist A's content under B's id when the timer eventually fires.
  const pendingFlush = useRef<{ canvas: CanvasState; name: string; id: string } | null>(null)
  const latestCanvas = useRef<CanvasState>(canvas)
  const latestName = useRef<string>(flowName)
  const mounted = useRef(true)

  // Keep the latest-* refs in sync so the unmount flush sees the most
  // recent edits (the state setters above run async; refs are sync).
  // Done in an effect so we don't write to refs during render.
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

  // ─── Save (debounced) ──────────────────────────────────────────
  const performSave = useCallback(
    async (next: CanvasState, name: string, targetId: string) => {
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
        // Pad the "saving" UI for MIN_SAVED_MS so the spinner registers
        // — the IPC round-trip is single-digit ms.
        const elapsed = Date.now() - startedAt
        const remaining = MIN_SAVED_MS - elapsed
        if (remaining > 0) {
          await new Promise<void>((r) => setTimeout(r, remaining))
        }
        if (!mounted.current) return
        setSaveStatus('saved')
        saveStatusRef.current = 'saved'
        setSaveError(null)
        // Brief "Saved" hold before reverting to idle so the user
        // notices the badge without it sticking around forever.
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
    (next: CanvasState, name: string) => {
      pendingFlush.current = { canvas: next, name, id }
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
      }
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null
        const pending = pendingFlush.current
        pendingFlush.current = null
        if (pending) void performSave(pending.canvas, pending.name, pending.id)
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

  // ─── External delete: if the flow id vanishes from the summary
  //     list (deleted from another surface), navigate back to /flows.
  useEffect(() => {
    if (loadStatus !== 'present') return
    if (!flows.some((f) => f.id === id)) {
      navigate('/flows', { replace: true })
    }
  }, [flows, id, loadStatus, navigate])

  // ─── Unmount: flush any pending debounced save ─────────────────
  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      const pending = pendingFlush.current
      if (pending) {
        pendingFlush.current = null
        // Fire-and-forget — the IPC handler will still persist.
        // Use the id captured at schedule time, not the (now stale)
        // id from this effect's closure, to be defensive against
        // navigation happening during the debounce window.
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

  // ─── Manual save (button) ──────────────────────────────────────
  // The flow auto-saves 1.2s after each edit, but the user can also
  // force an immediate save via the Save button. Cancels any pending
  // debounced timer and runs a fresh save right now with the latest
  // canvas + name from refs (so we don't capture stale state from a
  // closure built before the most recent edit).
  const handleManualSave = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
      pendingFlush.current = null
    }
    void performSave(latestCanvas.current, latestName.current, id)
  }, [id, performSave])

  // ─── Delete flow (used by the header action) ───────────────────
  const [deleting, setDeleting] = useState(false)
  const handleDelete = useCallback(async () => {
    if (deleting) return
    const ok = window.confirm('Delete this flow? This can\'t be undone.')
    if (!ok) return
    setDeleting(true)
    try {
      // Cancel any pending debounce so we don't re-save after delete.
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
  }, [deleting, id, navigate, remove])

  // ─── Render ────────────────────────────────────────────────────
  if (loadStatus === 'loading') {
    return (
      <div className="font-sans text-sm text-brand-muted">Loading flow…</div>
    )
  }

  if (loadStatus === 'absent') {
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

  if (loadStatus === 'error') {
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
            {loadError ?? 'Unknown error'}
          </p>
        </div>
      </div>
    )
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
      {/* Full-bleed canvas — MainLayout strips its padding + TopBar
          for this route so the builder claims the whole viewport
          below the sidebar. The FlowBuilder handles its own top-left
          toolbar, top-centre name editor, and top-right save badge,
          so all chrome for THIS page lives in floating overlays at
          the corners. */}
      <FlowBuilder
        canvas={canvas}
        onCanvasChange={handleCanvasChange}
        flowName={flowName}
        onFlowNameChange={handleNameChange}
        {...(badgeLabel
          ? {
              saveBadge: {
                label: badgeLabel,
                tone: saveStatus as 'idle' | 'saving' | 'saved' | 'error',
              },
            }
          : {})}
      />

      {/* Floating chrome — anchored to the canvas viewport so they
          don't intrude on the work area. Back lives bottom-left
          (out of the way of the top-left Add Card toolbar), delete
          sits bottom-right (mirrored, mirrors the save badge in the
          top-right). */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          zIndex: 100,
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
      </div>

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
        {saveError && (
          <span
            role="alert"
            className="font-mono text-[10px] tracking-wider2 uppercase text-[#c83030] bg-white/90 border border-[#c83030] rounded-md px-2.5 py-1.5 backdrop-blur"
          >
            {saveError}
          </span>
        )}
        <button
          type="button"
          onClick={handleManualSave}
          disabled={saveStatus === 'saving'}
          className="py-1.5 px-3 bg-brand-blue text-white border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed backdrop-blur"
          style={{ boxShadow: '0 2px 8px rgba(10,10,92,0.18)' }}
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="py-1.5 px-3 bg-white/90 text-[#c83030] border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed backdrop-blur"
          style={{ boxShadow: '0 2px 8px rgba(10,10,92,0.06)' }}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {!nameReady && (
        <span className="sr-only">Loading flow name…</span>
      )}
    </div>
  )
}
