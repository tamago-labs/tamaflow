import { Wallet } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";

/**
 * Assets placeholder — view of the employee's tokenized assets /
 * balances. Future scope will include portfolio breakdown, recent
 * transactions, and cross-currency net positions.
 */
export default function AssetsPage() {
  return (
    <div> 

      <div className="bg-white border border-brand-border rounded-md p-10 max-w-3xl">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-brand-light border border-brand-border text-brand-blue mb-4">
            <Wallet size={22} />
          </span>
          <p className="font-sans text-base font-medium text-brand-navy m-0 mb-1">
            No assets yet
          </p>
          <p className="font-sans text-sm text-brand-muted m-0 max-w-md">
            Your settled balances and tokenized deposits will appear here
            once your first payroll run completes.
          </p>
        </div>
      </div>
    </div>
  );
}
