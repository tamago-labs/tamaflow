import { FileText } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";

/**
 * Account Statement placeholder — monthly / annual statement of
 * the employee's private payroll ledger. Future scope will
 * generate a downloadable PDF and CSV export, with per-cycle
 * savings breakdowns and tax-ready summaries.
 */
export default function StatementPage() {
  return (
    <div>
      <PageHeader
        label="Ledger"
        title="Account Statement"
        subtitle="Monthly and annual statements of your private payroll ledger. Audit-ready, exported on demand."
      />

      <div className="bg-white border border-brand-border rounded-md p-10 max-w-3xl">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-brand-light border border-brand-border text-brand-blue mb-4">
            <FileText size={22} />
          </span>
          <p className="font-sans text-base font-medium text-brand-navy m-0 mb-1">
            No statements yet
          </p>
          <p className="font-sans text-sm text-brand-muted m-0 max-w-md">
            Monthly and annual statements of your private payroll
            ledger will appear here once your first cycle settles on
            Canton.
          </p>
        </div>
      </div>
    </div>
  );
}
