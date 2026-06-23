import { Check, Network, Lock, Zap, Building } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const pillars: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Lock,
    title: "Confidential transactions",
    body: "Sub-transaction privacy means no party — not even network validators — sees the full payroll dataset.",
  },
  {
    icon: Network,
    title: "Fine-grained access control",
    body: "Canton-native permissions let us scope every payslip to the right pair of eyes only.",
  },
  {
    icon: Zap,
    title: "Atomic multi-party settlement",
    body: "All parties commit or none do — no partial settlement, no double-pay, no manual reconciliation.",
  },
  {
    icon: Building,
    title: "Enterprise-grade workflows",
    body: "Built for the throughput and compliance posture real businesses need from their financial stack.",
  },
];

/**
 * "Why Canton" — a 2x2 capability grid plus a "hard to replicate
 * elsewhere" callout. Visual language matches the rest of the page
 * (mono labels, light-300 titles, brand-teal accent bar).
 */
export default function WhyCanton() {
  return (
    <section id="why-canton" className="bg-brand-navy text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
          {/* Left: heading + note */}
          <div>
            <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-teal uppercase mb-3">
              Why Canton
            </p>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight leading-tight">
              Capabilities that are{" "}
              <span className="text-brand-teal">native to Canton</span>
              <br />— and hard to replicate elsewhere.
            </h2>
            <p className="mt-4 text-base text-white/70 leading-relaxed max-w-md">
              TamaFlow needs privacy, programmable settlement, and
              enterprise-grade financial workflows. Public chains
              weren't built for that. Canton was.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 border border-brand-teal/40 rounded-full bg-brand-teal/10">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
              <span className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold">
                Built for confidential finance
              </span>
            </div>
          </div>

          {/* Right: pillar grid */}
          <div className="grid sm:grid-cols-2 gap-3">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="bg-white/[0.04] border border-white/10 rounded-md p-5 hover:border-brand-teal/50 transition-colors"
              >
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-brand-teal/10 text-brand-teal border border-brand-teal/30 mb-3">
                  <p.icon size={16} />
                </span>
                <div className="flex items-start gap-2">
                  <Check
                    size={14}
                    className="text-brand-teal mt-0.5 flex-shrink-0"
                    strokeWidth={3}
                  />
                  <h3 className="text-base font-medium text-white">
                    {p.title}
                  </h3>
                </div>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
