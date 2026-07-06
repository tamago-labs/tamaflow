import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Download, Upload, Trash2, Building2, Database } from 'lucide-react'
import type { ReactNode } from 'react'
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
 * Dedicated Company Profile page — accessible from the sidebar footer.
 *
 * Layout mirrors Settings: page header (eyebrow + title + subtitle),
 * then a sub-tab strip, then the body card.
 *
 *   - **Profile**   — the employer business profile (CompanyForm).
 *                     Fields: name, jurisdiction, base currency,
 *                     legal entity type, fiscal year start.
 *   - **Data**      — backup lifecycle. Export and Import live in a
 *                     "Backup" section; Destroy Company lives in a
 *                     clearly marked "Danger zone" so it can't be
 *                     tapped accidentally.
 */
type Tab = 'profile' | 'data'

interface TabDef {
  key: Tab
  label: string
  icon: ReactNode
}

const TABS: TabDef[] = [
  { key: 'profile', label: 'Profile', icon: <Building2 size={12} /> },
  { key: 'data', label: 'Data', icon: <Database size={12} /> }
]

export default function CompanyProfile() {
  const { onCompanyDestroyed } = useOutletContext<CompanyProfileOutletContext>()
  const [tab, setTab] = useState<Tab>('profile')
  const [importOpen, setImportOpen] = useState(false)
  const [destroyOpen, setDestroyOpen] = useState(false)
  const {
    profile,
    loadStatus: companyStatus,
    save: saveCompany,
    exportJson
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
            : 'Manage your employer profile and on-ledger settings.'
        }
      />

      {/* Sub-tabs — same shape as Settings */}
      <div className="flex items-center gap-1 mb-6 border-b border-brand-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 py-2.5 px-4 border-0 bg-transparent cursor-pointer font-mono text-[11px] tracking-wider2 uppercase ${
              tab === t.key
                ? 'text-brand-navy font-semibold border-b-2 border-brand-blue'
                : 'text-brand-muted font-normal hover:text-brand-navy'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">
        {tab === 'profile' && (
          <ProfileTab
            companyStatus={companyStatus}
            profile={profile}
            saveCompany={saveCompany}
          />
        )}

        {tab === 'data' && (
          <DataTab
            profile={profile}
            onImport={() => setImportOpen(true)}
            onDestroy={() => setDestroyOpen(true)}
            onExport={() => {
              void exportJson()
            }}
          />
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

/* -------------------------------------------------------------------------- */
/* Profile tab                                                                  */
/* -------------------------------------------------------------------------- */

function ProfileTab({
  companyStatus,
  profile,
  saveCompany
}: {
  companyStatus: ReturnType<typeof useCompany>['loadStatus']
  profile: ReturnType<typeof useCompany>['profile']
  saveCompany: ReturnType<typeof useCompany>['save']
}) {
  if (companyStatus === 'absent') {
    return (
      <div className="bg-white border border-brand-border rounded-md p-6">
        <p className="font-sans text-sm text-brand-navy m-0 mb-3">
          No company profile set yet.
        </p>
        <p className="font-sans text-xs text-brand-muted m-0 mb-4 leading-relaxed">
          You can import a previously exported company profile (JSON), or set one up from the
          boot screen by restarting the app with{' '}
          <code className="font-mono text-xs">company.json</code> removed.
        </p>
        <p className="font-sans text-xs text-brand-muted m-0 italic">
          Use the <strong>Data</strong> tab to load a backup file.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-brand-border rounded-md p-6">
      {companyStatus === 'present' && profile ? (
        <CompanyForm
          initial={profile}
          submitLabel="Save"
          submitting={false}
          onSubmit={async (next) => {
            await saveCompany(next)
          }}
        />
      ) : (
        <p className="font-sans text-sm text-brand-muted m-0">Loading company profile…</p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Data tab — backup lifecycle (export / import / destroy)                     */
/* -------------------------------------------------------------------------- */

function DataTab({
  profile,
  onExport,
  onImport,
  onDestroy
}: {
  profile: ReturnType<typeof useCompany>['profile']
  onExport: () => void
  onImport: () => void
  onDestroy: () => void
}) {
  const hasProfile = !!profile
  return (
    <div className="space-y-4">
      {/* Backup — non-destructive. Export to share / archive, Import to
          restore from a previous export. Both gates are guarded so the
          user can never get into an inconsistent state. */}
      <section className="bg-white border border-brand-border rounded-md p-6">
        <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-1 m-0">
          Backup
        </p>
        <h2 className="font-sans text-base font-medium text-brand-navy m-0 mb-2">
          Export &amp; import
        </h2>
        <p className="font-sans text-xs text-brand-muted m-0 mb-4 leading-relaxed">
          Save your company profile as a JSON file you can re-import later, share with a
          co-admin, or keep as an off-machine backup.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onExport}
            disabled={!hasProfile}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={12} />
            Export to JSON
          </button>
          <button
            type="button"
            onClick={onImport}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
          >
            <Upload size={12} />
            Import from backup file
          </button>
        </div>
      </section>

      {/* Danger zone — destructive. Visually distinct (red accent) and
          physically separated from the backup section so it can't be
          tapped accidentally. Opens a type-to-confirm modal. */}
      <section className="bg-white border border-brand-errBorder rounded-md p-6">
        <p className="font-mono text-[10px] tracking-wider2 text-brand-err uppercase mb-1 m-0">
          Danger zone
        </p>
        <h2 className="font-sans text-base font-medium text-brand-navy m-0 mb-2">
          Destroy company profile
        </h2>
        <p className="font-sans text-xs text-brand-muted m-0 mb-4 leading-relaxed">
          Permanently deletes the on-disk{' '}
          <code className="font-mono text-[11px]">company.json</code>. You'll be routed back
          to the first-run wizard to set up a new profile. This cannot be undone — export a
          backup first if you might want to restore later.
        </p>
        <button
          type="button"
          onClick={onDestroy}
          disabled={!hasProfile}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-brand-err border border-brand-errBorder rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-errBg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={12} />
          Destroy Company
        </button>
      </section>
    </div>
  )
}

