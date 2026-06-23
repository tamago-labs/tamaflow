import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { FileUp, FilePlus2 } from 'lucide-react'

/**
 * New Flow placeholder — two tabs:
 *   • Import CSV  — drop a payroll CSV and let the AI parse it
 *   • Create manually — add employees + amounts by hand
 *
 * Both tabs are inert for now; they're visible chrome for the next pass.
 */

type Tab = 'import' | 'manual'

export default function NewFlow() {
  const [tab, setTab] = useState<Tab>('import')

  return (
    <div>
      <PageHeader
        label="Workflow"
        title="New Flow"
        subtitle="Start a new payroll flow. The AI will review it, summarise, and surface anything unusual before you approve."
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-brand-border">
        {(['import', 'manual'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 py-2.5 px-4 border-0 bg-transparent cursor-pointer font-mono text-[11px] tracking-wider2 uppercase ${
              tab === t
                ? 'text-brand-navy font-semibold border-b-2 border-brand-blue'
                : 'text-brand-muted font-normal hover:text-brand-navy'
            }`}
          >
            {t === 'import' ? <FileUp size={12} /> : <FilePlus2 size={12} />}
            {t === 'import' ? 'Import CSV' : 'Create manually'}
          </button>
        ))}
      </div>

      {tab === 'import' ? (
        <div className="bg-white border border-brand-border rounded-md p-10 max-w-2xl">
          <div className="border-2 border-dashed border-brand-border rounded-md py-16 flex flex-col items-center justify-center text-center">
            <FileUp size={28} className="text-brand-muted mb-3" />
            <p className="font-sans text-sm text-brand-navy font-medium m-0 mb-1">
              Drop a payroll CSV here
            </p>
            <p className="font-sans text-xs text-brand-muted m-0 mb-4">
              or click to browse — employee, country, currency, amount
            </p>
            <button
              type="button"
              className="py-2 px-4 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
            >
              Choose File
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
          <p className="font-sans text-sm text-brand-muted m-0">
            Manual entry placeholder — the form for adding employees + amounts by hand
            will live here.
          </p>
        </div>
      )}
    </div>
  )
}
