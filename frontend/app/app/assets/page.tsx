import HoldingsTable from "@/components/wallet/HoldingsCard";

/**
 * Assets — the employee's tokenized portfolio on Canton.
 *
 * Layout (top → bottom):
 *
 *   1. HoldingsTable — the table view of the employee's holdings.
 *      Reads from useWallet() and renders Asset · Issuer · Unlocked ·
 *      Locked · Status columns. Auto-refreshes every 30s while
 *      connected and the tab is visible.
 *
 * No stat cards up here (yet) — they live on the Dashboard so the
 * Assets page stays focused on the row-level holdings detail.
 */
export default function AssetsPage() {
  return (
    <div>
      <div className="bg-white border border-brand-border rounded-md p-6 max-w-4xl">
        <HoldingsTable />
      </div>
    </div>
  );
}
