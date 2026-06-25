"use client";

/**
 * "How it works" — vertical timeline of the 4-step payroll flow.
 *
 * Each step is a row: number circle on the left, content on the
 * right, and a vertical line connecting the circles. Reads top →
 * bottom like the actual workflow, so the visual order reinforces
 * the order of operations.
 *
 * No cards / no backgrounds — the row itself is the visual unit.
 * With only 4 steps we can afford larger type, so the title reads
 * at `text-lg font-semibold` and the body at `text-base` — no pill
 * needed, the action verb in the title carries the meaning.
 *
 * Entry animation (framer-motion, `whileInView`): each step
 * fades in with a small upward slide as the user scrolls it into
 * view. A short per-step delay creates a staggered "timeline draws
 * itself" effect top → bottom.
 */
import { motion, type Variants } from "framer-motion";

interface Step {
  num: string;
  title: string;
  body: string;
}

const steps: Step[] = [
  {
    num: "01",
    title: "Import payroll documents",
    body: "Upload payroll spreadsheets, tax forms, and supporting documents. AI parsing happens entirely on-device, so payroll data never leaves your machine.",
  },
  {
    num: "02",
    title: "Review payroll with AI",
    body: "AI reads each file, builds the payroll run, and flags anything unusual so a manager can review and approve with confidence.",
  },
  {
    num: "03",
    title: "Route approvals & settle",
    body: "Managers approve through configurable role-based workflows with full audit trail. Once approved, settlements are coordinated on Canton.",
  },
  {
    num: "04",
    title: "Employees receive and access funds",
    body: "Employees sign in once to verify their identity, receive payroll into their own Canton wallet, and access statements and assets through the Employee Portal.",
  },
];

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 320,
      damping: 28,
      delay: i * 0.08,
    },
  }),
};

const circleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 360,
      damping: 22,
      delay: 0.04 + i * 0.08,
    },
  }),
};

export default function UserFlow() {
  return (
    <section id="flow" className="bg-white">
      <div className="max-w-4xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        {/* Section header */}
        <div className="mb-12">
          <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-brand-navy tracking-tight leading-tight max-w-2xl">
            From payroll documents to{" "}
            <span className="text-brand-blue">private settlements</span> — in
            four steps.
          </h2>
        </div>

        {/* Vertical timeline */}
        <ol className="relative">
          {/* Vertical connecting line — sits behind the number circles */}
          <div
            className="absolute left-[19px] top-4 bottom-4 w-px bg-brand-border"
            aria-hidden="true"
          />

          {steps.map((s, i) => (
            <motion.li
              key={s.num}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
              variants={itemVariants}
              className="relative flex gap-6 pb-10 last:pb-0"
            >
              {/* Number circle on the line */}
              <motion.div
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.4 }}
                variants={circleVariants}
                className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-white border border-brand-border flex items-center justify-center"
                aria-hidden="true"
              >
                <span className="font-mono text-[11px] font-bold text-brand-blue">
                  {s.num}
                </span>
              </motion.div>

              {/* Content */}
              <div className="flex-1 pt-1.5 min-w-0">
                <h3 className="text-lg font-semibold text-brand-navy mb-2">
                  {s.title}
                </h3>
                <p className="text-base text-brand-navy/70 leading-relaxed m-0">
                  {s.body}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
