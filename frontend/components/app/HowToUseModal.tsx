"use client";

import { motion } from "framer-motion";
import { X, CheckCircle2, Download } from "lucide-react";
import Modal from "@/components/shared/Modal";

const FEATURES = [
  "On-chain time check-in",
  "Claim reward points",
  "Faucet for Canton DevNet",
  "Receive payslips via P2P Hyperswarm",
  "Team chat via P2P Hyperswarm",
];

interface HowToUseModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HowToUseModal({ open, onClose }: HowToUseModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-md"
      ariaLabelledBy="how-to-use-title"
    >
      {/* Top bar — Close + Download button */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-md text-brand-muted hover:text-brand-navy hover:bg-brand-light transition-colors z-10"
      >
        <X size={16} />
      </button>

      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-5">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold mb-2">
            TamaFlow v1
          </p>
          <h2
            id="how-to-use-title"
            className="text-2xl font-light text-brand-navy leading-tight m-0"
          >
            What&apos;s New
          </h2>
          <p className="mt-2 text-sm text-brand-navy/70 leading-relaxed m-0">
            We migrated from Loop Wallet to{" "}
            <span className="font-semibold text-brand-navy">CLI Wallet</span>{" "}
            with Hyperswarm P2P. Here&apos;s what you can do:
          </p>
        </div>

        {/* Feature list */}
        <ul className="space-y-2.5 mb-6">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-brand-teal flex-shrink-0" />
              <span className="font-sans text-sm text-brand-navy">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Button row — Download + Close */}
        <div className="flex items-center gap-2 mt-2">
          <motion.a
            href="https://github.com/tamago-labs/tamaflow"
            target="_blank"
            rel="noreferrer"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="inline-flex items-center justify-center gap-2 flex-1 py-3 px-6 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase no-underline hover:opacity-90 transition-opacity shadow-[0_4px_18px_-6px_rgba(26,26,232,0.45)]"
          >
            <Download size={14} />
            Download Now
          </motion.a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center py-3 px-5 bg-white border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase text-brand-navy hover:bg-brand-light transition-colors"
          >
            Close
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-brand-muted m-0">
          Get the Employer Client to distribute salary with local AI and Canton.
        </p>
      </div>
    </Modal>
  );
}
