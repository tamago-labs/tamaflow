"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import DownloadDesktopApp from "./DownloadDesktopApp";

/**
 * Landing-page hero.
 *
 *   H1          : "Zero-Cloud AI. Zero-Leaked Payroll Data."
 *   Subtitle    : Canton + privacy pitch (verbatim from brief)
 *   Trust line  : "Edge-AI parses payroll on-device, so no cloud can leak it under GDPR." (Shield)
 *   CTAs        : "I'm an Employee" (primary) + DownloadDesktopApp (secondary)
 *   Right card  : a stylized "flow canvas" mockup mirroring the in-app
 *                 shell — palette of payment templates on the left, two
 *                 connected cards (Employee → Payment) on the right with
 *                 an animated dashed connector and a pulsing destination
 *                 halo on the Payment card.
 *
 * The mockup is hand-rolled with plain divs + inline SVG (no external
 * image) so it stays crisp at any size and respects the design system.
 * Animations live in `app/globals.css` (dash-flow + halo-breathe) and
 * framer-motion for one-shot entrance stagger.
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
            Stop leaking corporate finances to third-party cloud LLMs. Import sensitive data locally, verify employees with 5N ID, and let AI run payroll end-to-end on Canton.
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

          {/* Trust line — single sentence framing the privacy promise */}
          <div className="mt-10 flex items-center gap-2.5 text-sm text-brand-navy/80 font-medium leading-relaxed">
            <ShieldCheck size={14} className="text-brand-teal flex-shrink-0" />
            Edge-AI parses payroll on-device, so no cloud can leak it under GDPR.
          </div>
        </div>

        {/* Right: visual mockup */}
        <FlowCanvasMockup />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero mockup — a self-contained "flow canvas" card that mirrors the actual  */
/* in-app shell. Palette on the left, two connected cards on the right with   */
/* an animated dashed connector and a pulsing "destination" halo. Pure CSS /  */
/* divs / inline SVG, no images.                                              */
/* -------------------------------------------------------------------------- */
function FlowCanvasMockup() {
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
          {/* Sidebar mock — slim, mirrors the in-app nav rail */}
          <aside className="bg-white border-r border-brand-border py-3 flex flex-col items-center gap-2">
            <div className="w-7 h-7 rounded bg-brand-blue text-white flex items-center justify-center text-[10px] font-mono font-bold">
              T
            </div>
            <div className="mt-1 flex flex-col gap-1 w-10">
              {["◆", "◇", "◇", "◇"].map((g, i) => (
                <span
                  key={i}
                  className={`h-6 rounded flex items-center justify-center text-[10px] ${
                    i === 0
                      ? "bg-brand-blue text-white"
                      : "text-brand-muted"
                  }`}
                >
                  {g}
                </span>
              ))}
            </div>
          </aside>

          {/* Main content — flow canvas */}
          <div className="p-4 space-y-3 min-h-[210px]">
            {/* Flow header — name + ready status */}
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase font-semibold">
                Flow · March payroll
              </p>
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-wider2 text-brand-ok uppercase font-semibold">
                <span className="relative inline-flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-brand-ok animate-ping opacity-60" />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-brand-ok" />
                </span>
                Ready
              </span>
            </div>

            {/* Palette + canvas row */}
            <div className="grid grid-cols-[80px_1fr] gap-3 items-stretch">
              {/* Palette — small stack of payment templates */}
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                className="border border-brand-border rounded p-2 space-y-1.5"
              >
                <p className="font-mono text-[8px] tracking-wider2 text-brand-muted uppercase font-semibold">
                  Palette
                </p>
                {[
                  { name: "Direct", tone: "navy" as const },
                  { name: "US 27%", tone: "teal" as const },
                  { name: "Bonus", tone: "navy" as const },
                ].map((t, i) => (
                  <motion.div
                    key={t.name}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: 0.3 + i * 0.1,
                      ease: "easeOut",
                    }}
                    className={`text-[8px] font-mono tracking-wider2 uppercase px-1.5 py-1 rounded border ${
                      t.tone === "teal"
                        ? "border-brand-teal text-brand-tealAccent bg-[#eafaf8]"
                        : "border-brand-border text-brand-navy bg-white"
                    }`}
                  >
                    {t.name}
                  </motion.div>
                ))}
              </motion.div>

              {/* Canvas — two cards joined by an animated dashed line */}
              <div className="relative flex items-center justify-between min-h-[120px] px-1">
                {/* Animated dashed connector — draws from the right edge
                    of the Employee card to the left edge of the Payee
                    card. `viewBox` keeps the dash pattern consistent
                    regardless of the container's actual pixel size. */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 200 60"
                  preserveAspectRatio="none"
                  fill="none"
                  aria-hidden
                >
                  {/* Solid faint track underneath for context */}
                  <line
                    x1="28"
                    y1="30"
                    x2="172"
                    y2="30"
                    stroke="#e0e0f0"
                    strokeWidth="1"
                  />
                  {/* Animated teal dashes flowing left → right */}
                  <line
                    x1="28"
                    y1="30"
                    x2="172"
                    y2="30"
                    stroke="#3EC4C0"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    className="animate-dash-flow"
                  />
                  {/* Tiny input/output port dots, matching the in-app
                      canvas card ports. */}
                  <circle cx="28" cy="30" r="2" fill="#3EC4C0" />
                  <circle cx="172" cy="30" r="2" fill="#3EC4C0" />
                </svg>

                {/* Employee card — origin of the route */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, delay: 0.2, ease: "easeOut" }}
                  className="relative z-10 bg-white border border-brand-border rounded p-2 w-[78px] shadow-[0_2px_8px_-4px_rgba(10,10,92,0.18)]"
                >
                  <p className="font-mono text-[7px] tracking-wider2 text-brand-muted uppercase">
                    Employee
                  </p>
                  <p className="text-[12px] text-brand-navy font-semibold leading-tight mt-0.5">
                    Akira
                  </p>
                  <p className="font-mono text-[8px] text-brand-muted mt-1">
                    JPY · Tokyo
                  </p>
                </motion.div>

                {/* Payment card — destination; breathing halo + teal
                    outline signal "this is the on-ledger settlement —
                    amount in CC, settled on Canton". */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, delay: 0.4, ease: "easeOut" }}
                  className="relative z-10"
                >
                  <div className="absolute -inset-1.5 rounded-md bg-brand-teal/15 animate-halo-breathe" />
                  <div className="relative bg-white border-2 border-brand-teal rounded p-2 w-[78px] shadow-[0_2px_12px_-4px_rgba(62,196,192,0.45)]">
                    <p className="font-mono text-[7px] tracking-wider2 text-brand-tealAccent uppercase font-semibold">
                      Payment
                    </p>
                    <p className="text-[12px] text-brand-navy font-semibold leading-tight mt-0.5 whitespace-nowrap">
                      1,250 CC
                    </p>
                    <p className="font-mono text-[8px] text-brand-muted mt-1 whitespace-nowrap">
                      on Canton
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Footer — route meta */}
            <div className="flex items-center justify-between border-t border-brand-border pt-2">
              <span className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
                2 cards · 1 route
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
