import { useEffect, useState } from 'react'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'
import { Loader2, ShieldAlert } from 'lucide-react'

/**
 * First-run modal: confirms the user wants to generate a Canton wallet.
 * The wallet is encrypted at rest with the OS keychain via Electron's
 * safeStorage; we still surface a warning so the user understands this
 * computer can sign on their behalf.
 */
export default function SetupWalletModal() {
  const { modal, loadStatus, error, setup, clearError, closeSetup } = useWallet()
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    if (modal.setupOpen) {
      setAcknowledged(false)
      clearError()
    }
  }, [modal.setupOpen, clearError])

  const isBusy = loadStatus === 'creating'
  const encryptionAvailable = true // we don't expose this state yet; modal will surface 'error' on attempt

  const handleGenerate = async () => {
    await setup()
  }

  return (
    <WalletModal
      open={modal.setupOpen}
      onClose={closeSetup}
      title="Setup Canton Wallet"
      subtitle="First-time setup"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {!encryptionAvailable && (
          <div className="flex items-start gap-2 p-3 bg-brand-errBg border border-brand-errBorder rounded-md">
            <ShieldAlert size={14} className="text-brand-err mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-err m-0 mb-1">
                Encryption Unavailable
              </p>
              <p className="font-sans text-xs text-brand-errDark m-0">
                The OS keychain is not reachable. On Linux, install{' '}
                <code>libsecret-1</code> + a keyring provider
                (gnome-keyring or kwallet), then restart the app.
              </p>
            </div>
          </div>
        )}

        <p className="font-sans text-sm text-brand-navy m-0">
          This will generate a new Canton wallet and allocate a party on
          the Canton DevNet ledger.
        </p>

        <ul className="font-sans text-xs text-brand-muted m-0 pl-4 space-y-1 list-disc">
          <li>
            The Ed25519 keypair is generated locally — nothing is sent
            to a server.
          </li>
          <li>
            The private key is encrypted with your operating system
            keychain (DPAPI / Keychain / libsecret) before being saved
            to disk.
          </li>
          <li>
            Anyone with access to this computer can use the wallet
            while logged in.
          </li>
        </ul>

        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 cursor-pointer"
          />
          <span className="font-sans text-xs text-brand-navy">
            I understand that the wallet is bound to this machine and
            that destroying it removes access to the funds it controls.
          </span>
        </label>

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
