import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Download } from 'lucide-react'
import FlowBuilder from '../flow/FlowBuilder'
import RoutesPreviewModal from '../flow/RoutesPreviewModal'
import RouteStatusPill from './RouteStatusPill'
import { useFlows } from '../context/FlowContext'
import { useEmployees } from '../context/EmployeeContext'
import { useCompany } from '../context/CompanyContext'
import type { CanvasState } from '../flow/types'
import type { FlowStatus, FlowSummary, RouteSummary } from '../ai/types'

type LoadStatus = 'loading' | 'present' | 'absent' | 'error'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 1200
const MIN_SAVED_MS = 800
const SAVED_HOLD_MS = 1800

function errMsg(err: unknown): string {
  if (err === null || err === undefined) return String(err)
  if (err instanceof Error) return err.message
  if (typeof err === 'object') { const obj = err as Record<string, unknown>; if (typeof obj.message === 'string') return obj.message; if (typeof obj.error === 'string') return obj.error; try { return JSON.stringify(err) } catch { return 'Unknown error' } }
  return String(err)
}

export function CanvasPage({ onViewChange }: { onViewChange?: (view: 'list' | 'canvas') => void }) {
  const { flows, get, save, remove, start, stop, listRoutes, onProgress } = useFlows()
  const { employees } = useEmployees()
  const { profile: companyProfile } = useCompany()

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('present')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [canvas, setCanvas] = useState<CanvasState>({ cards: [], connections: [] })
  const [flowName, setFlowName] = useState('')
  const [flowStatus, setFlowStatus] = useState<FlowStatus>('draft')
  const [flowId, setFlowId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveStatusRef = useRef<SaveStatus>('idle')
  const saveTimer = useRef<number | null>(null)
  const pendingFlush = useRef<{ canvas: CanvasState; name: string; id: string } | null>(null)
  const latestCanvas = useRef<CanvasState>(canvas)
  const latestName = useRef<string>(flowName)
  const latestFlowId = useRef<string | null>(flowId)
  const latestFlowStatus = useRef<FlowStatus>(flowStatus)
  const mounted = useRef(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [routes, setRoutes] = useState<RouteSummary[]>([])

  useEffect(() => { latestCanvas.current = canvas }, [canvas])
  useEffect(() => { latestName.current = flowName }, [flowName])
  useEffect(() => { latestFlowId.current = flowId }, [flowId])
  useEffect(() => { latestFlowStatus.current = flowStatus }, [flowStatus])

  // Routes subscription
  useEffect(() => {
    if (!flowId || loadStatus !== 'present') return
    if (flowStatus === 'draft') { setRoutes([]); return }
    let cancelled = false
    void (async () => {
      try {
        const list = await listRoutes(flowId)
        if (!cancelled) setRoutes(list)
      } catch (e) { console.error('[CanvasPage] listRoutes failed:', e) }
    })()
    const off = onProgress((fid, next) => {
      if (cancelled || fid !== flowId) return
      setRoutes(next)
    })
    return () => { cancelled = true; off?.() }
  }, [flowId, loadStatus, flowStatus, listRoutes, onProgress])

  const performSave = useCallback(async (next: CanvasState, name: string, targetId: string, status: FlowStatus) => {
    setSaveStatus('saving'); saveStatusRef.current = 'saving'; setSaveError(null)
    const startedAt = Date.now()
    try {
      await save({ id: targetId, name, status, cards: next.cards as any, connections: next.connections as any })
      if (!mounted.current) return
      const elapsed = Date.now() - startedAt; const remaining = MIN_SAVED_MS - elapsed
      if (remaining > 0) await new Promise<void>((r) => setTimeout(r, remaining))
      if (!mounted.current) return
      setSaveStatus('saved'); saveStatusRef.current = 'saved'; setSaveError(null)
      window.setTimeout(() => { if (!mounted.current) return; if (saveStatusRef.current === 'saved') { setSaveStatus('idle'); saveStatusRef.current = 'idle' } }, SAVED_HOLD_MS)
    } catch (e) { if (!mounted.current) return; const msg = errMsg(e); setSaveStatus('error'); saveStatusRef.current = 'error'; setSaveError(msg) }
  }, [save])

  const scheduleSave = useCallback((next: CanvasState, name: string) => {
    const id = latestFlowId.current
    if (!id) return
    pendingFlush.current = { canvas: next, name, id }
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { saveTimer.current = null; const pending = pendingFlush.current; pendingFlush.current = null; if (pending) void performSave(pending.canvas, pending.name, pending.id, latestFlowStatus.current) }, DEBOUNCE_MS)
  }, [performSave])

  const loadFlow = useCallback(async (id: string) => {
    mounted.current = true
    setLoadStatus('loading')
    setLoadError(null)
    try {
      const file = await get(id)
      if (!file) { setLoadStatus('absent'); return }
      setCanvas({ cards: file.flow.cards, connections: file.flow.connections })
      setFlowName(file.flow.name || '')
      setFlowStatus(file.flow.status ?? 'draft')
      setFlowId(id)
      setLoadStatus('present')
    } catch (e) { setLoadStatus('error'); setLoadError(errMsg(e)) }
  }, [get])

  const createFlow = useCallback(async () => {
    try {
      const file = await save({ name: 'Untitled flow', status: 'draft', cards: [], connections: [] })
      setCanvas({ cards: file.flow.cards, connections: file.flow.connections })
      setFlowName(file.flow.name || '')
      setFlowStatus(file.flow.status ?? 'draft')
      setFlowId(file.flow.id)
      setLoadStatus('present')
    } catch (e) { setLoadStatus('error'); setLoadError(errMsg(e)) }
  }, [save])

  // External status sync
  useEffect(() => {
    if (!flowId || loadStatus !== 'present') return
    const summary: FlowSummary | undefined = flows.find((f: FlowSummary) => f.id === flowId)
    if (!summary) return
    if (summary.status !== flowStatus) setFlowStatus(summary.status)
  }, [flows, flowId, loadStatus, flowStatus])

  const handleCanvasChange = useCallback((next: CanvasState) => { setCanvas(next); scheduleSave(next, latestName.current) }, [scheduleSave])
  const handleNameChange = useCallback((next: string) => { setFlowName(next); scheduleSave(latestCanvas.current, next) }, [scheduleSave])

  useEffect(() => { return () => { if (saveTimer.current !== null) { window.clearTimeout(saveTimer.current); saveTimer.current = null }; const pending = pendingFlush.current; if (pending) { pendingFlush.current = null; void save({ id: pending.id, name: pending.name, status: latestFlowStatus.current, cards: pending.canvas.cards as any, connections: pending.canvas.connections as any }).catch((e: unknown) => { console.error('[CanvasPage] unmount flush failed:', e) }) } } }, [save])

  const [deleting, setDeleting] = useState(false)
  const handleDelete = useCallback(async () => { if (deleting || !flowId) return; const ok = window.confirm(flowStatus === 'active' ? 'Delete this active flow? In-flight routes will be cancelled.' : "Delete this flow? This can't be undone."); if (!ok) return; setDeleting(true); try { if (saveTimer.current !== null) { window.clearTimeout(saveTimer.current); saveTimer.current = null; pendingFlush.current = null }; await remove(flowId); setFlowId(null); setLoadStatus('present'); setCanvas({ cards: [], connections: [] }); setFlowName(''); setFlowStatus('draft'); setRoutes([]) } catch (e) { console.error('[CanvasPage] delete failed:', e); setDeleting(false) } }, [deleting, flowStatus, flowId, remove])

  const [startInFlight, setStartInFlight] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [stopping, setStopping] = useState(false)

  const handleStart = useCallback(async () => {
    if (!flowId) return
    setStartInFlight(true); setStartError(null)
    try {
      if (saveTimer.current !== null) { window.clearTimeout(saveTimer.current); saveTimer.current = null }
      const pending = pendingFlush.current
      if (pending) { pendingFlush.current = null; await performSave(pending.canvas, pending.name, pending.id, latestFlowStatus.current) }
      const result = await start(flowId)
      if (result.ok) { setFlowStatus('active') } else { setStartError(result.error) }
    } catch (e) { setStartError(errMsg(e)) } finally { setStartInFlight(false) }
  }, [flowId, start, performSave])

  const handleStop = useCallback(async () => { if (stopping || !flowId) return; setStopping(true); try { const result = await stop(flowId); if (result.ok) { setFlowStatus('draft') } else { setSaveError(result.error) } } catch (e) { setSaveError(errMsg(e)) } finally { setStopping(false) } }, [flowId, stop, stopping])

  // Notify parent of view changes
  useEffect(() => {
    onViewChange?.(flowId ? 'canvas' : 'list')
  }, [flowId, onViewChange])

  if (!flowId) return <FlowsList flows={flows} loadStatus={loadStatus} onSelect={loadFlow} onCreate={createFlow} />
  if (loadStatus === 'loading') return <div className="flex items-center justify-center h-full text-gray-400">Loading flow…</div>
  if (loadStatus === 'absent') return <FlowsList flows={flows} loadStatus="present" onSelect={loadFlow} onCreate={createFlow} />
  if (loadStatus === 'error') return <div className="flex items-center justify-center h-full"><div className="text-center"><p className="text-lg font-medium text-red-600 mb-2">Load failed</p><p className="text-sm text-gray-500 mb-4">{loadError ?? 'Unknown error'}</p><button onClick={() => { setFlowId(null); setLoadStatus('present') }} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Back to Flows</button></div></div>

  const badgeLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save failed' : ''

  return (
    <div className="relative w-full h-full overflow-hidden">
      {!companyProfile && (
        <div className="absolute top-0 left-0 right-0 z-200 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2" style={{ zIndex: 200 }}>
          <span className="text-amber-600 text-sm">⚠</span>
          <span className="font-sans text-sm text-amber-800">Company profile not set up. </span>
          <span className="font-sans text-sm text-amber-700">Payment templates and route computation require a company profile.</span>
        </div>
      )}
      <FlowBuilder flowId={flowId} canvas={canvas} onCanvasChange={handleCanvasChange} flowName={flowName} onFlowNameChange={handleNameChange} onRequestPreview={() => setPreviewOpen(true)} locked={flowStatus === 'active'} {...(badgeLabel ? { saveBadge: { label: badgeLabel, tone: saveStatus as 'idle' | 'saving' | 'saved' | 'error' } } : {})} />

      {(flowStatus === 'active' || flowStatus === 'completed') && (
        <RoutesPanel status={flowStatus} routes={routes} employees={employees} canvas={canvas} />
      )}

      <div className="absolute bottom-4 right-4 z-100 flex gap-2" style={{ zIndex: 100 }}>
        {flowStatus === 'draft' && <>
          <button onClick={handleStart} disabled={startInFlight} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60">{startInFlight ? 'Starting…' : 'Start'}</button>
          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete'}</button>
        </>}
        {flowStatus === 'active' && <>
          <button onClick={handleStop} disabled={stopping} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-60">{stopping ? 'Stopping…' : 'Stop'}</button>
          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete'}</button>
        </>}
        {flowStatus === 'completed' && <>
          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete'}</button>
        </>}
      </div>

      {saveError && <div className="absolute top-4 right-4 z-100 px-3 py-1.5 text-xs font-mono text-red-600 bg-red-50 border border-red-200 rounded-md" style={{ zIndex: 100 }}>{saveError}</div>}
      {startError && <div className="absolute top-4 right-4 z-100 px-3 py-1.5 text-xs font-mono text-red-600 bg-red-50 border border-red-200 rounded-md max-w-md" style={{ zIndex: 100 }}>{startError}</div>}

      <RoutesPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} flowId={flowId} canvas={canvas} employees={employees} companyProfile={companyProfile} />
    </div>
  )
}

// ─── Routes Panel ─────────────────────────────────────────────────

function RoutesPanel({ status, routes, employees, canvas }: { status: FlowStatus; routes: RouteSummary[]; employees: any[]; canvas: CanvasState }) {
  const sorted = useMemo(() => [...routes].sort((a, b) => a.payeePlacementId.localeCompare(b.payeePlacementId)), [routes])
  const settledCount = routes.filter((r) => r.status === 'settled').length
  const failedCount = routes.filter((r) => r.status === 'failed').length
  const settled = settledCount + failedCount
  const total = routes.length
  const pct = total > 0 ? Math.round((settled / total) * 100) : 0

  return (
    <div style={{ position: 'absolute', left: 16, right: 16, bottom: 80, maxHeight: 280, background: '#fff', border: '1px solid #e0e0f0', borderRadius: 8, boxShadow: '0 4px 14px rgba(10,10,92,0.06)', zIndex: 80, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200" style={{ background: '#fafaff' }}>
        <p className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-bold m-0">Routes</p>
        <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider2">{status === 'active' ? 'Live progress' : 'Settlement history'}</span>
        <span className="font-mono text-[10px] text-gray-900 uppercase tracking-wider2 ml-auto">{settled}<span className="text-gray-400"> / {total} settled</span>{failedCount > 0 && <span className="text-red-500 ml-2">· {failedCount} failed</span>}</span>
        {status === 'active' && total > 0 && <div className="h-1 w-28 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {sorted.length === 0 ? (
          <div className="py-8 text-center font-sans text-xs italic text-gray-400">No routes to display.</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: '#f7f7fc' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9999bb', fontWeight: 700, borderBottom: '1px solid #e0e0f0' }}>Payee</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9999bb', fontWeight: 700, borderBottom: '1px solid #e0e0f0' }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9999bb', fontWeight: 700, borderBottom: '1px solid #e0e0f0' }}>Amount</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9999bb', fontWeight: 700, borderBottom: '1px solid #e0e0f0' }}>CC</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9999bb', fontWeight: 700, borderBottom: '1px solid #e0e0f0' }}>Tx / Error</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const employee = employees.find((e: any) => e.id === r.employeeId)
                const payeeCard = canvas.cards.find((c) => c.placementId === r.payeePlacementId)
                return (
                  <tr key={r.id} className="border-t border-gray-200">
                    <td style={{ padding: '8px 12px' }}>
                      <div className="font-sans text-xs font-medium text-gray-900">{employee?.displayName ?? '(unknown)'}</div>
                      <div className="font-mono text-[10px] text-gray-400">{payeeCard?.title ?? r.payeePlacementId.slice(0, 12)}</div>
                    </td>
                    <td style={{ padding: '8px 12px' }}><RouteStatusPill status={r.status} /></td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}><span className="font-mono text-xs text-gray-900">{r.grossPay}</span><span className="font-mono text-[10px] text-gray-400 ml-1">{r.payCurrency}</span></td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}><span className="font-mono text-xs font-bold text-gray-900">{r.amountCC}</span><span className="font-mono text-[10px] text-gray-400 ml-1">CC</span></td>
                    <td style={{ padding: '8px 12px' }}>
                      {r.txHash ? <span className="font-mono text-[10px] text-blue-600" title={r.txHash}>{r.txHash.slice(0, 10)}…</span> : r.error ? <span className="font-mono text-[10px] text-red-500">{r.error}</span> : <span className="font-mono text-[10px] text-gray-400">—</span>}
                    </td>
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

// ─── Flows List ─────────────────────────────────────────────────

function FlowsList({ flows, loadStatus, onSelect, onCreate }: { flows: FlowSummary[]; loadStatus: string; onSelect: (id: string) => void; onCreate: () => void }) {
  const { remove, exportJson, importJson } = useFlows()
  const [deleteTarget, setDeleteTarget] = useState<FlowSummary | null>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return flows
    return flows.filter((f) => f.name.toLowerCase().includes(q))
  }, [flows, search])

  const hasAny = flows.length > 0

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await remove(deleteTarget.id)
      setDeleteTarget(null)
    } catch (e) {
      console.error('[FlowsList] delete failed:', e)
    }
  }

  if (loadStatus === 'loading') return <div className="flex items-center justify-center h-full text-gray-400">Loading flows…</div>
  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Flow Builder</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={async () => { const r = await importJson(); if (r.error) alert(r.error) }} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-gray-900 hover:bg-gray-50"><Download size={11} />Import</button>
          <button type="button" onClick={onCreate} className="flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-[#1A1AE8] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90"><Plus size={12} />New Flow</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        {/* Filter row */}
        {hasAny && (
          <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name…" className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 font-sans text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        )}

        {/* Column header */}
        {hasAny && (
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-gray-200 bg-white px-4 py-2.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Name</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Status</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Routes</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Updated</span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Settled</span>
            <span className="text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Actions</span>
          </div>
        )}

        {/* Empty state */}
        {!hasAny && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400"><Plus size={20} /></div>
            <p className="m-0 font-sans text-sm font-medium text-gray-900">No flows yet</p>
            <p className="m-0 max-w-sm font-sans text-xs text-gray-400">Create your first flow to get started.</p>
            <button type="button" onClick={onCreate} className="mt-2 cursor-pointer rounded-md border-0 bg-[#1A1AE8] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:opacity-90"><Plus size={11} />New Flow</button>
          </div>
        )}

        {/* No matches */}
        {hasAny && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="m-0 font-sans text-sm text-gray-400">No flows match your search.</p>
            <button type="button" onClick={() => setSearch('')} className="cursor-pointer border-0 bg-transparent font-mono text-[10px] uppercase tracking-wider2 text-[#1A1AE8] underline">Clear search</button>
          </div>
        )}

        {/* Rows */}
        {filtered.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {filtered.map((flow) => (
              <li key={flow.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <div className="font-sans text-sm font-medium text-gray-900 truncate">{flow.name}</div>
                </div>
                <div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${flow.status === 'draft' ? 'bg-gray-100 text-gray-600' : flow.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{flow.status}</span>
                </div>
                <div className="font-sans text-sm text-gray-600">{flow.routeCount} routes</div>
                <div className="font-mono text-[11px] text-gray-400">{flow.updatedAt ? new Date(flow.updatedAt).toLocaleDateString() : '—'}</div>
                <div className="font-sans text-sm text-gray-600">
                  {flow.settledCount > 0 && <span className="text-green-600">{flow.settledCount} ✓</span>}
                  {flow.failedCount > 0 && <span className="text-red-500 ml-2">{flow.failedCount} ✕</span>}
                  {flow.settledCount === 0 && flow.failedCount === 0 && '—'}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button type="button" onClick={() => onSelect(flow.id)} className="flex items-center gap-1 px-2 py-1 bg-white text-[#0a0a5c] border border-gray-200 rounded font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-gray-50 cursor-pointer"><Pencil size={10} />edit</button>
                  <button type="button" onClick={async () => { const r = await exportJson(flow.id); if (r.error) alert(r.error) }} className="flex items-center gap-1 px-2 py-1 bg-white text-gray-600 border border-gray-200 rounded font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-gray-50 cursor-pointer"><Download size={10} />export</button>
                  <button type="button" onClick={() => setDeleteTarget(flow)} className="flex items-center gap-1 px-2 py-1 bg-white text-red-500 border border-red-200 rounded font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-red-50 cursor-pointer"><Trash2 size={10} />delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 m-0 mb-2">Delete flow?</h3>
            <p className="text-sm text-gray-500 m-0 mb-4">This will permanently delete "{deleteTarget.name}" and all its routes. This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CanvasPage
