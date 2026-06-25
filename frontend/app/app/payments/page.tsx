import { ArrowRightLeft } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";

/**
 * Payments placeholder — incoming payroll payments + historical
 * transfer log. Future scope will surface Canton tx hashes, party
 * breakdown, and netting savings per cycle.
 */
export default function PaymentsPage() {
  return (
    <div>
      <PageHeader
        label="Activity"
        title="Payments"
        subtitle="Incoming payroll payments and your transfer history. Atomic, private, and auditable on Canton."
      />

      <div className="bg-white border border-brand-border rounded-md p-10 max-w-3xl">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-brand-light border border-brand-border text-brand-blue mb-4">
            <ArrowRightLeft size={22} />
          </span>
          <p className="font-sans text-base font-medium text-brand-navy m-0 mb-1">
            No payments yet
          </p>
          <p className="font-sans text-sm text-brand-muted m-0 max-w-md">
            Your incoming payroll payments and historical transfer
            ledger will appear here once your employer runs a flow.
          </p>
        </div>
      </div>
    </div>
  );
}
