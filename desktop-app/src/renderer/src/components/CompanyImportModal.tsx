import { useEffect, useState } from 'react'
import { Loader2, FileJson, CheckCircle2 } from 'lucide-react'
import WalletModal from './WalletModal'
import { useCompany } from '../context/CompanyContext'
import {
  COUNTRIES,
  countryLabel,
  currencyLabel,
  legalEntityLabel
} from '../lib/countries'
import type { CompanyFile, CompanyProfile } from '../../../preload/index.d'

/**
 * Modal that handles the JSON import flow for a company profile.
 *
 * Lifecycle when `open` flips to true:
 *   1. Immediately calls `importJson()` — main process opens the OS
 *      file picker, parses the JSON, and validates against the
 *      closed allowlists.
 *   2. Three outcomes:
 *      - **canceled** → close silently.
 *      - **success** → render a preview summary of the parsed
 *        `CompanyFile`. Two actions: **Cancel** (discards) and
 *        **Apply Import** (calls `onConfirm`, which in turn calls
 *        `save`).
 *      - **error** → render the error message + **Try a different
 *        file** (re-runs `importJson`) and **Cancel**.
 *
 * If `current` is passed, the preview shows a per-field diff vs the
 * existing profile so the user sees what's about to change.
 *
 * The "stopPropagation on card click" gotcha from MEMORY.md is already
 * handled inside `WalletModal` (no extra wiring here).
 */

interface CompanyImportModalProps {
  open: boolean
  onClose: () => void
  /** Called with the parsed file when the user clicks Apply Import. */
  onConfirm: (file: CompanyFile) => Promise<void> | void
  /** Existing profile for diff display. Omit on first-run import. */
  current?: CompanyProfile | null
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'picking' }
  | { kind: 'preview'; file: CompanyFile }
  | { kind: 'error'; message: string }

export default function CompanyImportModal({
  open,
  onClose,
  onConfirm,
  current
}: CompanyImportModalProps) {
  const { importJson } = useCompany()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [applying, setApplying] = useState(false)

  // Drive the import whenever the modal opens.
  useEffect(() => {
    if (!open) {
      // Reset transient state when the modal closes.
      setPhase({ kind: 'idle' })
      setApplying(false)
      return
    }
    let cancelled = false
    setPhase({ kind: 'picking' })
    ;(async () => {
      try {
        const file = await importJson()
        if (cancelled) return
        if (file) setPhase({ kind: 'preview', file })
        else onClose()
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setPhase({ kind: 'error', message: msg })
      }
    })()
    return () => {
      cancelled = true
    }
    // importJson identity is stable per CompanyProvider mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleTryDifferent = async () => {
    setPhase({ kind: 'picking' })
    try {
      const file = await importJson()
      if (file) setPhase({ kind: 'preview', file })
      else onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setPhase({ kind: 'error', message: msg })
    }
  }

  const handleApply = async () => {
    if (phase.kind !== 'preview') return
    setApplying(true)
    try {
      await onConfirm(phase.file)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setPhase({ kind: 'error', message: msg })
    } finally {
      setApplying(false)
    }
  }

  return (
    <WalletModal
      open={open}
      onClose={onClose}
      title="Import Company Profile"
      subtitle="From a JSON file"
      maxWidth="max-w-lg"
    >
      {/* Picking state */}
      {phase.kind === 'idle' || phase.kind === 'picking' ? (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 size={16} className="animate-spin text-brand-muted" />
          <p className="font-sans text-sm text-brand-muted m-0">
            Choose a file in the system dialog…
          </p>
        </div>
      ) : null}

      {/* Preview state */}
      {phase.kind === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2">
            <FileJson size={16} className="text-brand-blue" />
            <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted m-0">
              Parsed successfully · review and apply
            </p>
          </div>
          <PreviewRows profile={phase.file.profile} current={current} />

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50"
            >
              {applying && <Loader2 size={12} className="animate-spin" />}
              {applying ? 'Applying…' : 'Apply Import'}
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {phase.kind === 'error' && (
        <div className="space-y-4">
          <div className="p-3 bg-brand-errBg border border-brand-errBorder rounded-md">
            <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-err m-0 mb-1">
              Could not import
            </p>
            <p className="font-sans text-xs text-brand-errDark m-0 whitespace-pre-wrap">
              {phase.message}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTryDifferent}
              className="px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
            >
              Try a different file
            </button>
          </div>
        </div>
      )}
    </WalletModal>
  )
}

function PreviewRows({
  profile,
  current
}: {
  profile: CompanyProfile
  current?: CompanyProfile | null
}) {
  const country = COUNTRIES.find((c) => c.code === profile.country)
  const countryDisplay = country ? `${country.flag} ${country.label}` : profile.country

  return (
    <dl className="divide-y divide-brand-border border border-brand-border rounded-md overflow-hidden">
      <Row label="Company name" value={profile.companyName} current={current?.companyName} />
      <Row
        label="Country"
        value={countryDisplay}
        current={current ? countryLabelFor(current.country) : undefined}
      />
      <Row
        label="Base currency"
        value={currencyLabel(profile.baseCurrency)}
        current={current ? currencyLabel(current.baseCurrency) : undefined}
      />
      <Row
        label="Legal entity"
        value={legalEntityLabel(profile.legalEntityType)}
        current={current ? legalEntityLabel(current.legalEntityType) : undefined}
      />
      <Row
        label="Settlement"
        value="Canton Coin (CC)"
        current={current ? 'Canton Coin (CC)' : undefined}
      />
    </dl>
  )
}

function Row({ label, value, current }: { label: string; value: string; current?: string }) {
  const changed = current !== undefined && current !== value
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 px-3 py-2.5 bg-white">
      <dt className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold self-center">
        {label}
      </dt>
      <dd className="m-0 flex flex-col">
        <span
          className={`font-sans text-sm ${changed ? 'text-brand-blue font-medium' : 'text-brand-navy'}`}
        >
          {value}
        </span>
        {changed && (
          <span className="font-sans text-xs text-brand-muted mt-0.5 inline-flex items-center gap-1">
            <CheckCircle2 size={10} className="text-brand-blue" />
            was: <span className="line-through">{current}</span>
          </span>
        )}
      </dd>
    </div>
  )
}

function countryLabelFor(code: CompanyProfile['country']): string {
  return countryLabel(code)
}
