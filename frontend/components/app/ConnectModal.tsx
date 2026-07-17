"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, CheckCircle2, LinkIcon } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { useWalletMode } from "@/lib/wallet/useWalletMode";

const STEPS = [
  { num: "01", text: "Start the employee-cli server" },
  { num: "02", text: "Enter invite code below (optional)" },
  { num: "03", text: "Click Connect" },
];

interface ConnectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ConnectModal({ open, onClose }: ConnectModalProps) {
  const { connect } = useWalletMode();
  const [step, setStep] = useState<"idle" | "connecting" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const handleConnect = async () => {
    setStep("connecting");
    setError("");
    try {
      await connect(inviteCode || undefined);
      setStep("done");
      setTimeout(() => onClose(), 800);
    } catch {
      setStep("error");
      setError("CLI server not reachable.");
    }
  };

  const handleClose = () => {
    setStep("idle");
    setError("");
    setInviteCode("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      maxWidth="max-w-md"
      ariaLabelledBy="connect-modal-title"
    >
      {/* Close X */}
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-md text-brand-muted hover:text-brand-navy hover:bg-brand-light transition-colors z-10"
      >
        <X size={16} />
      </button>

      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-5">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold mb-2">
            Connect
          </p>
          <h2
            id="connect-modal-title"
            className="text-2xl font-light text-brand-navy leading-tight m-0"
          >
            Connect Your Team
          </h2>
          <p className="mt-2 text-sm text-brand-navy/70 leading-relaxed m-0">
            Follow these steps to connect your CLI wallet:
          </p>
        </div>

        {/* Steps */}
        <ol className="space-y-3 mb-5">
          {STEPS.map((s) => (
            <li key={s.num} className="flex items-center gap-3">
              <span className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold flex-shrink-0">
                {s.num}
              </span>
              <span className="font-sans text-sm text-brand-navy">{s.text}</span>
            </li>
          ))}
        </ol>

        {/* Invite code */}
        <div className="mb-5">
          <label htmlFor="invite-code" className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1.5">
            Invite Code (optional)
          </label>
          <input
            id="invite-code"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Enter Hyperswarm invite code..."
            className="w-full rounded-md border border-gray-200 bg-white py-2 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:outline-none"
          />
        </div>

        {/* Status */}
        {step === "error" && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3">
            <X size={14} className="text-red-600 flex-shrink-0" />
            <span className="text-xs text-red-700">{error}</span>
          </div>
        )}
        {step === "done" && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3">
            <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
            <span className="text-xs text-green-700">Connected successfully!</span>
          </div>
        )}

        {/* Connect + Close buttons */}
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            onClick={handleConnect}
            disabled={step === "connecting" || step === "done"}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="inline-flex items-center justify-center gap-2 flex-1 py-3 px-6 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase hover:opacity-90 transition-opacity shadow-[0_4px_18px_-6px_rgba(26,26,232,0.45)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === "connecting" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Connecting...
              </>
            ) : step === "done" ? (
              <>
                <CheckCircle2 size={14} />
                Connected
              </>
            ) : (
              <>
                <LinkIcon size={14} />
                Connect
              </>
            )}
          </motion.button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center py-3 px-5 bg-white border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase text-brand-navy hover:bg-brand-light transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
