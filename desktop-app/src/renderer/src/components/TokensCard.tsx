import { useWallet } from '../context/WalletContext'
import { Wallet, Droplets, RefreshCw, Coins } from 'lucide-react'

/**
 * Dashboard "My Tokens" card.
 *
 * Three states:
 *   - no-wallet: CTA pointing to the TopBar Setup button.
 *   - empty:     CTA to run the faucet.
 *   - loaded:    rows of { symbol + amount } + refresh button.
 */
export default function TokensCard() {
  const {
    status,
    holdings,
    holdingsLoading,
    loadStatus,
    openFaucet,
    refreshHoldings,
  } = useWallet()

  const walletPresent = loadStatus === 'present' && !!status?.exists

  return (
    <div className="bg-white border border-brand-border rounded-md p-6 mb-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
          My Tokens
        </p>
        {walletPresent && (
          <button
            type="button"
            onClick={() => void refreshHoldings()}
            disabled={holdingsLoading}
            className="flex items-center gap-1 px-2 py-1 bg-transparent border-0 text-brand-muted hover:text-brand-navy cursor-pointer font-mono text-[10px] uppercase tracking-wider2 disabled:opacity-50"
            title="Refresh holdings"
          >
            <RefreshCw
              size={11}
              className={holdingsLoading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        )}
      </div>

      {!walletPresent && (
        <div className="flex items-center gap-3">
          <Wallet size={20} className="text-brand-muted flex-shrink-0" />
          <div>
            <p className="font-sans text-sm text-brand-navy m-0">
              No wallet set up yet.
            </p>
            <p className="font-sans text-xs text-brand-muted m-0 mt-0.5">
              Use <strong>Setup Wallet</strong> in the top bar to create one.
            </p>
          </div>
        </div>
      )}

      {walletPresent && holdings.length === 0 && !holdingsLoading && (
        <div className="flex items-center gap-3">
          <Coins size={20} className="text-brand-muted flex-shrink-0" />
          <div className="flex-1">
            <p className="font-sans text-sm text-brand-navy m-0">
              No tokens yet.
            </p>
            <p className="font-sans text-xs text-brand-muted m-0 mt-0.5">
              Mint Canton Amulet (CC) from the faucet to test payroll flows.
            </p>
          </div>
          <button
            type="button"
            onClick={openFaucet}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
          >
            <Droplets size={11} />
            Open Faucet
          </button>
        </div>
      )}

      {walletPresent && holdingsLoading && holdings.length === 0 && (
        <p className="font-sans text-sm text-brand-muted m-0">
          Loading holdings…
        </p>
      )}

      {walletPresent && holdings.length > 0 && (
        <div className="divide-y divide-brand-border">
          {holdings.map((h, i) => (
            <div
              key={`${h.contractId}-${i}`}
              className="flex items-center justify-between py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
                  <span className="font-mono text-[10px] font-bold text-brand-navy">
                    {h.symbol.slice(0, 3)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-sm font-medium text-brand-navy m-0">
                    {h.symbol}
                  </p>
                  <p className="font-mono text-[10px] text-brand-muted m-0 truncate">
                    {h.instrumentId}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-sans text-sm font-medium text-brand-navy m-0">
                  {h.amount}
                </p>
                {h.lockedAmount && h.lockedAmount !== '0' && (
                  <p className="font-mono text-[10px] text-brand-muted m-0">
                    locked {h.lockedAmount}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
