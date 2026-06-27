import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Download, Upload, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import CompanyForm from '../components/CompanyForm'
import CompanyImportModal from '../components/CompanyImportModal'
import ConfirmDestroyCompanyModal from '../components/ConfirmDestroyCompanyModal'
import { useCompany } from '../context/CompanyContext'
import { COUNTRIES, countryLabel } from '../lib/countries'

/**
 * Outlet context shape — see MainLayout.tsx. `onCompanyDestroyed`
 * comes from App.tsx via the outlet chain and transitions the
 * AppState machine back to `'company'` after a successful destroy.
 */
interface CompanyProfileOutletContext {
  onChangeModel: () => void
  onCompanyDestroyed: () => void
}

/**
 * Dedicated Company Profile page — accessible from the sidebar footer
 * (which now shows the employer name + flag as a clickable block).
 *
 * Moved out of Settings to give it more breathing room and to make the
 * employer context a first-class surface rather than a hidden sub-tab.
 *
 * Layout mirrors the old Settings > Profile tab: header row with
 * eyebrow + summary on the left, Export / Import buttons on the right;
 * form (or empty state) below.
 */
export default function CompanyProfile() {
  const { onCompanyDestroyed } = useOutletContext<CompanyProfileOutletContext>()
  const [importOpen, setImportOpen] = useState(false)
  const [destroyOpen, setDestroyOpen] = useState(false)
  const {
    profile,
    loadStatus: companyStatus,
    save: saveCompany,
    exportJson,
    error: companyError,
    clearError: clearCompanyError
  } = useCompany()

  const countryDisplay = profile
    ? (() => {
        const c = COUNTRIES.find((x) => x.code === profile.country)
        return c ? `${c.flag} ${countryLabel(profile.country)}` : profile.country
      })()
    : null

  return (
    <div>
      <PageHeader
        label="Employer"
        title={profile ? profile.companyName : 'Company Profile'}
        subtitle={
          profile
            ? `${countryDisplay} · ${profile.baseCurrency}`
            : 'Company details used to default payroll amounts and on-ledger settlement.'
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                void exportJson()
              }}
              disabled={!profile}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={12} />
              Export
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
            >
              <Upload size={12} />
              Import
            </button>
          </>
        }
      />

      <div className="max-w-2xl">
        <div className="bg-white border border-brand-border rounded-md p-6">
          {companyStatus === 'present' && profile ? (
            <>
              {companyError && (
                <div className="p-3 mb-4 bg-brand-errBg border border-brand-errBorder rounded-md">
                  <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-err m-0 mb-1">
                    Save failed
                  </p>
                  <p className="font-sans text-xs text-brand-errDark m-0 whitespace-pre-wrap">
                    {companyError}
                  </p>
                  <button
                    type="button"
                    onClick={clearCompanyError}
                    className="mt-2 px-2 py-1 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <CompanyForm
                initial={profile}
                submitLabel="Save"
                submitting={false}
                onSubmit={async (next) => {
                  await saveCompany(next)
                }}
              />
            </>
          ) : companyStatus === 'absent' ? (
            <div>
              <p className="font-sans text-sm text-brand-navy m-0 mb-3">
                No company profile set yet.
              </p>
              <p className="font-sans text-xs text-brand-muted m-0 mb-4 leading-relaxed">
                You can import a previously exported company profile (JSON), or set one up from the
                boot screen by restarting the app with{' '}
                <code className="font-mono text-xs">company.json</code> removed.
              </p>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
              >
                <Upload size={12} />
                Import from JSON
              </button>
            </div>
          ) : (
            <p className="font-sans text-sm text-brand-muted m-0">Loading company profile…</p>
          )}
        </div>

        {/* Destroy Company — destructive action lives below the card
            so it can't be tapped accidentally. Only shown when a profile
            exists. Opens a type-to-confirm modal (irreversible). */}
        {companyStatus === 'present' && profile && (
          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setDestroyOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-brand-err border border-brand-errBorder rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-errBg"
            >
              <Trash2 size={12} />
              Destroy Company
            </button>
          </div>
        )}

        <CompanyImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onConfirm={async (parsed) => {
            await saveCompany(parsed.profile)
          }}
          current={profile}
        />

        <ConfirmDestroyCompanyModal
          open={destroyOpen}
          onClose={() => setDestroyOpen(false)}
          onDestroyed={onCompanyDestroyed}
        />
      </div>
    </div>
  )
}
