import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useCompany } from '../../context/CompanyContext'
import Drawer from '../Drawer'
import type { CompanyProfile, PaymentTemplate } from '../../ai/types'

export default function PaymentSettingsPage() {
  const { profile, save } = useCompany()
  const [templates, setTemplates] = useState<PaymentTemplate[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PaymentTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PaymentTemplate | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setTemplates(profile.paymentTemplates ?? [])
    }
  }, [profile])

  const filtered = templates.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()))

  if (!profile) {
    return (
      <div>
        <h1 className="text-2xl font-light tracking-tight text-[#0a0a5c] mb-6">Payment Settings</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-md p-6 flex items-start gap-3">
          <span className="text-amber-600 text-lg">⚠</span>
          <div>
            <p className="font-sans text-sm font-medium text-amber-800 m-0">Company profile not set up</p>
            <p className="font-sans text-sm text-amber-700 m-0 mt-1">Set up your company profile in Settings.</p>
          </div>
        </div>
      </div>
    )
  }

  const handleSaveTemplate = async (data: { name: string; withholdingRate: string; defaultMemo: string; applyTax: boolean; applySS: boolean }) => {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const template: PaymentTemplate = {
        id: editTarget?.id ?? 'tpl_' + Date.now().toString(36),
        name: data.name.trim(),
        withholdingRate: data.withholdingRate.trim(),
        defaultMemo: data.defaultMemo.trim(),
        applyEmployeeTax: data.applyTax,
        applyEmployeeSocialSecurity: data.applySS,
        createdAt: editTarget?.createdAt ?? now,
        updatedAt: now
      }
      console.log('[PaymentSettings] Saving template:', template)
      const next = editTarget ? templates.map((t) => t.id === editTarget.id ? template : t) : [...templates, template]
      console.log('[PaymentSettings] Next templates:', next)
      await save({ ...profile, paymentTemplates: next })
      setTemplates(next)
      setDrawerOpen(false)
      setEditTarget(null)
    } catch (e) { console.error('[PaymentSettings] Save error:', e) } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const next = templates.filter((t) => t.id !== deleteTarget.id)
    await save({ ...profile, paymentTemplates: next })
    setTemplates(next)
    setDeleteTarget(null)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Payment Settings</h1>
        </div>
        <button type="button" onClick={() => { setEditTarget(null); setDrawerOpen(true) }} className="flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-[#1A1AE8] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90">
          <Plus size={12} />New Template
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        {/* Filter */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name…" className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 font-sans text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none" />
          </div>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-gray-200 bg-white px-4 py-2.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Name</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Withholding</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Default Memo</span>
          <span className="text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">Actions</span>
        </div>

        {/* Direct Payment row */}
        <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 items-center">
          <div>
            <span className="font-sans text-sm font-medium text-gray-900">Direct Payment</span>
            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-gray-200 text-gray-500">Built-in</span>
          </div>
          <span className="font-mono text-xs text-gray-400">—</span>
          <span className="font-mono text-xs text-gray-400">—</span>
          <span className="font-mono text-[10px] text-gray-400">Always available</span>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400"><Plus size={20} /></div>
            <p className="m-0 font-sans text-sm font-medium text-gray-900">No custom templates yet</p>
            <p className="m-0 max-w-sm font-sans text-xs text-gray-400">Create payment templates with withholding tax and social security deductions.</p>
          </div>
        )}

        {/* Rows */}
        {filtered.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {filtered.map((t) => (
              <li key={t.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <div className="font-sans text-sm font-medium text-gray-900 truncate">{t.name}</div>
                </div>
                <div className="font-mono text-xs text-gray-600">
                  {t.withholdingRate ? `${(Number(t.withholdingRate) * 100).toFixed(1)}%` : '—'}
                </div>
                <div className="font-mono text-xs text-gray-600 truncate" title={t.defaultMemo}>{t.defaultMemo || '—'}</div>
                <div className="flex items-center justify-end gap-1">
                  <button type="button" onClick={() => { setEditTarget(t); setDrawerOpen(true) }} className="p-1.5 bg-white text-[#0a0a5c] border border-gray-200 rounded hover:bg-gray-50 cursor-pointer" title="Edit"><Pencil size={14} /></button>
                  <button type="button" onClick={() => setDeleteTarget(t)} className="p-1.5 bg-white text-red-500 border border-red-200 rounded hover:bg-red-50 cursor-pointer" title="Delete"><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add/Edit Drawer */}
      <TemplateDrawer open={drawerOpen} onClose={() => { setDrawerOpen(false); setEditTarget(null) }} initial={editTarget} onSave={handleSaveTemplate} saving={saving} />

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 m-0 mb-2">Delete template?</h3>
            <p className="text-sm text-gray-500 m-0 mb-4">Delete "{deleteTarget.name}"? Canvas cards using it will fall back to Direct Payment.</p>
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

// ─── Template Drawer ─────────────────────────────────────────

interface TemplateDrawerProps {
  open: boolean
  onClose: () => void
  initial?: PaymentTemplate | null
  onSave: (data: { name: string; withholdingRate: string; defaultMemo: string; applyTax: boolean; applySS: boolean }) => void
  saving: boolean
}

function TemplateDrawer({ open, onClose, initial, onSave, saving }: TemplateDrawerProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [defaultMemo, setDefaultMemo] = useState(initial?.defaultMemo ?? 'Payroll with deductions')
  const [withholdingRate, setWithholdingRate] = useState(initial?.withholdingRate ?? '0')
  const [applyTax, setApplyTax] = useState(initial?.applyEmployeeTax ?? false)
  const [applySS, setApplySS] = useState(initial?.applyEmployeeSocialSecurity ?? false)

  // Sync form state when initial changes (for edit mode)
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setDefaultMemo(initial?.defaultMemo ?? 'Payroll with deductions')
      setWithholdingRate(initial?.withholdingRate ?? '0')
      setApplyTax(initial?.applyEmployeeTax ?? false)
      setApplySS(initial?.applyEmployeeSocialSecurity ?? false)
    }
  }, [open, initial])

  const isValid = name.trim().length > 0 && defaultMemo.trim().length > 0
    && (withholdingRate === '' || (/^\d+(\.\d+)?$/.test(withholdingRate) && Number(withholdingRate) >= 0 && Number(withholdingRate) <= 1))

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'Edit Template' : 'New Template'} subtitle={initial?.name ?? 'Payment template configuration'}>
      <div className="space-y-5">
        <Field label="Name" error={name.trim().length === 0 ? 'Name is required' : undefined}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="US payroll deductions" maxLength={60} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md font-sans text-sm text-gray-900 focus:outline-none focus:border-blue-500" />
        </Field>
        <Field label="Default memo" error={defaultMemo.trim().length === 0 ? 'Memo is required' : undefined}>
          <input type="text" value={defaultMemo} onChange={(e) => setDefaultMemo(e.target.value)} placeholder="Payroll with deductions" maxLength={200} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md font-mono text-sm text-gray-900 focus:outline-none focus:border-blue-500" />
        </Field>

        <div className="border-t border-gray-200 pt-4">
          <p className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold mb-3">Global Deductions</p>
          <Field label="Withholding rate" hint="Decimal between 0 and 1 (e.g. 0.27 = 27%)" error={withholdingRate !== '' && !(/^\d+(\.\d+)?$/.test(withholdingRate) && Number(withholdingRate) >= 0 && Number(withholdingRate) <= 1) ? 'Invalid rate' : undefined}>
            <div className="flex items-center gap-2">
              <input type="text" inputMode="decimal" value={withholdingRate} onChange={(e) => setWithholdingRate(e.target.value)} placeholder="0" className="w-32 px-3 py-2 bg-white border border-gray-300 rounded-md font-mono text-sm text-gray-900 focus:outline-none focus:border-blue-500" />
              <span className="font-mono text-[11px] text-gray-400">= {(Number(withholdingRate) * 100).toFixed(2)}%</span>
            </div>
          </Field>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <p className="font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold mb-3">Individual Deductions</p>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} className="mt-1 cursor-pointer" />
              <div>
                <span className="text-sm text-gray-900 font-medium">Apply employee tax</span>
                <p className="text-xs text-gray-400 m-0 mt-0.5">Deduct tax amount from employee's record.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={applySS} onChange={(e) => setApplySS(e.target.checked)} className="mt-1 cursor-pointer" />
              <div>
                <span className="text-sm text-gray-900 font-medium">Apply employee social security</span>
                <p className="text-xs text-gray-400 m-0 mt-0.5">Deduct social security amount from employee's record.</p>
              </div>
            </label>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
        <button type="button" onClick={() => onSave({ name, withholdingRate, defaultMemo, applyTax, applySS })} disabled={!isValid || saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Template'}</button>
      </div>
    </Drawer>
  )
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[10px] tracking-wider2 text-gray-400 uppercase font-semibold mb-1">{label}</label>
      {children}
      {hint && !error && <p className="font-sans text-[11px] text-gray-400 m-0 mt-1 italic">{hint}</p>}
      {error && <p className="font-sans text-[11px] text-red-500 m-0 mt-1">{error}</p>}
    </div>
  )
}
