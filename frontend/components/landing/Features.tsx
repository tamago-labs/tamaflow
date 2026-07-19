import { FileText, Workflow, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  num: string;
  icon: LucideIcon;
  title: string;
  body: string;
  tags: string[];
}

const features: Feature[] = [
  {
    num: "01",
    icon: FileText,
    title: "Generate",
    body: "Localized payslips, AI templates, private knowledge base.",
    tags: ["Local AI", "RAG"],
  },
  {
    num: "02",
    icon: Workflow,
    title: "Manage",
    body: "Visual payroll flows, tax rules, adding employee data, attendance approval.",
    tags: ["Flow Builder", "Compliance"],
  },
  {
    num: "03",
    icon: Zap,
    title: "Settle",
    body: "Atomic settlement on Canton with secure Hyperswarm distribution.",
    tags: ["Canton", "Hyperswarm"],
  },
];

/**
 * "Key Features" — 3-column numbered layout showing
 * Generate → Manage → Settle workflow.
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
            <span className="text-brand-blue">run payroll on Canton</span>.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <article
              key={f.title}
              className="bg-white border border-brand-border rounded-md p-6 hover:border-brand-blue/40 transition-colors"
            >
              {/* Number + Icon */}
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-2xl font-bold text-brand-teal">
                  {f.num}
                </span>
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-brand-light border border-brand-border text-brand-blue">
                  <f.icon size={18} />
                </span>
              </div>

              {/* Title */}
              <h3 className="text-lg font-medium text-brand-navy mb-2">
                {f.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-brand-navy/70 leading-relaxed mb-4">
                {f.body}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {f.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-brand-light border border-brand-border font-mono text-[10px] font-semibold tracking-wider2 text-brand-navy uppercase"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
