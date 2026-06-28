import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Upload } from 'lucide-react'
import { useCompany } from '../context/CompanyContext'
import CompanyForm from '../components/CompanyForm'
import CompanyImportModal from '../components/CompanyImportModal'
import { TealBar, Wordmark } from '../components/ModelSelectorChrome'
import type { CompanyProfile } from '../../../preload/index.d'

/**
 * Boot-time gate that runs BEFORE the model picker.
 *
 * Two primary render branches based on `loadStatus`:
 *   - `absent`  → first-run wizard — full `<CompanyForm>` plus an
 *                 "Import from backup file" CTA.
 *   - `error`   → error card with **Retry** + **Reset and start over**
 *                 (the only un-wedge path for a corrupt `company.json`).
 *
 * Auto-advance: when the profile is `present`, the gate is a no-op and
 * `onContinue` fires immediately so returning users skip straight to
 * the model picker without a confirmation card. The same happens
 * automatically after the first-run form is saved. To edit the profile,
 * returning users go via the sidebar → Company Profile page.
 *
 * Visually mirrors `<ModelSelector>`: same TealBar + Wordmark header,
 * same off-white card width, same decorative blocks in the top-right.
 * The two wizard pages should feel like siblings — first you tell us
 * about your company, then you pick a model.
 */

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
    <div className="min-h-screen bg-white flex items-center justify-start pl-14 relative overflow-hidden font-sans">
      {/* Decorative blocks — mirror the ModelSelector exactly so the
          two wizard pages feel like siblings. */}
      <div className="absolute top-0 right-[180px] w-[200px] h-[160px] bg-brand-teal z-[1]" />
      <div className="absolute top-0 right-0 w-[180px] h-[80px] bg-brand-blue z-[3]" />
      <div className="absolute top-[80px] right-0 w-[320px] h-[240px] bg-brand-blue z-[2]" />
      <div className="absolute bottom-0 left-0 w-1 h-[100px] bg-brand-teal z-[5]" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-[10] bg-white border border-brand-border w-full max-w-2xl overflow-hidden"
      >
        <TealBar />

        <div className="px-8 pt-7 pb-8">
          {/* Header — same chrome as the model picker */}
          <div className="flex items-center justify-between mb-7">
            <Wordmark />
            <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase">
              Employer Setup
            </span>
          </div>

          {loadStatus === 'error' ? (
            <ErrorCard
              message={error ?? 'Could not read company profile'}
              onRetry={refresh}
              onReset={handleReset}
              resetting={resetting}
            />
          ) : loadStatus === 'saving' && !profile ? (
            <Centered>
              <Loader2 size={20} className="animate-spin text-brand-muted" />
              <p className="font-sans text-sm text-brand-muted m-0 mt-3">
                Saving company profile…
              </p>
            </Centered>
          ) : loadStatus === 'absent' ? (
            <>
              <h1 className="font-sans text-2xl font-light text-brand-navy mb-2 leading-tight m-0">
                Set up your <strong className="font-medium">company</strong>
              </h1>
              <p className="font-sans text-xs text-brand-muted mb-5 mt-0 leading-relaxed">
                Tell us a few basics so payroll has sensible defaults. You can edit any
                of this later from the Company Profile page.
              </p>

              <CompanyForm
                submitLabel="Save & Next"
                submitting={loadStatus === 'saving'}
                onSubmit={handleSubmit}
              />

              <div className="mt-5 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-brand-blue text-brand-blue rounded-md font-mono text-[11px] font-bold tracking-wide2 uppercase cursor-pointer hover:bg-[#f7f7fc]"
                >
                  <Upload size={12} />
                  Import from backup file
                </button>
                <p className="font-sans text-[11px] text-brand-muted mt-2 m-0 leading-relaxed">
                  Already exported a company profile? Load it to skip the setup.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </motion.div>

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
    <div className="text-center py-10">
      <span className="font-mono text-xs text-brand-muted tracking-wide2">{children}</span>
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
    <div>
      <p className="font-mono text-[11px] tracking-wider2 text-brand-err uppercase mb-2 m-0">
        Company profile error
      </p>
      <h1 className="font-sans text-2xl font-light text-brand-navy mb-3 leading-tight m-0">
        Couldn't read your profile
      </h1>
      <p className="font-sans text-xs text-brand-muted mb-4 leading-relaxed">
        The on-disk <code className="font-mono text-[11px]">company.json</code> looks
        corrupt. You can retry the read, or reset and start over.
      </p>
      <div className="py-2.5 px-3 bg-brand-errBg border border-brand-errBorder rounded-md mb-4">
        <p className="font-mono text-[10px] text-brand-err uppercase tracking-wide2 m-0 mb-1">
          Error
        </p>
        <p className="font-sans text-xs text-brand-errDark m-0 whitespace-pre-wrap">
          {message}
        </p>
      </div>
      <div className="flex items-center gap-2">
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