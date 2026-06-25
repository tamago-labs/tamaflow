import { IdCard } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";

/**
 * Identification placeholder — KYC, employee ID, and Canton-native
 * identity claims. Future scope will include document upload,
 * biometric verification, and selective disclosure of identity
 * fields to counterparties.
 */
export default function IdentificationPage() {
  return (
    <div>
      <PageHeader
        label="Identity"
        title="Identification"
        subtitle="Your verified identity and selective-disclosure credentials. Stored locally, never on a cloud LLM."
      />

      <div className="bg-white border border-brand-border rounded-md p-10 max-w-3xl">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-brand-light border border-brand-border text-brand-blue mb-4">
            <IdCard size={22} />
          </span>
          <p className="font-sans text-base font-medium text-brand-navy m-0 mb-1">
            No ID on file
          </p>
          <p className="font-sans text-sm text-brand-muted m-0 max-w-md">
            Your verified identity documents and Canton-native
            credentials will appear here once your employer onboards
            you.
          </p>
        </div>
      </div>
    </div>
  );
}
