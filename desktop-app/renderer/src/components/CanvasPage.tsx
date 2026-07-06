import { useCallback, useEffect, useRef, useState } from 'react'
import FlowBuilder from '../flow/FlowBuilder'
import RoutesPreviewModal from '../flow/RoutesPreviewModal'
import { useFlows } from '../context/FlowContext'
import { useEmployees } from '../context/EmployeeContext'
import { useCompany } from '../context/CompanyContext'
import type { CanvasState } from '../flow/types'
import type { FlowStatus, FlowSummary } from '../ai/types'

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

export function CanvasPage() {
  const { flows, get, save, remove, start, stop } = useFlows()
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

  useEffect(() => { latestCanvas.current = canvas }, [canvas])
  useEffect(() => { latestName.current = flowName }, [flowName])
  useEffect(() => { latestFlowId.current = flowId }, [flowId])
  useEffect(() => { latestFlowStatus.current = flowStatus }, [flowStatus])

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

  // Load a specific flow by id
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

  // Create a new flow
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

  // Unmount flush
  useEffect(() => { return () => { if (saveTimer.current !== null) { window.clearTimeout(saveTimer.current); saveTimer.current = null }; const pending = pendingFlush.current; if (pending) { pendingFlush.current = null; void save({ id: pending.id, name: pending.name, status: latestFlowStatus.current, cards: pending.canvas.cards as any, connections: pending.canvas.connections as any }).catch((e: unknown) => { console.error('[CanvasPage] unmount flush failed:', e) }) } } }, [save])

  // Delete flow
  const [deleting, setDeleting] = useState(false)
  const handleDelete = useCallback(async () => { if (deleting || !flowId) return; const ok = window.confirm(flowStatus === 'active' ? 'Delete this active flow? In-flight routes will be cancelled.' : "Delete this flow? This can't be undone."); if (!ok) return; setDeleting(true); try { if (saveTimer.current !== null) { window.clearTimeout(saveTimer.current); saveTimer.current = null; pendingFlush.current = null }; await remove(flowId); setFlowId(null); setLoadStatus('present'); setCanvas({ cards: [], connections: [] }); setFlowName(''); setFlowStatus('draft') } catch (e) { console.error('[CanvasPage] delete failed:', e); setDeleting(false) } }, [deleting, flowStatus, flowId, remove])

  // Start / stop
  const [startInFlight, setStartInFlight] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [stopping, setStopping] = useState(false)

  const handleStart = useCallback(async () => {
    if (!flowId) return
    setStartInFlight(true); setStartError(null)
    try {
      // Flush any pending debounced save first
      if (saveTimer.current !== null) { window.clearTimeout(saveTimer.current); saveTimer.current = null }
      const pending = pendingFlush.current
      if (pending) { pendingFlush.current = null; await performSave(pending.canvas, pending.name, pending.id, latestFlowStatus.current) }
      const result = await start(flowId)
      if (result.ok) { setFlowStatus('active') } else { setStartError(result.error) }
    } catch (e) { setStartError(errMsg(e)) } finally { setStartInFlight(false) }
  }, [flowId, start, performSave])

  const handleStop = useCallback(async () => { if (stopping || !flowId) return; setStopping(true); try { const result = await stop(flowId); if (result.ok) { setFlowStatus('draft') } else { setSaveError(result.error) } } catch (e) { setSaveError(errMsg(e)) } finally { setStopping(false) } }, [flowId, stop, stopping])

  // Show flows list if no flow selected
  if (!flowId) {
    return <FlowsList flows={flows} loadStatus={loadStatus} onSelect={loadFlow} onCreate={createFlow} />
  }

  if (loadStatus === 'loading') return <div className="flex items-center justify-center h-full text-gray-400">Loading flow…</div>
  if (loadStatus === 'absent') return <FlowsList flows={flows} loadStatus="present" onSelect={loadFlow} onCreate={createFlow} />
  if (loadStatus === 'error') return <div className="flex items-center justify-center h-full"><div className="text-center"><p className="text-lg font-medium text-red-600 mb-2">Load failed</p><p className="text-sm text-gray-500 mb-4">{loadError ?? 'Unknown error'}</p><button onClick={() => { setFlowId(null); setLoadStatus('present') }} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Back to Flows</button></div></div>

  const badgeLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save failed' : ''

  return (
    <div className="relative w-full h-full overflow-hidden">
      <FlowBuilder flowId={flowId} canvas={canvas} onCanvasChange={handleCanvasChange} flowName={flowName} onFlowNameChange={handleNameChange} onRequestPreview={() => setPreviewOpen(true)} locked={flowStatus === 'active'} {...(badgeLabel ? { saveBadge: { label: badgeLabel, tone: saveStatus as 'idle' | 'saving' | 'saved' | 'error' } } : {})} />

      <div className="absolute bottom-4 right-4 z-100 flex gap-2" style={{ zIndex: 100 }}>
        {flowStatus === 'draft' && <>
          <button onClick={handleStart} disabled={startInFlight} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60">{startInFlight ? 'Starting…' : 'Start'}</button>
          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete'}</button>
        </>}
        {flowStatus === 'active' && <>
          <button onClick={handleStop} disabled={stopping} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-60">{stopping ? 'Stopping…' : 'Stop'}</button>
          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete'}</button>
        </>}
      </div>

      {saveError && <div className="absolute top-4 right-4 z-100 px-3 py-1.5 text-xs font-mono text-red-600 bg-red-50 border border-red-200 rounded-md" style={{ zIndex: 100 }}>{saveError}</div>}
      {startError && <div className="absolute top-4 right-4 z-100 px-3 py-1.5 text-xs font-mono text-red-600 bg-red-50 border border-red-200 rounded-md max-w-md" style={{ zIndex: 100 }}>{startError}</div>}

      <RoutesPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} flowId={flowId} canvas={canvas} employees={employees} companyProfile={companyProfile} />
    </div>
  )
}

function FlowsList({ flows, loadStatus, onSelect, onCreate }: { flows: FlowSummary[]; loadStatus: string; onSelect: (id: string) => void; onCreate: () => void }) {
  if (loadStatus === 'loading') return <div className="flex items-center justify-center h-full text-gray-400">Loading flows…</div>
  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Flow Builder</h1>
        <button onClick={onCreate} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">New Flow</button>
      </div>
      {flows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center"><div className="text-center"><p className="text-lg font-medium text-gray-900 mb-2">No flows yet</p><p className="text-sm text-gray-500">Create your first flow to get started</p></div></div>
      ) : (
        <div className="flex-1 overflow-y-auto"><div className="grid gap-4">
          {flows.map((flow) => (
            <button key={flow.id} onClick={() => onSelect(flow.id)} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all text-left">
              <div><h3 className="font-medium text-gray-900">{flow.name}</h3><p className="text-sm text-gray-500 mt-1">{flow.payeeCount} recipients · {flow.routeCount} routes</p></div>
              <div className="flex items-center gap-3"><span className={`px-2 py-1 text-xs font-medium rounded ${flow.status === 'draft' ? 'bg-gray-100 text-gray-700' : flow.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{flow.status}</span><span className="text-gray-400">→</span></div>
            </button>
          ))}
        </div></div>
      )}
    </div>
  )
}

export default CanvasPage
