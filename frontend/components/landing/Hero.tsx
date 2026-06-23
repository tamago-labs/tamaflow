import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Lock, Cpu } from "lucide-react";
import DownloadDesktopApp from "./DownloadDesktopApp";

/**
 * Landing-page hero.
 *
 *   Top label   : small mono "TamaFlow · Local AI Auto-Payroll on Canton"
 *   H1          : "Zero-Cloud AI. Zero-Leaked Payroll Data."
 *   Subtitle    : Canton + privacy pitch (verbatim from brief)
 *   CTAs        : "Launch App" (primary) + "Read the Whitepaper" (secondary)
 *   Right card  : a stylized dashboard mockup with the brand tokens
 *
 * The mockup is hand-rolled with plain divs (no external image) so the
 * visual stays crisp at any size and respects the design system.
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient grid + teal corner glow */}
      <div className="absolute inset-0 landing-grid pointer-events-none" />
      <div
        className="absolute -top-40 right-0 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(62, 196, 192, 0.18) 0%, rgba(62, 196, 192, 0) 70%)",
        }}
      />
      <div
        className="absolute -bottom-40 left-0 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(26, 26, 232, 0.12) 0%, rgba(26, 26, 232, 0) 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-8 pb-24 lg:pt-12 lg:pb-32 grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
        {/* Left: copy */}
        <div>
          <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-light text-brand-navy tracking-tight leading-[1.05]">
            Zero-Cloud AI.{" "}
            <span className="text-brand-blue">Zero-Leaked</span>{" "} 
            Payroll Data.
          </h1>

          <p className="mt-6 text-lg text-brand-navy/80 max-w-xl leading-relaxed">
            Stop leaking corporate finances to third-party cloud LLMs. Import sensitive data locally, verify employees with 5N ID, and let AI run payroll end-to-end on Canton through Loop SDK.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 py-3 px-6 bg-brand-blue text-white rounded-md  text-[11px] font-bold tracking-wider2 uppercase no-underline hover:opacity-90 transition-opacity shadow-[0_4px_18px_-6px_rgba(26,26,232,0.45)]"
            >
              I'm an Employee
              <ArrowUpRight size={14} />
            </Link>
            <DownloadDesktopApp />
          </div>

          {/* Trust strip — three small mono badges */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            {[
              { icon: ShieldCheck, label: "Confidential by design" },
              { icon: Lock, label: "Local LLM · No cloud" },
              { icon: Cpu, label: "Atomic settlement on Canton" },
            ].map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-2  text-[10px] tracking-wider2 text-brand-muted uppercase"
              >
                <b.icon size={14} className="text-brand-teal" />
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: visual mockup */}
        <DashboardMockup />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero mockup — a self-contained "dashboard card" that mirrors the actual    */
/* in-app shell (teal accent + sidebar). Pure CSS / divs, no images.         */
/* -------------------------------------------------------------------------- */
function DashboardMockup() {
  return (
    <div className="relative">
      {/* Outer card */}
      <div className="relative bg-white border border-brand-border rounded-lg overflow-hidden shadow-[0_30px_80px_-30px_rgba(10,10,92,0.35)]">
        {/* Teal top accent (matches sidebar) */}
        <div className="h-[3px] bg-brand-teal" />

        {/* Window chrome */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-brand-border bg-brand-light">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-border" />
            <span className="w-2.5 h-2.5 rounded-full bg-brand-border" />
            <span className="w-2.5 h-2.5 rounded-full bg-brand-border" />
          </div>
          <span className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
            tamaflow
          </span>
          <span className="w-12" />
        </div>

        {/* Body — sidebar + main */}
        <div className="grid grid-cols-[64px_1fr]">
          {/* Sidebar mock */}
          <aside className="bg-white border-r border-brand-border py-3 flex flex-col items-center gap-3">
           
            <div className="mt-1 flex flex-col gap-1 w-10">
              {["◆", "◇", "◇", "◇", "◇"].map((g, i) => (
                <span
                  key={i}
                  className={`h-6 rounded flex items-center justify-center text-[10px] ${i === 0
                      ? "bg-brand-blue text-white"
                      : "text-brand-muted"
                    }`}
                >
                  {g}
                </span>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase font-semibold">
                Overview
              </p>
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
                AI Ready
              </span>
            </div>
            <p className="text-[15px] font-light text-brand-navy">
              June Payroll · Japan · Thailand · Singapore
            </p>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: "Employees", v: "12" },
                { l: "Net Flows", v: "03" },
                { l: "Saved", v: "18%" },
              ].map((k) => (
                <div
                  key={k.l}
                  className="border border-brand-border rounded p-2.5"
                >
                  <p className="font-mono text-[8px] tracking-wider2 text-brand-muted uppercase font-semibold">
                    {k.l}
                  </p>
                  <p className="text-base font-light text-brand-navy">
                    {k.v}
                  </p>
                </div>
              ))}
            </div>

            {/* AI summary card */}
            <div className="border border-brand-border rounded p-3 bg-brand-light">
              <p className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase font-semibold mb-1.5">
                AI Summary
              </p>
              <p className="text-[12px] text-brand-navy leading-snug">
                Payroll approved. Estimated FX and settlement savings{" "}
                <span className="text-brand-ok font-semibold">18%</span>.
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center font-mono text-[8px] font-bold tracking-wider2 uppercase border border-brand-ok text-brand-ok bg-[#e6f7ee] rounded-full px-1.5 py-0.5">
                  Approved
                </span>
                <span className="inline-flex items-center font-mono text-[8px] font-bold tracking-wider2 uppercase border border-brand-teal text-brand-tealAccent bg-[#eafaf8] rounded-full px-1.5 py-0.5">
                  Canton
                </span>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </div>
  );
}
