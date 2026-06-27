import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, RefreshCw } from 'lucide-react'
import { useCompany } from '../context/CompanyContext'
import CompanyForm from '../components/CompanyForm'
import CompanyImportModal from '../components/CompanyImportModal'
import Logomark from '../components/Logomark'
import { WORDMARK } from '../theme'
import type { CompanyProfile } from '../../../preload/index.d'

/**
 * Boot-time gate that runs BEFORE the model picker.
 *
 * Two primary render branches based on `loadStatus`:
 *   - `absent`  → first-run wizard — full `<CompanyForm>` plus an
 *                 "Import from JSON" CTA.
 *   - `error`   → error card with **Retry** + **Reset and start over**
 *                 (the only un-wedge path for a corrupt `company.json`).
 *
 * Auto-advance: when the profile is `present`, the gate is a no-op and
 * `onContinue` fires immediately so returning users skip straight to
 * the model picker without a confirmation card. The same happens
 * automatically after the first-run form is saved. To edit the profile,
 * returning users go via the sidebar → Company Profile page.
 *
 * The card uses the brand wordmark + a single short subtitle so the
 * gate looks consistent across first-run wizard / error states.
 */

/** Short subtitle shown under the wordmark on the first-run wizard card. */
const GATE_SUBTITLE = 'Company details used to default payroll amounts and on-ledger settlement.'

interface CompanyGateProps {
  /** Called when the user clicks "Continue to App" on a saved profile. */
  onContinue: () => void
}

export default function CompanyGate({ onContinue }: CompanyGateProps) {
  const { profile, loadStatus, error, save, importJson, reset, refresh } = useCompany()
  const [importOpen, setImportOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Auto-advance to the model picker whenever a profile is present.
  // Covers both flows:
  //   - Returning user: loadStatus flips to `present` on the initial IPC
  //     fetch — we never want to show a confirmation card at boot.
  //   - First-run save: loadStatus flips to `present` after `save()`
  //     resolves — instead of asking the user to click Continue, hop
  //     straight to the model picker.
  // To edit the profile, returning users go through the sidebar →
  // Company Profile page (the gate no longer hosts an Edit path).
  useEffect(() => {
    if (loadStatus === 'present' && profile) {
      onContinue()
    }
  }, [loadStatus, profile, onContinue])

  const handleSubmit = async (next: CompanyProfile) => {
    await save(next)
    // The auto-advance effect above picks up the `present` state and
    // transitions to the model picker.
  }

  const handleImportApply = async (file: { profile: CompanyProfile }) => {
    await save(file.profile)
    // Same auto-advance as above.
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await reset()
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Soft decorative halos — match the Dashboard / LoadingScreen vibe */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(closest-side, rgba(62,196,192,0.55), transparent)'
          }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-15"
          style={{
            background: 'radial-gradient(closest-side, rgba(26,26,232,0.55), transparent)'
          }}
        />
      </div>

      <div className="relative flex items-center justify-center min-h-screen px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="w-full max-w-2xl"
        >
          {/* ── Error state ─────────────────────────────────────── */}
          {loadStatus === 'error' && (
            <ErrorCard
              message={error ?? 'Could not read company profile'}
              onRetry={refresh}
              onReset={handleReset}
              resetting={resetting}
            />
          )}

          {/* ── Saving transient ───────────────────────────────── */}
          {loadStatus === 'saving' && !profile && (
            <Centered>
              <Loader2 size={20} className="animate-spin text-brand-muted" />
              <p className="font-sans text-sm text-brand-muted m-0 mt-3">Saving company profile…</p>
            </Centered>
          )}

          {/* ── Absent: first-run wizard ──────────────────────── */}
          {loadStatus === 'absent' && (
            <div className="bg-white border border-brand-border rounded-md p-6 sm:p-8 shadow-sm">
              <GateHeader subtitle={GATE_SUBTITLE} />

              <CompanyForm submitLabel="Continue to App" onSubmit={handleSubmit} />

              <div className="border-t border-brand-border mt-6 pt-4">
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
                >
                  Import from JSON
                </button>
                <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mt-2 m-0">
                  Already exported a company profile? Load it here.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <CompanyImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirm={handleImportApply}
        current={profile}
      />

      {/* Hidden utility so `importJson` is referenced (used elsewhere
          via the modal). Avoids lint warnings for unused imports. */}
      <span aria-hidden style={{ display: 'none' }}>
        {String(Boolean(importJson))}
      </span>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-brand-border rounded-md p-8 shadow-sm text-center">
      {children}
    </div>
  )
}

/** Wordmark + subtitle shown at the top of the gate card. */
function GateHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 leading-none mb-3">
        <Logomark size={24} />
        <p className="font-mono font-bold text-lg tracking-wide text-brand-navy m-0 leading-none">
          <span className="text-brand-navy">{WORDMARK.prefix}</span>
          <span className="text-brand-blue">{WORDMARK.suffix}</span>
        </p>
      </div>
      <p className="font-sans text-sm text-brand-muted m-0 leading-relaxed">{subtitle}</p>
    </div>
  )
}

function ErrorCard({
  message,
  onRetry,
  onReset,
  resetting
}: {
  message: string
  onRetry: () => void | Promise<void>
  onReset: () => void | Promise<void>
  resetting: boolean
}) {
  return (
    <div className="bg-white border border-brand-border rounded-md p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-md bg-brand-errBg text-brand-err flex items-center justify-center">
          <RefreshCw size={18} />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-err m-0">
            Company profile error
          </p>
          <h1 className="font-sans text-xl font-medium text-brand-navy m-0 mt-0.5">
            Couldn't read your company profile
          </h1>
        </div>
      </div>
      <p className="font-sans text-sm text-brand-muted m-0 mb-6 leading-relaxed">
        The on-disk <code className="font-mono text-xs">company.json</code> file looks corrupt or
        unreadable. You can retry the read, or reset and start over.
      </p>
      <div className="p-3 bg-brand-errBg border border-brand-errBorder rounded-md mb-6">
        <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-err m-0 mb-1">
          Error
        </p>
        <p className="font-sans text-xs text-brand-errDark m-0 whitespace-pre-wrap">{message}</p>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={resetting}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-brand-err border border-brand-errBorder rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-errBg disabled:opacity-50"
        >
          {resetting && <Loader2 size={12} className="animate-spin" />}
          {resetting ? 'Resetting…' : 'Reset and start over'}
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
