import { ShieldCheck, Zap, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  bullets: string[];
  accent: "blue" | "teal" | "navy" | "ok";
  /** Optional badge rendered in the top-right of the card. */
  badge?: string;
}

const features: Feature[] = [
  {
    icon: ShieldCheck,
    title: "Private Payroll",
    body: "Compensation stays visible only to the parties authorised to see it. No third-party LLM, no intermediary, no leak surface.",
    bullets: [
      "On-ledger confidentiality",
      "Per-employee access scope",
    ],
    accent: "blue",
  },
  {
    icon: Zap,
    title: "Atomic Settlement on Canton",
    body: "Every payroll run settles in a single on-ledger transaction. All parties commit or none do — no partial state, no manual reconciliation.",
    bullets: [
      "One transaction per cycle",
      "Full audit trail on Canton",
    ],
    accent: "teal",
  },
  {
    icon: Sparkles,
    title: "AI-Assisted Payroll",
    body: "Local AI parses payroll documents, flags anomalies, and surfaces what needs review. Sensitive data never leaves your machine.",
    bullets: [
      "Local LLM — no cloud",
      "Roster + document parsing",
      "Anomaly detection",
    ],
    accent: "navy",
    badge: "Coming soon",
  },
];

const accentMap: Record<Feature["accent"], string> = {
  blue: "bg-[#eaeefc] text-brand-blue border-brand-blue",
  teal: "bg-[#eafaf8] text-brand-tealAccent border-brand-teal",
  navy: "bg-brand-light text-brand-navy border-brand-border",
  ok: "bg-[#e6f7ee] text-brand-ok border-brand-ok",
};

/**
 * "Key Features" — 3-card row (one for each of our three real
 * promises: privacy, Canton settlement, local AI). Each card has a
 * coloured accent badge for the icon and a small mono number/badge
 * in the top-right. The AI card carries a "Coming soon" pill so
 * visitors don't expect a fully-baked AI in v1.
 */
export default function Features() {
  return (
    <section id="features" className="bg-brand-light">
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
          {features.map((f, i) => (
            <article
              key={f.title}
              className="bg-white border border-brand-border rounded-md p-6 hover:border-brand-blue/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-md border ${accentMap[f.accent]}`}
                >
                  <f.icon size={18} />
                </span>
                {f.badge ? (
                  <span className="inline-flex items-center font-mono text-[9px] tracking-wider2 text-brand-muted uppercase font-semibold border border-brand-border rounded-full px-2 py-0.5 bg-brand-light">
                    {f.badge}
                  </span>
                ) : (
                  <span className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                )}
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
