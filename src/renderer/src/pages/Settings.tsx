import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useAI } from '../context/AIContext'
import { formatSize } from '../utils/modelDisplay'
import { Cpu, Wallet, User, GitBranch, RotateCcw, Power } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Outlet context shape, set by MainLayout. Settings > AI Model uses
 * `onChangeModel` to send the user back to the model picker.
 */
interface OutletCtx {
  onChangeModel: () => void
}

/**
 * Settings placeholder — four sub-tabs:
 *   • AI Model  — old Ready card (active model + Change / Unload)
 *   • Wallet    — Connect Wallet (Canton)
 *   • Profile   — company / employer info
 *   • Netting   — netting rules / preferences (lives here per your call)
 */

type Tab = 'ai' | 'wallet' | 'profile' | 'netting'

interface TabDef {
  key: Tab
  label: string
  icon: ReactNode
}

const TABS: TabDef[] = [
  { key: 'ai', label: 'AI Model', icon: <Cpu size={12} /> },
  { key: 'wallet', label: 'Wallet', icon: <Wallet size={12} /> },
  { key: 'profile', label: 'Profile', icon: <User size={12} /> },
  { key: 'netting', label: 'Netting', icon: <GitBranch size={12} /> },
]

export default function Settings() {
  const [tab, setTab] = useState<Tab>('ai')
  const { isReady, activeModel, reload, unload, resetCache, setError } = useAI()
  const { onChangeModel } = useOutletContext<OutletCtx>()

  return (
    <div>
      <PageHeader
        label="Account"
        title="Settings"
        subtitle="AI model, wallet, profile, and netting preferences."
      />

      {/* Sub-tabs */}
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

      {tab === 'ai' && (
        <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-3 m-0">
            {activeModel ? 'Active Model' : 'AI Model'}
          </p>
          {activeModel ? (
            <>
              <p className="font-sans text-base font-medium text-brand-navy m-0 mb-3">
                {activeModel.name}
              </p>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {activeModel.params && <Pill>{activeModel.params}</Pill>}
                {activeModel.quantization && <Pill>{activeModel.quantization}</Pill>}
                {formatSize(activeModel.size) && <Pill>Size: {formatSize(activeModel.size)}</Pill>}
                {activeModel.builtin && <Pill tone="teal">Built-in</Pill>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={onChangeModel}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
                >
                  <RotateCcw size={12} />
                  Change Model
                </button>
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
                >
                  Reload
                </button>
                <button
                  type="button"
                  onClick={() => void unload()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
                  title="Unload the model and free memory"
                >
                  <Power size={12} />
                  Unload
                </button>
                {activeModel.sourceKind !== 'registry' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await resetCache(activeModel.id)
                      if (!r.success) {
                        setError({
                          code: 'RESET_CACHE_FAILED',
                          message: r.error ?? 'Failed to clear cache',
                          retryable: true,
                        })
                      }
                    }}
                    className="px-4 py-2 bg-white text-brand-blue border border-brand-blue rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light"
                  >
                    Delete Cache
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="font-sans text-sm text-brand-muted m-0">
                No model loaded.
              </p>
              <button
                type="button"
                onClick={onChangeModel}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
              >
                <Cpu size={12} />
                Load Model
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'wallet' && (
        <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-3 m-0">
            Canton Wallet
          </p>
          <p className="font-sans text-sm text-brand-muted m-0 mb-4">
            Connect a Canton-compatible wallet to enable settlement. The wallet is used to sign
            settlement transactions on the network.
          </p>
          <button
            type="button"
            className="px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {tab === 'profile' && (
        <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-3 m-0">
            Employer Profile
          </p>
          <p className="font-sans text-sm text-brand-muted m-0">
            Company name, base country, and default currency will live here.
          </p>
        </div>
      )}

      {tab === 'netting' && (
        <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-3 m-0">
            Netting Rules
          </p>
          <p className="font-sans text-sm text-brand-muted m-0">
            Toggles for auto-netting, minimum thresholds, and counterparty rules will live here.
          </p>
        </div>
      )}
    </div>
  )
}

function Pill({ children, tone = 'navy' }: { children: ReactNode; tone?: 'navy' | 'teal' }) {
  return (
    <span
      className={`inline-flex items-center font-mono text-[10px] font-bold rounded-full px-2 py-0.5 tracking-wider2 uppercase border ${
        tone === 'teal'
          ? 'text-brand-tealAccent bg-[#eafaf8] border-brand-teal'
          : 'text-brand-navy bg-brand-light border-brand-border'
      }`}
    >
      {children}
    </span>
  )
}
