import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * Bottom-of-page CTA strip — a navy banner with the final
 * "ready to run payroll privately?" pitch and the primary CTA.
 */
export default function CTA() {
  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="relative bg-brand-navy text-white rounded-lg overflow-hidden p-10 lg:p-14">
          <div
            className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(62, 196, 192, 0.3) 0%, rgba(62, 196, 192, 0) 70%)",
            }}
          />
          <div
            className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(26, 26, 232, 0.25) 0%, rgba(26, 26, 232, 0) 70%)",
            }}
          />

          <div className="relative grid lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
            <div>
              <p className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold mb-3">
                Get started today
              </p>
              <h2 className="text-3xl md:text-4xl font-light leading-tight">
                Private payroll that{" "}
                <span className="text-brand-teal">actually works</span>.
              </h2>
              <p className="mt-4 text-base text-white/70 max-w-xl leading-relaxed">
                Configure employees, build payroll flows, and settle atomically on Canton.
                No cloud LLM ever sees your data.
              </p>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-3">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 py-3 px-7 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase no-underline hover:opacity-90 shadow-[0_6px_24px_-8px_rgba(26,26,232,0.7)]"
              >
                Launch App
                <ArrowUpRight size={14} />
              </Link>
              <a
                href="https://youtu.be/_k3mefQHz2c"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 py-3 px-7 bg-transparent text-white border border-white/20 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase no-underline hover:bg-white/5"
              >
                Watch Demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
