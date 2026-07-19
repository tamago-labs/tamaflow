import { Check } from "lucide-react";

const CHECKLIST = [
  "Withholding tax",
  "Social security",
  "Local payslips",
  "Attendance tracking",
  "Audit trail",
  "Privacy by design",
  "Accountant-ready",
];

/**
 * "Problem" section — shows that crypto payroll stops at payment
 * but real payroll requires much more.
 */
export default function Problem() {
  return (
    <section id="problem" className="bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="text-center max-w-3xl mx-auto">
          <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-3">
            The Problem
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-brand-navy tracking-tight leading-tight mb-12">
            Crypto payroll stops at payment
          </h2>

          {/* Wallet A → Wallet B visual */}
          <p className="font-mono text-xs font-medium tracking-wider3 text-brand-muted uppercase mb-4">
            Payroll isn&apos;t just
          </p>
          <div className="flex items-center justify-center gap-6 mb-16">
            <span className="px-6 py-3 bg-brand-light border border-brand-border rounded-md font-mono text-sm font-semibold text-brand-navy">
              Wallet A
            </span>
            <span className="text-2xl text-brand-muted">→</span>
            <span className="px-6 py-3 bg-brand-light border border-brand-border rounded-md font-mono text-sm font-semibold text-brand-navy">
              Wallet B
            </span>
          </div>

          {/* Divider */}
          <div className="w-16 h-px bg-brand-border mx-auto mb-12" />

          {/* Real payroll checklist */}
          <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-8">
            Real payroll includes
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 max-w-4xl mx-auto">
            {CHECKLIST.map((item) => (
              <div key={item} className="flex items-center gap-3 justify-center sm:justify-start">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-teal/15 flex-shrink-0">
                  <Check size={12} className="text-brand-teal" />
                </span>
                <span className="text-sm text-brand-navy font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
