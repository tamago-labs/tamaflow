// Settings — sub-tabs:
//   • Wallet   — Connect / inspect / export / destroy the Canton wallet
//   • AI Model — active model + Change / Unload / Delete Cache
//
// The Payment Templates tab from the old version is dropped —
// Tamaflow has no flow templates yet. The Canton holdings / faucet /
// transfer surface from the old Settings > Wallet tab is also
// dropped (the payroll flow system is gone). The Wallet tab is
// reduced to the lifecycle (status + create + export + destroy).

import { useState, useEffect } from 'react'
import { Cpu, Wallet, Power, KeyRound, Trash2, Building2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAI } from '../../hooks/useAI'
import { useWallet } from '../../context/WalletContext'
import { bridge } from '../../lib/bridge'
import type { CompanyProfile, CompanyFile } from '../../ai/types'
import { PageHeader } from '../PageHeader'
import CompanyForm from '../CompanyForm'

type Tab = 'wallet' | 'ai' | 'company'

interface TabDef {
  key: Tab
  label: string
  icon: ReactNode
}

const TABS: TabDef[] = [
  { key: 'wallet', label: 'Wallet', icon: <Wallet size={12} /> },
  { key: 'ai', label: 'AI Model', icon: <Cpu size={12} /> },
  { key: 'company', label: 'Company', icon: <Building2 size={12} /> }
]

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('wallet')
  const { activeModel, unload, resetCache, setError } = useAI()
  const { status, openSetup, openAccountInfo, openExportKey, openDestroy } =
    useWallet()

  const [companyFile, setCompanyFile] = useState<CompanyFile | null>(null)
  const [companySaving, setCompanySaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    bridge.company.get().then((file) => {
      if (!cancelled) setCompanyFile(file)
    })
    const unsub = bridge.company.onChange((file) => {
      if (!cancelled) setCompanyFile(file)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const handleCompanySave = async (profile: CompanyProfile) => {
    setCompanySaving(true)
    try {
      await bridge.company.save(profile)
    } finally {
      setCompanySaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        label='Account'
        title='Settings'
        subtitle='Configure your Canton wallet and local AI model.'
      />

      {/* Sub-tabs */}
      <div className='mb-6 flex items-center gap-1 border-b border-brand-border'>
        {TABS.map((t) => (
          <button
            key={t.key}
            type='button'
            onClick={() => setTab(t.key)}
            className={`flex cursor-pointer items-center gap-1.5 border-0 bg-transparent px-4 py-2.5 text-xs font-semibold uppercase tracking-wider2 ${
              tab === t.key
                ? 'border-b-2 border-brand-blue font-semibold text-brand-navy'
                : 'font-normal text-brand-muted hover:text-brand-navy'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ai' && (
        <div className='max-w-2xl rounded-md border border-brand-border bg-white p-6'>
          <p className='m-0 mb-3 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
            {activeModel ? 'Active Model' : 'AI Model'}
          </p>
          {activeModel ? (
            <>
              <p className='m-0 mb-3 font-sans text-base font-medium text-brand-navy'>
                {activeModel.name}
              </p>
              <div className='mb-4 flex flex-wrap items-center gap-2'>
                {activeModel.params && <Pill>{activeModel.params}</Pill>}
                {activeModel.quantization && <Pill>{activeModel.quantization}</Pill>}
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <button
                  type='button'
                  onClick={() => void unload()}
                  className='flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-border bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light'
                  title='Unload the model and free memory'
                >
                  <Power size={12} />
                  Unload
                </button>
                {activeModel.sourceKind !== 'registry' && (
                  <button
                    type='button'
                    onClick={async () => {
                      const r = await resetCache(activeModel.id)
                      if (!r.success) {
                        setError({
                          code: 'RESET_CACHE_FAILED',
                          message: r.error ?? 'Failed to clear cache',
                          retryable: true
                        })
                      }
                    }}
                    className='cursor-pointer rounded-md border border-brand-blue bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider2 text-brand-blue hover:bg-brand-light'
                  >
                    Delete Cache
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className='m-0 font-sans text-sm text-brand-muted'>No model loaded.</p>
          )}
        </div>
      )}

      {tab === 'wallet' && (
        <div className='max-w-2xl rounded-md border border-brand-border bg-white p-6'>
          <p className='m-0 mb-3 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
            Canton Wallet
          </p>
          {!status?.exists ? (
            <>
              <p className='m-0 mb-4 font-sans text-sm text-brand-muted'>
                Set up a Canton wallet to enable settlement. The wallet is generated locally
                and stored encrypted on this machine.
              </p>
              <button
                type='button'
                onClick={openSetup}
                className='flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 py-2 text-xs font-semibold uppercase tracking-wider2 text-white hover:opacity-90'
              >
                <Wallet size={12} />
                Setup Wallet
              </button>
            </>
          ) : (
            <>
              <div className='mb-5 space-y-2'>
                <div>
                  <p className='m-0 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
                    Party ID
                  </p>
                  <p className='m-0 break-all font-mono text-xs text-brand-navy'>
                    {status.partyId}
                  </p>
                </div>
                <div className='flex items-center gap-4'>
                  <div>
                    <p className='m-0 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
                      Fingerprint
                    </p>
                    <p className='m-0 break-all font-mono text-xs text-brand-navy'>
                      {status.fingerprint}
                    </p>
                  </div>
                  {status.createdAt && (
                    <div>
                      <p className='m-0 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
                        Created
                      </p>
                      <p className='m-0 font-sans text-xs text-brand-navy'>
                        {new Date(status.createdAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className='flex flex-wrap items-center gap-2'>
                <button
                  type='button'
                  onClick={openAccountInfo}
                  className='flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-border bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light'
                >
                  <Wallet size={12} />
                  View Account Info
                </button>
                <button
                  type='button'
                  onClick={openExportKey}
                  className='flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-border bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light'
                >
                  <KeyRound size={12} />
                  Export Private Key
                </button>
                <button
                  type='button'
                  onClick={openDestroy}
                  className='flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-errBorder bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider2 text-brand-err hover:bg-brand-errBg'
                >
                  <Trash2 size={12} />
                  Destroy Wallet
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'company' && (
        <div className='max-w-2xl rounded-md border border-brand-border bg-white p-6'>
          <p className='m-0 mb-3 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
            Company Profile
          </p>
          <CompanyForm
            initial={companyFile?.profile}
            submitLabel='Save Profile'
            onSubmit={handleCompanySave}
            submitting={companySaving}
          />
        </div>
      )}
    </div>
  )
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className='inline-flex items-center rounded-full border border-brand-border bg-brand-light px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-navy'>
      {children}
    </span>
  )
}

export default SettingsPage
