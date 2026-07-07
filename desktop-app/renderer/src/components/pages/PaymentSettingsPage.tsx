import { useEffect, useState } from 'react'
import { Check, X, Layers, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { useCompany } from '../../context/CompanyContext'
import type { CompanyProfile, PaymentTemplate } from '../../ai/types'
import { paymentTemplateSubtitle } from '../../flow/flowCards'

const RATE_REGEX = /^\d+(\.\d+)?$/

function isValidRate(s: string): boolean {
  if (s === '') return true
  if (!RATE_REGEX.test(s)) return false
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 && n <= 1
}

interface DraftPaymentTemplate {
  id?: string
  name: string
  withholdingRate: string
  defaultMemo: string
  createdAt?: string
  updatedAt?: string
}

function toDraft(t: PaymentTemplate): DraftPaymentTemplate {
  return { id: t.id, name: t.name, withholdingRate: t.withholdingRate, defaultMemo: t.defaultMemo, createdAt: t.createdAt, updatedAt: t.updatedAt }
}

function fromDraft(d: DraftPaymentTemplate, now: string): PaymentTemplate {
  return { id: d.id ?? 'tpl_pending', name: d.name.trim(), withholdingRate: d.withholdingRate.trim(), defaultMemo: d.defaultMemo.trim(), createdAt: d.createdAt ?? now, updatedAt: now }
}

function validateRow(d: DraftPaymentTemplate): { name?: string; withholdingRate?: string; defaultMemo?: string } {
  const errors: { name?: string; withholdingRate?: string; defaultMemo?: string } = {}
  if (d.name.trim().length === 0) errors.name = 'Name is required'
  else if (d.name.trim().length > 60) errors.name = 'Name must be 60 characters or fewer'
  if (!isValidRate(d.withholdingRate)) errors.withholdingRate = 'Decimal between 0 and 1, or blank'
  if (d.defaultMemo.trim().length === 0) errors.defaultMemo = 'Default memo is required'
  else if (d.defaultMemo.trim().length > 200) errors.defaultMemo = 'Memo must be 200 characters or fewer'
  return errors
}

export default function PaymentSettingsPage() {
  const { profile, save } = useCompany()
  const [drafts, setDrafts] = useState<DraftPaymentTemplate[]>(() => (profile?.paymentTemplates ?? []).map(toDraft))
  const [editing, setEditing] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!profile) return
    if (saving) return
    setDrafts((profile.paymentTemplates ?? []).map(toDraft))
    setEditing(new Set())
  }, [profile, saving])

  if (!profile) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Payment Settings</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-md p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-sans text-sm font-medium text-amber-800 m-0">Company profile not set up</p>
              <p className="font-sans text-sm text-amber-700 m-0 mt-1">You need to set up your company profile before configuring payment templates. Go to Settings to complete your company setup.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function startEdit(id: string) { setEditing((s) => new Set([...s, id])) }

  function cancelEdit(id: string) {
    setDrafts((current) => {
      const row = current.find((d) => d.id === id)
      if (!row) return current
      if (row.id?.startsWith('__new__')) return current.filter((d) => d.id !== id)
      const saved = (profile!.paymentTemplates ?? []).find((t) => t.id === row.id)
      return saved ? current.map((d) => (d.id === row.id ? toDraft(saved) : d)) : current.filter((d) => d.id !== id)
    })
    setEditing((s) => { const next = new Set(s); next.delete(id); return next })
  }

  function updateDraft(id: string, patch: Partial<DraftPaymentTemplate>) {
    setDrafts((current) => current.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function deleteRow(id: string) {
    if (!id) return
    const tpl = (profile!.paymentTemplates ?? []).find((t) => t.id === id)
    if (!tpl) return
    if (!window.confirm(`Delete template "${tpl.name}"? Canvas cards using it will fall back to Direct Payment.`)) return
    setDrafts((current) => current.filter((d) => d.id !== id))
  }

  function addRow() {
    const stubKey = `__new__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    setDrafts((current) => [...current, { id: stubKey, name: '', withholdingRate: '', defaultMemo: 'Payroll' }])
    setEditing((s) => new Set([...s, stubKey]))
  }

  const allValid = drafts.every((d) => Object.keys(validateRow(d)).length === 0)
  const anyInEdit = editing.size > 0
  const dirty = anyInEdit && allValid

  async function handleSaveAll() {
    if (!profile || !dirty) return
    setSaving(true); setError(null)
    try {
      const now = new Date().toISOString()
      const next: CompanyProfile = { ...profile, paymentTemplates: drafts.map((d) => fromDraft(d, now)) }
      await save(next)
      setSavedAt(Date.now()); setEditing(new Set())
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setSaving(false) }
  }

  function handleReset() {
    if (!profile) return
    setDrafts((profile.paymentTemplates ?? []).map(toDraft)); setEditing(new Set()); setError(null)
  }

  const canSave = dirty && !saving

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Settings</h1>
      <p className="font-sans text-sm text-gray-500 mb-6">Each template becomes its own palette tile on the flow canvas. Direct Payment is built-in and always available.</p>

      <div className="bg-white border border-gray-200 rounded-md p-6">
        {/* Direct Payment (built-in) */}
        <div className="mb-6">
          <p className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase m-0 mb-2">Built-in</p>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-sans text-sm font-semibold text-gray-900 m-0">Direct Payment</div>
              <div className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase m-0 mt-0.5">No deductions · built-in card</div>
              <p className="font-sans text-xs text-gray-500 m-0 mt-1">No deductions applied. You set the memo per card on the canvas.</p>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-wider2 text-gray-400 whitespace-nowrap">Always available</span>
          </div>
        </div>

        {/* Custom templates */}
        <div>
          <p className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase m-0 mb-2">Custom templates</p>
          {drafts.length === 0 ? (
            <div className="font-sans text-xs italic text-gray-400 p-4 border border-dashed border-gray-300 rounded-md text-center">No custom templates yet. Click "+ New template" to add one.</div>
          ) : (
            <div className="space-y-2">
              {drafts.map((d) => {
                const key = d.id
                const isEditing = editing.has(key)
                const errors = validateRow(d)
                return (
                  <TemplateRow key={key} draft={d} isEditing={isEditing} errors={errors} onStartEdit={() => startEdit(key)} onCancelEdit={() => cancelEdit(key)} onChange={(patch) => updateDraft(key, patch)} onDelete={() => deleteRow(d.id!)} />
                )
              })}
            </div>
          )}
          <button type="button" onClick={addRow} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 mt-3 bg-white text-blue-600 border border-dashed border-blue-600 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-blue-50 disabled:opacity-50">+ New template</button>
        </div>

        {/* Save row */}
        <div className="flex items-center gap-2 pt-5 mt-5 border-t border-gray-200">
          <button type="button" onClick={handleSaveAll} disabled={!canSave} className={`flex items-center gap-1.5 px-4 py-2 border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase ${canSave ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            <Check size={12} />{saving ? 'Saving…' : 'Save all'}
          </button>
          <button type="button" onClick={handleReset} disabled={!dirty || saving} className={`flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase ${dirty && !saving ? 'text-gray-900 cursor-pointer hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}>
            <X size={12} />Discard
          </button>
          {savedAt && !error && !dirty && <span className="font-mono text-[10px] uppercase tracking-wider2 text-green-600">Saved</span>}
          {error && <span className="font-mono text-[10px] uppercase tracking-wider2 text-red-500">{error}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Per-row component ─────────────────────────────────────────

interface TemplateRowProps {
  draft: DraftPaymentTemplate
  isEditing: boolean
  errors: ReturnType<typeof validateRow>
  onStartEdit: () => void
  onCancelEdit: () => void
  onChange: (patch: Partial<DraftPaymentTemplate>) => void
  onDelete: () => void
}

function TemplateRow({ draft, isEditing, errors, onStartEdit, onCancelEdit, onChange, onDelete }: TemplateRowProps) {
  const subtitle = (() => {
    const t: PaymentTemplate = { id: draft.id ?? 'pending', name: draft.name, withholdingRate: draft.withholdingRate, defaultMemo: draft.defaultMemo, createdAt: draft.createdAt ?? '', updatedAt: draft.updatedAt ?? '' }
    return paymentTemplateSubtitle(t)
  })()

  if (!isEditing) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-sans text-sm font-semibold text-gray-900 m-0 truncate">{draft.name || <em className="text-gray-400">Untitled</em>}</div>
          <div className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase m-0 mt-0.5 truncate">{subtitle}</div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button type="button" onClick={onStartEdit} className="flex items-center gap-1 px-2 py-1 bg-white text-gray-900 border border-gray-200 rounded font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-gray-50"><Pencil size={10} />edit</button>
          {draft.id && <button type="button" onClick={onDelete} className="flex items-center gap-1 px-2 py-1 bg-white text-red-500 border border-red-200 rounded font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-red-50"><Trash2 size={10} />delete</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-blue-500 rounded-md p-3 space-y-3">
      <Field label="Name" error={errors.name}>
        <input type="text" value={draft.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="US payroll deductions" maxLength={60} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md font-sans text-sm text-gray-900 focus:outline-none focus:border-blue-500" />
      </Field>
      <Field label="Withholding rate" hint="Decimal between 0 and 1 (e.g. 0.27 = 27%)" error={errors.withholdingRate}>
        <div className="flex items-center gap-2">
          <input type="text" inputMode="decimal" value={draft.withholdingRate} onChange={(e) => onChange({ withholdingRate: e.target.value })} placeholder="0.27" className="w-32 px-3 py-2 bg-white border border-gray-300 rounded-md font-mono text-sm text-gray-900 focus:outline-none focus:border-blue-500" />
          <span className="font-mono text-[11px] text-gray-400 uppercase tracking-wider2">= {(Number(draft.withholdingRate) * 100).toFixed(2)}%</span>
        </div>
      </Field>
      <Field label="Default memo" error={errors.defaultMemo}>
        <input type="text" value={draft.defaultMemo} onChange={(e) => onChange({ defaultMemo: e.target.value })} placeholder="March payroll" maxLength={200} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md font-mono text-sm text-gray-900 focus:outline-none focus:border-blue-500" />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancelEdit} className="px-3 py-1.5 bg-white text-gray-900 border border-gray-200 rounded font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  )
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold m-0 mb-1">{label}</p>
      {children}
      {hint && !error && <p className="font-sans text-[11px] text-gray-400 m-0 mt-1 italic">{hint}</p>}
      {error && <p className="font-sans text-[11px] text-red-500 m-0 mt-1">{error}</p>}
    </div>
  )
}
