import PageHeader from "@/components/app/PageHeader";

/**
 * Settlements placeholder — top-level page for Canton settlement
 * history. Each row will show the tx hash, parties, amount, and
 * status. Currently empty.
 */
export default function SettlementsPage() {
  return (
    <div>
      <PageHeader
        label="Canton Network"
        title="Settlements"
        subtitle="All payroll settlements on the Canton network. Each row links to the underlying flow and the on-chain tx."
      />

      <div className="bg-white border border-brand-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 py-3 px-4 border-b border-brand-border bg-brand-light">
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Flow
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Tx Hash
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Parties
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Amount
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Status
          </span>
        </div>
        <div className="py-12 text-center font-sans text-sm text-brand-muted">
          No settlements yet. Approve a flow to settle it on Canton.
        </div>
      </div>
    </div>
  );
}
