import PageHeader from '../components/PageHeader'

/**
 * Assets placeholder — tokenized holdings overview for the user's
 * Canton wallet. Will eventually surface balances, valuation, and
 * bridge actions sourced from the wallet context. For now it just
 * shows the page chrome + an empty state matching the other
 * placeholder pages (Settlements, Employees, etc.).
 */
export default function Assets() {
  return (
    <div>
      <PageHeader
        label="Account"
        title="Assets"
        subtitle="Your tokenized holdings on Canton — balances, valuation, and bridge actions will appear here once a wallet is connected."
      />

      <div className="bg-white border border-brand-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-4 py-3 px-4 border-b border-brand-border bg-brand-light">
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Asset
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Balance
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Value
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Action
          </span>
        </div>
        <div className="py-12 text-center font-sans text-sm text-brand-muted">
          No assets yet. Connect your wallet to load balances.
        </div>
      </div>
    </div>
  )
}