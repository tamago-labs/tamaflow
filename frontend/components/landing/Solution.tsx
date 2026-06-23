import {
  Users,
  ShieldCheck,
  GitBranch,
  Coins,
  Sparkles,
  Check,
} from "lucide-react";

const capabilities = [
  {
    icon: Users,
    title: "Manage from one dashboard",
    body: "Onboard, edit, and audit every employee and payroll cycle from a single private workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Keep compensation private on Canton",
    body: "Fine-grained access control means only the right pair of eyes ever sees a given payslip.",
  },
  {
    icon: GitBranch,
    title: "Auto-net cross-border obligations",
    body: "Offset payables and receivables across currencies before settlement, slashing FX and fees.",
  },
  {
    icon: Coins,
    title: "Settle atomically with tokenized deposits",
    body: "Programmable digital representations of bank deposits execute the transfer in a single atomic step.",
  },
  {
    icon: Sparkles,
    title: "AI summaries & anomaly alerts",
    body: "Local agents summarise totals, country splits, and flag unusual changes before you approve.",
  },
];

/**
 * "Solution" section — 5 capability rows with a teal checkmark +
 * icon. Mirrors the desktop-app's bullet rhythm.
 */
export default function Solution() {
  return (
    <section id="solution" className="bg-brand-light">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-3">
            The Solution
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-brand-navy tracking-tight leading-tight">
            Faster. Cheaper.{" "}
            <span className="text-brand-blue">Confidential</span> global
            payroll.
          </h2>
          <p className="mt-4 text-base text-brand-navy/70 leading-relaxed">
            TamaFlow gives growing businesses the same confidential,
            netted, atomic payroll workflow used by large treasury
            desks — without the headcount, the integrations, or the
            cloud-LLM exposure.
          </p>
        </div>

        <ul className="space-y-3">
          {capabilities.map((c) => (
            <li
              key={c.title}
              className="flex items-start gap-4 bg-white border border-brand-border rounded-md p-5"
            >
              <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md bg-brand-light border border-brand-border text-brand-blue">
                <c.icon size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Check
                    size={14}
                    className="text-brand-ok flex-shrink-0"
                    strokeWidth={3}
                  />
                  <h3 className="text-base font-medium text-brand-navy">
                    {c.title}
                  </h3>
                </div>
                <p className="mt-1 text-sm text-brand-navy/70 leading-relaxed">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
