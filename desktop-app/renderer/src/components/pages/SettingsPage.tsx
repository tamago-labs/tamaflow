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
import { Wallet, Power, KeyRound, Trash2, Building2, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useWallet } from '../../context/WalletContext'
import { useRoom } from '../../hooks/useRoom'
import { bridge } from '../../lib/bridge'
import type { CompanyProfile, CompanyFile } from '../../ai/types'
import CompanyForm from '../CompanyForm'

type Tab = 'company' | 'p2p' | 'wallet'

interface TabDef {
  key: Tab
  label: string
  icon: ReactNode
}

const TABS: TabDef[] = [
  { key: 'company', label: 'Company', icon: <Building2 size={12} /> },
  { key: 'p2p', label: 'P2P Hyperswarm', icon: <Users size={12} /> },
  { key: 'wallet', label: 'Wallet', icon: <Wallet size={12} /> }
]

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company')
  const { status, openSetup, openAccountInfo, openExportKey, openDestroy } =
    useWallet()
  const { me, renameSelf, writable } = useRoom()

  const [companyFile, setCompanyFile] = useState<CompanyFile | null>(null)
  const [companySaving, setCompanySaving] = useState(false)
  const [username, setUsername] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)

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

  // Sync username with room.me
  useEffect(() => {
    if (me?.name) setUsername(me.name)
  }, [me?.name])

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
      <div className="mb-6">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Settings</h1>
      </div>

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

      {tab === 'p2p' && (
        <div className='max-w-2xl rounded-md border border-gray-200 bg-white p-6'>
          <p className='m-0 mb-3 font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold'>
            P2P Hyperswarm
          </p>
          <p className='m-0 mb-4 font-sans text-sm text-gray-500'>
            Your display name is used in team chat and P2P sync.
          </p>

          <div className='space-y-4'>
            <div>
              <label className='mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400'>
                Display Name
              </label>
              <div className='flex items-center gap-2'>
                <input
                  type='text'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder='Your name'
                  disabled={!writable || usernameSaving}
                  className='flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-60'
                />
                <button
                  type='button'
                  onClick={async () => {
                    if (!username.trim() || username === me?.name) return
                    setUsernameSaving(true)
                    try {
                      renameSelf(username.trim())
                    } finally {
                      setUsernameSaving(false)
                    }
                  }}
                  disabled={!writable || !username.trim() || username === me?.name || usernameSaving}
                  className='rounded-md border-0 bg-blue-600 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:bg-blue-700 disabled:opacity-50'
                >
                  {usernameSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
              <p className='m-0 mt-1.5 font-mono text-[10px] uppercase tracking-wider2 text-gray-400'>
                This name appears in team chat messages.
              </p>
            </div>

            {me && (
              <div className='pt-4 border-t border-gray-200'>
                <p className='m-0 font-mono text-[10px] uppercase tracking-wider2 text-gray-400'>
                  Peer ID
                </p>
                <p className='m-0 mt-1 font-mono text-xs text-gray-600 break-all'>
                  {me.key}
                </p>
              </div>
            )}
          </div>
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
                {status.createdAt && (
                  <div>
                    <p className='m-0 font-mono text-[10px] uppercase tracking-wider2 text-gray-400'>
                      Created
                    </p>
                    <p className='m-0 font-sans text-xs text-gray-900'>
                      {new Date(status.createdAt).toLocaleString()}
                    </p>
                  </div>
                )}
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

export default SettingsPage
