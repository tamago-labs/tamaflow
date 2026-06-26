import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'
import { Loader2 } from 'lucide-react'

/**
 * First-run modal: lets the user pick an organization name that we
 * slug-ify into a Canton party hint, or fall back to a default if they
 * leave it blank. Generates a new keypair, allocates the party on
 * Canton DevNet, and encrypts the wallet with the OS keychain via
 * Electron's safeStorage.
 *
 * The hint is also re-validated in the main process (defence-in-depth)
 * — see `slugifyPartyHint` in wallet.ts.
 */

const DEFAULT_PARTY_HINT = 'tamaflow'

/**
 * Convert an org name into a Canton-safe party hint. Pure / deterministic,
 * kept here (and in wallet.ts) so the renderer can preview the result as
 * the user types. The two implementations must stay in sync.
 *
 *   "Acme Corp."   → "acme-corp"
 *   "  Foo/Bar!  " → "foo-bar"
 *   "@@@@"         → ""           (caller falls back to default)
 */
function slugifyPartyHint(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export default function SetupWalletModal() {
  const { modal, loadStatus, error, setup, clearError, closeSetup } = useWallet()
  const [orgName, setOrgName] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  // Reset transient state every time the modal opens.
  useEffect(() => {
    if (modal.setupOpen) {
      setOrgName('')
      setAcknowledged(false)
      clearError()
    }
  }, [modal.setupOpen, clearError])

  const isBusy = loadStatus === 'creating'

  const { usingDefault, partyHint } = useMemo(() => {
    const slug = slugifyPartyHint(orgName.trim())
    const usingDefault = slug.length === 0
    return {
      usingDefault,
      partyHint: usingDefault ? DEFAULT_PARTY_HINT : slug,
    }
  }, [orgName])

  const handleGenerate = async () => {
    await setup({ partyHint })
  }

  return (
    <WalletModal
      open={modal.setupOpen}
      onClose={closeSetup}
      title="Setup Wallet"
      subtitle="First-time setup"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Organization name → live party hint preview */}
        <div>
          <label
            htmlFor="setup-wallet-org"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted font-semibold mb-1.5"
          >
            Organization name
          </label>
          <input
            id="setup-wallet-org"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Corp"
            disabled={isBusy}
            autoFocus
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-sans text-sm text-brand-navy placeholder:text-brand-muted focus:outline-none focus:border-brand-blue transition-colors disabled:opacity-60"
          />
          <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mt-1.5 m-0">
            Party hint:{' '}
            <span className="text-brand-navy font-semibold normal-case tracking-normal">
              {partyHint}
            </span>
            {usingDefault && (
              <span className="text-brand-muted normal-case tracking-normal">
                {' '}
                (default — leave blank or type your org name)
              </span>
            )}
          </p>
        </div>

        {/* One-line note covering the security model. */}
        <p className="font-sans text-xs text-brand-muted m-0 leading-relaxed">
          Your keypair is generated locally and encrypted with your OS
          keychain. This wallet is bound to this device — destroying it
          removes access to the funds it controls.
        </p>

        {/* Acknowledgement */}
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={isBusy}
            className="mt-0.5 cursor-pointer"
          />
          <span className="font-sans text-xs text-brand-navy">
            I understand this wallet is bound to this machine.
          </span>
        </label>

        {/* Error from a previous attempt */}
        {error && (
          <div className="p-3 bg-brand-errBg border border-brand-errBorder rounded-md">
            <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-err m-0 mb-1">
              Error
            </p>
            <p className="font-sans text-xs text-brand-errDark m-0 whitespace-pre-wrap">
              {error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeSetup}
            disabled={isBusy}
            className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!acknowledged || isBusy}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50"
          >
            {isBusy && <Loader2 size={12} className="animate-spin" />}
            {isBusy ? 'Generating…' : 'Generate Wallet'}
          </button>
        </div>
      </div>
    </WalletModal>
  )
}