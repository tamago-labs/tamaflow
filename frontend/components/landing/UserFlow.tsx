import {
  FileUp,
  Sparkles,
  Check,
  GitBranch,
  Coins,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Step {
  num: string;
  icon: LucideIcon;
  title: string;
  body: string;
  tag: string;
}

const steps: Step[] = [
  {
    num: "01",
    icon: FileUp,
    title: "Import or create payroll",
    body: "Upload a CSV roster or build it by hand — the system accepts both.",
    tag: "Employer",
  },
  {
    num: "02",
    icon: Sparkles,
    title: "AI reviews & summarises",
    body: "Local LLM surfaces totals, country split, anomalies, and estimated savings.",
    tag: "Local AI",
  },
  {
    num: "03",
    icon: Check,
    title: "Employer approves",
    body: "One-tap approval moves the flow to netting. Edits are non-destructive.",
    tag: "Employer",
  },
  {
    num: "04",
    icon: GitBranch,
    title: "Net obligations",
    body: "Cross-border payables and receivables are netted across currencies.",
    tag: "TamaFlow",
  },
  {
    num: "05",
    icon: Coins,
    title: "Settle on Canton",
    body: "Tokenized deposits execute the final transfers atomically.",
    tag: "Canton",
  },
  {
    num: "06",
    icon: Mail,
    title: "Private payslips",
    body: "Each employee sees only their own payment details — never the company's full payroll.",
    tag: "Employee",
  },
];

/**
 * "Core User Flow" — 6 numbered steps in a horizontal flow on
 * desktop, vertical cards on mobile. Each step is a brand-styled
 * card with an icon, number, and tag badge.
 */
export default function UserFlow() {
  return (
    <section id="flow" className="bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-3">
            Core User Flow
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-brand-navy tracking-tight leading-tight">
            From roster to{" "}
            <span className="text-brand-blue">private payslip</span> in
            six steps.
          </h2>
        </div>

        <ol className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((s) => (
            <li
              key={s.num}
              className="relative bg-white border border-brand-border rounded-md p-6 hover:border-brand-blue/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[11px] font-bold tracking-wider2 text-brand-blue uppercase">
                  Step {s.num}
                </span>
                <span
                  className={`inline-flex items-center font-mono text-[9px] font-bold tracking-wider2 uppercase rounded-full px-2 py-0.5 border ${
                    s.tag === "Canton"
                      ? "text-brand-tealAccent border-brand-teal bg-[#eafaf8]"
                      : s.tag === "Local AI"
                      ? "text-brand-blue border-brand-blue bg-[#eaeefc]"
                      : s.tag === "TamaFlow"
                      ? "text-brand-navy border-brand-border bg-brand-light"
                      : "text-brand-ok border-brand-ok bg-[#e6f7ee]"
                  }`}
                >
                  {s.tag}
                </span>
              </div>
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-brand-light border border-brand-border text-brand-blue mb-3">
                <s.icon size={18} />
              </span>
              <h3 className="text-base font-medium text-brand-navy">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm text-brand-navy/70 leading-relaxed">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
