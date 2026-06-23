import {
  ShieldCheck,
  GitBranch,
  Coins,
  Sparkles,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  bullets: string[];
  accent: "blue" | "teal" | "navy" | "ok";
}

const features: Feature[] = [
  {
    icon: ShieldCheck,
    title: "Private Payroll",
    body: "Employee compensation stays visible only to authorized parties.",
    bullets: ["Fine-grained access control", "Confidential transactions"],
    accent: "blue",
  },
  {
    icon: GitBranch,
    title: "Cross-Border Netting",
    body: "Consolidate obligations across currencies before settlement to cut operational cost.",
    bullets: ["Multi-currency netting", "Reduced FX exposure"],
    accent: "teal",
  },
  {
    icon: Coins,
    title: "Tokenized Deposits",
    body: "Programmable payroll settlement using digital representations of bank deposits.",
    bullets: ["Atomic multi-party settlement", "Bank-deposit backed"],
    accent: "navy",
  },
  {
    icon: Sparkles,
    title: "AI Payroll Assistant",
    body: "Local agents review, summarise, and surface what needs you before approval.",
    bullets: [
      "Payroll summaries",
      "Anomaly detection",
      "Approval recommendations",
      "Estimated savings insights",
    ],
    accent: "blue",
  },
  {
    icon: Mail,
    title: "Private Payslips",
    body: "Employees securely access only their own payment details — never the full dataset.",
    bullets: ["Per-employee access", "No company-wide exposure"],
    accent: "ok",
  },
];

const accentMap: Record<Feature["accent"], string> = {
  blue: "bg-[#eaeefc] text-brand-blue border-brand-blue",
  teal: "bg-[#eafaf8] text-brand-tealAccent border-brand-teal",
  navy: "bg-brand-light text-brand-navy border-brand-border",
  ok: "bg-[#e6f7ee] text-brand-ok border-brand-ok",
};

/**
 * "Key Features" — 5-card grid (4+1 layout) with icons, descriptions,
 * and short bullet lists. Each card has a coloured accent badge.
 */
export default function Features() {
  return (
    <section id="features" className="bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-3">
            Key Features
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-brand-navy tracking-tight leading-tight">
            Everything you need to{" "}
            <span className="text-brand-blue">pay a global team</span>.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <article
              key={f.title}
              className={`bg-white border border-brand-border rounded-md p-6 hover:border-brand-blue/40 transition-colors ${
                f.title === "AI Payroll Assistant"
                  ? "lg:col-span-1 lg:row-span-1"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-md border ${accentMap[f.accent]}`}
                >
                  <f.icon size={18} />
                </span>
                <span className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
                  {String(features.indexOf(f) + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-lg font-medium text-brand-navy">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-brand-navy/70 leading-relaxed">
                {f.body}
              </p>
              <ul className="mt-4 space-y-1.5">
                {f.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-center gap-2 text-[12px] text-brand-navy/80"
                  >
                    <span className="w-1 h-1 rounded-full bg-brand-blue" />
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
