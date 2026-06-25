import { ShieldCheck } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";

/**
 * Security placeholder — 2FA, recovery codes, and Canton-side
 * access controls for the employee's account. Future scope will
 * include biometric unlock, hardware-key registration, and an
 * audit log of every access to the employee's private data.
 */
export default function SecurityPage() {
  return (
    <div>
      <PageHeader
        label="Protection"
        title="Security"
        subtitle="Two-factor auth, recovery codes, and Canton-side access controls for your private data."
      />

      <div className="bg-white border border-brand-border rounded-md p-10 max-w-3xl">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-brand-light border border-brand-border text-brand-blue mb-4">
            <ShieldCheck size={22} />
          </span>
          <p className="font-sans text-base font-medium text-brand-navy m-0 mb-1">
            No security settings yet
          </p>
          <p className="font-sans text-sm text-brand-muted m-0 max-w-md">
            Enable two-factor authentication, generate recovery codes,
            and review the audit log of every access to your private
            data — coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
