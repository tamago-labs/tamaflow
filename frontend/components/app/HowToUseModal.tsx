"use client";

import { X, CheckCircle2 } from "lucide-react";
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

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-full py-3 px-6 bg-white border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase text-brand-navy hover:bg-brand-light transition-colors mt-2"
        >
          Close
        </button>

        <p className="mt-3 text-center text-[11px] text-brand-muted m-0">
          Get the{" "}
          <a
            href="https://github.com/tamago-labs/tamaflow"
            target="_blank"
            rel="noreferrer"
            className="text-brand-blue hover:underline"
          >
            Employer Client / CLI Wallet
          </a>
        </p>
      </div>
    </Modal>
  );
}
