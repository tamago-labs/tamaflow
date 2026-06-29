// Settings → Payment Templates tab.
//
// User-defined payment templates. Each becomes a palette tile on the
// flow canvas (alongside the built-in Direct Payment, which is NOT
// editable here — it's always present, no deductions).
//
// Layout (single content card):
//
//   ┌─ Payment Templates ────────────────────────────────────────┐
//   │  Direct Payment (built-in)                                  │
//   │  ┌──────────────────────────────────────────────────────┐  │
//   │  │ Direct Payment                                        │  │
//   │  │ No deductions. You set the memo per card.            │  │
//   │  │ [always available]                                   │  │
//   │  └──────────────────────────────────────────────────────┘  │
//   │                                                            │
//   │  Custom templates                                          │
//   │  ┌──────────────────────────────────────────────────────┐  │
//   │  │ Withholding 22% (US payroll)        [edit] [delete]  │  │
//   │  │ 22% WHT · 5% SS · memo "March payroll"                │  │
//   │  ├──────────────────────────────────────────────────────┤  │
//   │  │ Bonus                                              …  │  │
//   │  │ no deductions · memo "Bonus"                          │  │
//   │  └──────────────────────────────────────────────────────┘  │
//   │  [+ New template]                                          │
//   └────────────────────────────────────────────────────────────┘
//
// State:
//   - Local `drafts` mirrored from `profile.paymentTemplates` on load
//     + on profile change.
//   - `id?: string` field — undefined = unsaved new row.
//   - Edit mode toggled per row; new rows start in edit mode.
//   - "Save all" writes the whole list at once via `useCompany().save`.
//   - Delete per row with confirmation (per user-confirmed "fall back"
//     behaviour — canvas cards using a deleted template fall back to
//     Direct Payment).
//
// Deductions (withholding, social security) live on the linked template
// (Settings → Payment templates). The flow's card composition is
// authoritative: whatever rates the user wires to a Payee card are
// applied — there is no country-based skip rule.

import { useEffect, useState } from 'react'
import { Check, X, Layers, Pencil, Trash2 } from 'lucide-react'
import { useCompany } from '../../context/CompanyContext'
import type { CompanyProfile, PaymentTemplate } from '../../../../preload/index.d'
import { paymentTemplateSubtitle } from '../../data/flowCards'

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
  socialSecurityRate: string
  defaultMemo: string
  createdAt?: string
  updatedAt?: string
}

/** Convert a saved `PaymentTemplate` into an editable draft. */
function toDraft(t: PaymentTemplate): DraftPaymentTemplate {
  return {
    id: t.id,
    name: t.name,
    withholdingRate: t.withholdingRate,
    socialSecurityRate: t.socialSecurityRate,
    defaultMemo: t.defaultMemo,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

/** Convert a draft back to the persisted `PaymentTemplate` shape. */
function fromDraft(d: DraftPaymentTemplate, now: string): PaymentTemplate {
  return {
    id: d.id ?? 'tpl_pending',
    name: d.name.trim(),
    withholdingRate: d.withholdingRate.trim(),
    socialSecurityRate: d.socialSecurityRate.trim(),
    defaultMemo: d.defaultMemo.trim(),
    createdAt: d.createdAt ?? now,
    updatedAt: now,
  }
}

/** Validate one draft row. Returns null when valid, or a per-field
 *  error object. The save button is disabled while any row has
 *  errors. */
function validateRow(d: DraftPaymentTemplate): {
  name?: string
  withholdingRate?: string
  socialSecurityRate?: string
  defaultMemo?: string
} {
  const errors: {
    name?: string
    withholdingRate?: string
    socialSecurityRate?: string
    defaultMemo?: string
  } = {}
  if (d.name.trim().length === 0) errors.name = 'Name is required'
  else if (d.name.trim().length > 60)
    errors.name = 'Name must be 60 characters or fewer'
  if (!isValidRate(d.withholdingRate))
    errors.withholdingRate = 'Decimal between 0 and 1, or blank'
  if (!isValidRate(d.socialSecurityRate))
    errors.socialSecurityRate = 'Decimal between 0 and 1, or blank'
  if (d.defaultMemo.trim().length === 0)
    errors.defaultMemo = 'Default memo is required'
  else if (d.defaultMemo.trim().length > 200)
    errors.defaultMemo = 'Memo must be 200 characters or fewer'
  return errors
}

export default function PaymentTemplatesTab() {
  const { profile, save } = useCompany()

  const [drafts, setDrafts] = useState<DraftPaymentTemplate[]>(() =>
    (profile?.paymentTemplates ?? []).map(toDraft),
  )
  const [editing, setEditing] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Re-sync drafts when the profile reloads (e.g. after an import). Only
  // fires when the user isn't actively saving — we don't want a remote
  // update to clobber their in-progress edits.
  useEffect(() => {
    if (!profile) return
    if (saving) return
    setDrafts(profile.paymentTemplates.map(toDraft))
    // Newly-loaded profile → no rows should be in edit mode.
    setEditing(new Set())
  }, [profile, saving])

  if (!profile) {
    return (
      <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
        <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-3 m-0">
          Payment Templates
        </p>
        <p className="font-sans text-sm text-brand-muted m-0">
          Set up a company profile first to configure payment templates.
        </p>
      </div>
    )
  }

  // ─── Per-row helpers ───────────────────────────────────────────

  function startEdit(id: string) {
    setEditing((s) => new Set([...s, id]))
  }

  function cancelEdit(id: string) {
    // For an unsaved new row, drop the draft entirely. For an existing
    // row, revert to the saved value.
    setDrafts((current) => {
      const row = current.find((d) => (d.id ?? '__new__') === id)
      if (!row) return current
      if (!row.id) return current.filter((d) => (d.id ?? '__new__') !== id)
      const saved = profile!.paymentTemplates.find((t) => t.id === row.id)
      return saved
        ? current.map((d) => (d.id === row.id ? toDraft(saved) : d))
        : current.filter((d) => d.id !== row.id)
    })
    setEditing((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
  }

  function updateDraft(id: string, patch: Partial<DraftPaymentTemplate>) {
    setDrafts((current) =>
      current.map((d) => ((d.id ?? '__new__') === id ? { ...d, ...patch } : d)),
    )
  }

  function deleteRow(id: string) {
    if (!id) return
    const tpl = profile!.paymentTemplates.find((t) => t.id === id)
    if (!tpl) return
    const ok = window.confirm(
      `Delete template "${tpl.name}"? Canvas cards using it will fall back to Direct Payment.`,
    )
    if (!ok) return
    setDrafts((current) => current.filter((d) => d.id !== id))
  }

  function addRow() {
    // Append an unsaved stub in edit mode. `id` undefined → server-side
    // fresh id will be assigned in `normalizePaymentTemplates`.
    const stubKey = '__new__' + Date.now().toString(36)
    setDrafts((current) => [
      ...current,
      {
        name: '',
        withholdingRate: '',
        socialSecurityRate: '',
        defaultMemo: 'Payroll',
      },
    ])
    setEditing((s) => new Set([...s, stubKey]))
    // Note: drafts array has no id yet, so we can't address it by id
    // for editing — we rely on the LAST row in the list being the
    // newly-added stub while it's in edit mode.
  }

  // ─── Save all ──────────────────────────────────────────────────

  const allValid = drafts.every((d) => Object.keys(validateRow(d)).length === 0)
  const anyInEdit = editing.size > 0
  // The profile is dirty when at least one draft has unsaved changes
  // (in edit mode with valid values).
  const dirty = anyInEdit && allValid

  async function handleSaveAll() {
    if (!profile) return
    if (!dirty) return
    setSaving(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      const next: CompanyProfile = {
        ...profile,
        paymentTemplates: drafts.map((d) => fromDraft(d, now)),
      }
      await save(next)
      setSavedAt(Date.now())
      setEditing(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    if (!profile) return
    setDrafts(profile.paymentTemplates.map(toDraft))
    setEditing(new Set())
    setError(null)
  }

  const canSave = dirty && !saving

  return (
    <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <Layers size={12} className="text-brand-blue" />
        <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
          Payment Templates
        </p>
      </div>
      <p className="font-sans text-sm text-brand-muted m-0 mb-5">
        Each template becomes its own palette tile on the flow canvas.
        Direct Payment is built-in and always available — you cannot
        remove it.
      </p>

      {/* Direct Payment (built-in) — always present, not editable. */}
      <div className="space-y-2 mb-6">
        <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
          Built-in
        </p>
        <div
          className="bg-brand-light border border-brand-border rounded-md p-3 flex items-start gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="font-sans text-sm font-semibold text-brand-navy m-0">
              Direct Payment
            </div>
            <div className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mt-0.5">
              No deductions · built-in card
            </div>
            <p className="font-sans text-xs text-brand-muted m-0 mt-1">
              No withholding or social security applied. You set the memo
              per card on the canvas.
            </p>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider2 text-brand-muted whitespace-nowrap">
            Always available
          </span>
        </div>
      </div>

      {/* Custom templates */}
      <div className="space-y-2">
        <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
          Custom templates
        </p>

        {drafts.length === 0 ? (
          <div
            className="font-sans text-xs italic text-brand-muted p-4 border border-dashed border-brand-border rounded-md text-center"
          >
            No custom templates yet. Click "+ New template" to add one.
          </div>
        ) : (
          <div className="space-y-2">
            {drafts.map((d, idx) => {
              // Use the actual id when available; otherwise fall back
              // to a position-based key for newly-added rows (their
              // `id` is undefined until the server stamps one on save).
              const key = d.id ?? `__new_${idx}`
              const isEditing = editing.has(key)
              const errors = validateRow(d)
              const hasErrors = Object.keys(errors).length > 0
              return (
                <TemplateRow
                  key={key}
                  draft={d}
                  isEditing={isEditing}
                  errors={errors}
                  hasErrors={hasErrors}
                  onStartEdit={() => startEdit(key)}
                  onCancelEdit={() => cancelEdit(key)}
                  onChange={(patch) => updateDraft(key, patch)}
                  onDelete={() => deleteRow(d.id!)}
                />
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={addRow}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 mt-2 bg-white text-brand-blue border border-dashed border-brand-blue rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-brand-light disabled:opacity-50"
        >
          + New template
        </button>
      </div>

      {/* Save row */}
      <div className="flex items-center gap-2 pt-5 mt-5 border-t border-brand-border">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={!canSave}
          className={`flex items-center gap-1.5 px-4 py-2 border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase ${
            canSave
              ? 'bg-brand-blue text-white cursor-pointer hover:opacity-90'
              : 'bg-brand-light text-brand-muted cursor-not-allowed'
          }`}
        >
          <Check size={12} />
          {saving ? 'Saving…' : 'Save all'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!dirty || saving}
          className={`flex items-center gap-1.5 px-4 py-2 bg-white border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase ${
            dirty && !saving
              ? 'text-brand-navy cursor-pointer hover:bg-brand-light'
              : 'text-brand-muted cursor-not-allowed'
          }`}
        >
          <X size={12} />
          Discard
        </button>
        {savedAt && !error && !dirty && (
          <span className="font-mono text-[10px] uppercase tracking-wider2 text-brand-tealAccent">
            Saved
          </span>
        )}
        {error && (
          <span className="font-mono text-[10px] uppercase tracking-wider2 text-brand-err">
            {error}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Per-row component ─────────────────────────────────────────

interface TemplateRowProps {
  draft: DraftPaymentTemplate
  isEditing: boolean
  errors: ReturnType<typeof validateRow>
  hasErrors: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onChange: (patch: Partial<DraftPaymentTemplate>) => void
  onDelete: () => void
}

function TemplateRow({
  draft,
  isEditing,
  errors,
  hasErrors: _hasErrors,
  onStartEdit,
  onCancelEdit,
  onChange,
  onDelete,
}: TemplateRowProps) {
  // Display-mode summary line — uses the shared subtitle helper so the
  // settings list matches the palette tile preview byte-for-byte.
  const subtitle = (() => {
    const t: PaymentTemplate = {
      id: draft.id ?? 'pending',
      name: draft.name,
      withholdingRate: draft.withholdingRate,
      socialSecurityRate: draft.socialSecurityRate,
      defaultMemo: draft.defaultMemo,
      createdAt: draft.createdAt ?? '',
      updatedAt: draft.updatedAt ?? '',
    }
    return paymentTemplateSubtitle(t)
  })()

  if (!isEditing) {
    return (
      <div className="bg-white border border-brand-border rounded-md p-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-sans text-sm font-semibold text-brand-navy m-0 truncate">
            {draft.name || <em className="text-brand-muted">Untitled</em>}
          </div>
          <div className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mt-0.5 truncate">
            {subtitle}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onStartEdit}
            className="flex items-center gap-1 px-2 py-1 bg-white text-brand-navy border border-brand-border rounded font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-brand-light"
          >
            <Pencil size={10} />
            edit
          </button>
          {draft.id && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1 bg-white text-brand-err border border-brand-errBorder rounded font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-brand-errBg"
            >
              <Trash2 size={10} />
              delete
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-brand-blue rounded-md p-3 space-y-3">
      <Field label="Name" error={errors.name}>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Withholding 22% (US payroll)"
          maxLength={60}
          className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy focus:outline-none focus:border-brand-blue"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Withholding rate"
          hint="Decimal between 0 and 1. Blank = no withholding."
          error={errors.withholdingRate}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={draft.withholdingRate}
              onChange={(e) => onChange({ withholdingRate: e.target.value })}
              placeholder="0.22"
              className="w-32 px-3 py-2 bg-white border border-brand-border rounded-md font-mono text-sm text-brand-navy focus:outline-none focus:border-brand-blue"
            />
            <span className="font-mono text-[11px] text-brand-muted uppercase tracking-wider2">
              = {(Number(draft.withholdingRate) * 100).toFixed(2)}%
            </span>
          </div>
        </Field>

        <Field
          label="Social security rate"
          hint="Decimal between 0 and 1. Blank = no social security."
          error={errors.socialSecurityRate}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={draft.socialSecurityRate}
              onChange={(e) => onChange({ socialSecurityRate: e.target.value })}
              placeholder="0.05"
              className="w-32 px-3 py-2 bg-white border border-brand-border rounded-md font-mono text-sm text-brand-navy focus:outline-none focus:border-brand-blue"
            />
            <span className="font-mono text-[11px] text-brand-muted uppercase tracking-wider2">
              = {(Number(draft.socialSecurityRate) * 100).toFixed(2)}%
            </span>
          </div>
        </Field>
      </div>

      <Field label="Default memo" error={errors.defaultMemo}>
        <input
          type="text"
          value={draft.defaultMemo}
          onChange={(e) => onChange({ defaultMemo: e.target.value })}
          placeholder="March payroll"
          maxLength={200}
          className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-mono text-sm text-brand-navy focus:outline-none focus:border-brand-blue"
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-border">
        <button
          type="button"
          onClick={onCancelEdit}
          className="px-3 py-1.5 bg-white text-brand-navy border border-brand-border rounded font-mono text-[10px] font-bold tracking-wider2 uppercase hover:bg-brand-light"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0 mb-1">
        {label}
      </p>
      {children}
      {hint && !error && (
        <p className="font-sans text-[11px] text-brand-muted m-0 mt-1 italic">
          {hint}
        </p>
      )}
      {error && (
        <p className="font-sans text-[11px] text-brand-err m-0 mt-1">{error}</p>
      )}
    </div>
  )
}