"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";

/**
 * OneLiner — testimonial section, rendered right under the Hero.
 *
 * Visual: a navy band that contrasts with the white sections above
 * and below. A big opening quote mark sits top-left, the quote is
 * left-aligned (not centered) so it reads like a real pull-quote,
 * followed by a thin divider and the attribution line in mono small
 * caps with the name highlighted in brand-teal.
 *
 * Animation (framer-motion):
 *   • Quote icon + quote text fade in with a slight scale-up + y-shift
 *   • Divider line draws in (width 0 → full)
 *   • Attribution line fades in last, slightly delayed
 *
 * Spring language matches the modals (stiffness 320, damping 28) so
 * the motion across the site feels unified.
 */
const QUOTE =
  "TamaFlow helps us pay our Japan and Singapore teams in one atomic settlement — without ever exposing payroll data to a third-party LLM. It's the first payroll product that actually respects privacy.";

const NAME = "Pisuth D.";
const ROLE = "Representative Director, Tamago Labs Japan";

export default function OneLiner() {
  return (
    <section className="bg-brand-navy text-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        {/* Opening quote mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 0.9, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{
            type: "spring",
            stiffness: 320,
            damping: 28,
            mass: 0.9,
          }}
        >
          <Quote size={40} className="text-brand-teal opacity-90 mb-5" />
        </motion.div>

        {/* Quote text */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{
            delay: 0.08,
            type: "spring",
            stiffness: 320,
            damping: 28,
          }}
          className="font-sans text-2xl md:text-3xl lg:text-[32px] font-light leading-snug text-white m-0 max-w-3xl"
        >
          &ldquo;{QUOTE}&rdquo;
        </motion.p>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{
            delay: 0.2,
            duration: 0.5,
            ease: "easeOut",
          }}
          style={{ transformOrigin: "left" }}
          className="h-px bg-brand-teal/40 my-8 max-w-xs"
        />

        {/* Attribution */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="font-mono text-[12px] tracking-wider2 text-white/80 uppercase m-0"
        >
          <span className="text-brand-teal font-bold">{NAME}</span>
          <span className="mx-2 text-white/40">·</span>
          <span>{ROLE}</span>
        </motion.p>
      </div>
    </section>
  );
}