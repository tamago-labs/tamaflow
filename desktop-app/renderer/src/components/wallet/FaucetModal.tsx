// Faucet modal — mints Amulet (CC) to the wallet's party. Signs the
// tap transaction with the wallet's own private key. Default amount
// is 1000 CC. Reached from AccountMenu → Faucet (mirrors the old
// version's faucet flow).

import { useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { WalletModal } from './WalletModal'
import { Loader2, Droplets } from 'lucide-react'

const DEFAULT_AMOUNT = '1000.0000000000'

export function FaucetModal() {
  const { modal, runFaucet, loadStatus, error, clearError, closeFaucet } =
    useWallet()
  const [amount, setAmount] = useState(DEFAULT_AMOUNT)
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
      title='Faucet'
      // subtitle='Mint testnet Amulet (CC)'
    >
      <div className='space-y-4'>
        <p className='m-0 font-sans text-sm text-brand-navy'>
          Mint Canton Amulet (CC) to your wallet for testing. The tap
          transaction is signed with this wallet's own key.
        </p>
        <br/>

        <div>
          <label
            htmlFor='faucet-amount'
            className='mb-1.5 block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'
          >
            Amount
          </label>
          <input
            id='faucet-amount'
            type='text'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isBusy}
            className='w-full rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-sm text-brand-navy focus:border-brand-blue focus:outline-none'
          />
        </div>

        {error && (
          <div className='rounded-md border border-brand-errBorder bg-brand-errBg p-3'>
            <p className='m-0 mb-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err'>
              Error
            </p>
            <p className='m-0 whitespace-pre-wrap font-sans text-xs text-brand-errDark'>
              {error}
            </p>
          </div>
        )}

        {result && (
          <div className='space-y-1 rounded-md border border-brand-border bg-brand-light p-3'>
            <p className='m-0 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-tealAccent'>
              Faucet succeeded
            </p>
            <p className='m-0 font-sans text-xs text-brand-navy'>
              Minted <strong>{result.amount ?? amount}</strong> to your wallet.
            </p>
            {result.txHash && (
              <p className='m-0 break-all font-mono text-[10px] text-brand-muted'>
                tx: {result.txHash}
              </p>
            )}
          </div>
        )}

        <div className='flex items-center justify-end gap-2 pt-2'>
          <button
            type='button'
            onClick={closeFaucet}
            disabled={isBusy}
            className='cursor-pointer rounded-md border border-brand-border bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light disabled:opacity-50'
          >
            Close
          </button>
          <button
            type='button'
            onClick={handleRun}
            disabled={isBusy || !amount}
            className='flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50'
          >
            {isBusy ? (
              <Loader2 size={12} className='animate-spin' />
            ) : (
              <Droplets size={12} />
            )}
            {isBusy ? 'Running…' : 'Mint'}
          </button>
        </div>
      </div>
    </WalletModal>
  )
}

export default FaucetModal
