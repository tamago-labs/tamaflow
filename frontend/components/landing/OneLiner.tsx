import { Quote } from "lucide-react";

/**
 * "One-Liner" callout — a single declarative sentence that
 * summarises TamaFlow for skim readers, sandwiched between big mono
 * quote marks for visual emphasis.
 */
export default function OneLiner() {
  return (
    <section className="bg-brand-navy text-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-20 lg:py-28 text-center">
        <Quote
          size={36}
          className="mx-auto mb-6 text-brand-teal opacity-90"
          aria-hidden
        />
        <p className="font-mono text-[11px] tracking-wider2 text-brand-teal uppercase font-semibold mb-5">
          One-Liner
        </p>
        <p className="text-2xl md:text-3xl lg:text-4xl font-light leading-snug">
          TamaFlow is a privacy-first payroll platform that helps SMEs and
          growing businesses pay global teams efficiently by{" "}
          <span className="text-brand-teal">automatically netting</span>{" "}
          cross-border obligations and settling them confidentially on
          Canton.
        </p>
      </div>
    </section>
  );
}
