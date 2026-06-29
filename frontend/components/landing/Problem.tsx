import { Eye, Repeat2, Banknote, Building2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ProblemItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

const items: ProblemItem[] = [
  {
    icon: Eye,
    title: "Exposed payroll data",
    body: "Today's payroll stack passes compensation details through multiple intermediaries — every one a potential leak.",
  },
  {
    icon: Repeat2,
    title: "Fragmented transfers",
    body: "Companies execute separate international transfers for every employee. Slow, expensive, and error-prone.",
  },
  {
    icon: Banknote,
    title: "Unnecessary FX & fees",
    body: "Cross-border payments stack up banking fees and FX spreads that quietly drain margin on every cycle.",
  },
  {
    icon: Building2,
    title: "No treasury tooling",
    body: "Small businesses lack the netting engines and workflow tools that large enterprises use to settle at scale.",
  },
];

/**
 * "Problem" section — surfaces the four pain points of the current
 * global-payroll status quo, each as a card with a teal/blue icon.
 */
export default function Problem() {
  return (
    <section id="problem" className="bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-3">
            The Problem
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-brand-navy tracking-tight leading-tight">
            Global hiring is on.{" "}
            <span className="text-brand-blue">Global payroll</span> is
            broken.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((it) => (
            <article
              key={it.title}
              className="group bg-white border border-brand-border rounded-md p-6 hover:border-brand-blue/40 transition-colors"
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-brand-light border border-brand-border text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
                <it.icon size={18} />
              </span>
              <h3 className="mt-4 text-lg font-medium text-brand-navy">
                {it.title}
              </h3>
              <p className="mt-2 text-sm text-brand-navy/70 leading-relaxed">
                {it.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
