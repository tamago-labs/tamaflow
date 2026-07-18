"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

/**
 * Landing-page hero.
 *
 *   H1          : "Zero-Cloud AI. Zero-Leaked Payroll Data."
 *   Subtitle    : Canton + privacy pitch
 *   Trust line  : Canton settlement · Hyperswarm · GDPR-clean
 *   CTAs        : "I'm an Employee" + DownloadDesktopApp
 *   Right       : Auto-playing screenshot carousel (hover to pause)
 */

const SCREENSHOTS = [
  {
    src: "/screenshot-payroll-flow.png",
    label: "Payroll Flow",
    desc: "Drag and drop payroll flows with withholding per employee group",
  },
  {
    src: "/screenshot-timesheet.png",
    label: "Timesheet",
    desc: "Employees check in daily — recorded on Canton smart contracts",
  },
  {
    src: "/screenshot-payslip-view.png",
    label: "Payslip View",
    desc: "View payslips with detailed tax, social security, and net pay",
  },
  {
    src: "/screenshot-payslip-generation.png",
    label: "AI Generation",
    desc: "Local AI generates payslips customized for your jurisdiction",
  },
  {
    src: "/screenshot-knowledge-base.png",
    label: "Knowledge Base",
    desc: "Search company docs with AI — zero cloud, P2P to employer machine",
  },
];

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
            Stop leaking corporate finances to third-party cloud LLMs. Import sensitive data locally, generate payslips with local AI, and settle compliant payroll on Canton.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 py-3 px-6 bg-brand-blue text-white rounded-md  text-[11px] font-bold tracking-wider2 uppercase no-underline hover:opacity-90 transition-opacity shadow-[0_4px_18px_-6px_rgba(26,26,232,0.45)]"
            >
              I'm an Employee
              <ArrowUpRight size={14} />
            </Link>
            <a
              href="https://github.com/tamago-labs/tamaflow"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 py-3 px-6 bg-white text-brand-navy border border-brand-border rounded-md text-[11px] font-bold tracking-wider2 uppercase no-underline hover:bg-brand-light transition-colors"
            >
              I'm an Employer
              <ArrowUpRight size={14} />
            </a>
          </div>

          {/* Trust line */}
          <div className="mt-10 flex items-center gap-2.5 text-sm text-brand-navy/80 font-medium leading-relaxed">
            <ShieldCheck size={14} className="text-brand-teal flex-shrink-0" />
            Canton settlement
            <ShieldCheck size={14} className="text-brand-teal flex-shrink-0" />
            Hyperswarm data sharing
            <ShieldCheck size={14} className="text-brand-teal flex-shrink-0" />
            GDPR-clean by design
          </div>
        </div>

        {/* Right: screenshot carousel */}
        <ScreenshotCarousel />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Screenshot Carousel — auto-play with hover pause + dot navigation          */
/* -------------------------------------------------------------------------- */
function ScreenshotCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % SCREENSHOTS.length);
  }, []);

  // Auto-play
  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(next, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, next]);

  const slide = SCREENSHOTS[current];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Card */}
      <div className="relative bg-white border border-brand-border rounded-lg overflow-hidden shadow-[0_30px_80px_-30px_rgba(10,10,92,0.35)]">
        {/* Teal top accent */}
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

        {/* Screenshot image */}
        <div className="relative aspect-[21/9] bg-brand-light">
          <AnimatePresence mode="wait">
            <motion.img
              key={current}
              src={slide.src}
              alt={slide.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </AnimatePresence>
        </div>

        {/* Label + description */}
        <div className="px-5 py-4 border-t border-brand-border bg-white">
          <p className="font-mono text-xs font-semibold tracking-wider2 text-brand-navy uppercase">
            {slide.label}
          </p>
          <p className="font-sans text-sm text-brand-muted mt-1 leading-relaxed">
            {slide.desc}
          </p>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {SCREENSHOTS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === current
                ? "bg-brand-blue w-5"
                : "bg-brand-border hover:bg-brand-muted"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </motion.div>
  );
}
