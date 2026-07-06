import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'
import { Loader2, Droplets } from 'lucide-react'

/**
 * Faucet modal — mints Amulet (CC) to the wallet's party. Signs the
 * tap transaction with the wallet's own private key. Default amount
 * is 1000 CC.
 */
export default function FaucetModal() {
  const { modal, runFaucet, loadStatus, error, clearError, closeFaucet } = useWallet()
  const [amount, setAmount] = useState('1000.0000000000')
  const [result, setResult] = useState<{
    txHash?: string
    amount?: string
  } | null>(null)
 
  const isBusy = loadStatus === 'fauceting'

  const handleRun = async () => {
    clearError()
    setResult(null)
    const r = await runFaucet(amount)
    if (r.success) {
      setResult({ txHash: r.txHash, amount: r.amount })
    }
  }

  return (
    <WalletModal
      open={modal.faucetOpen}
      onClose={closeFaucet}
      title="Faucet"
      subtitle="Mint testnet Amulet (CC)"
    >
      <div className="space-y-4">
        <p className="font-sans text-sm text-brand-navy m-0">
          Mint Canton Amulet (CC) to your wallet for testing. The tap
          transaction is signed with this wallet's own key.
        </p>

        <div>
          <label
            htmlFor="faucet-amount"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mb-1.5"
          >
            Amount
          </label>
          <input
            id="faucet-amount"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isBusy}
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-mono text-sm text-brand-navy focus:outline-none focus:border-brand-blue"
          />
        </div>

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

        {result && (
          <div className="p-3 bg-brand-light border border-brand-border rounded-md space-y-1">
            <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-tealAccent m-0">
              Faucet succeeded
            </p>
            <p className="font-sans text-xs text-brand-navy m-0">
              Minted <strong>{result.amount ?? amount}</strong> to your wallet.
            </p>
            {result.txHash && (
              <p className="font-mono text-[10px] text-brand-muted m-0 break-all">
                tx: {result.txHash}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeFaucet}
            disabled={isBusy}
            className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={isBusy || !amount}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50"
          >
            {isBusy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Droplets size={12} />
            )}
            {isBusy ? 'Running…' : 'Run Faucet'}
          </button>
        </div>
      </div>
    </WalletModal>
  )
}
