"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, CheckCircle2, Rocket } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { useWalletMode } from "@/lib/wallet/useWalletMode";
import { setCliUrl } from "@/lib/cli";

const DEMO_CONFIG = {
  cliUrl: "https://d3pgy5i52ev547.cloudfront.net",
  inviteCode: "yry797uajfwwposbqdu7nf7c6sckhpo6iwpxpgktsxwyigj8f5t8nqs3hih3jabuk84bb9kzpzjitsratbrhs8d79c475dwm7hfynu69ba",
};

interface DemoConnectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DemoConnectModal({ open, onClose }: DemoConnectModalProps) {
  const { connect } = useWalletMode();
  const [step, setStep] = useState<"idle" | "connecting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setStep("connecting");
    setError("");
    try {
      // Point CLI to the demo employee-cli
      setCliUrl(DEMO_CONFIG.cliUrl);
      await connect(DEMO_CONFIG.inviteCode);
      setStep("done");
      setTimeout(() => onClose(), 800);
    } catch {
      setStep("error");
      setError("Demo server not reachable. It may be offline.");
    }
  };

  const handleClose = () => {
    setStep("idle");
    setError("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      maxWidth="max-w-md"
      ariaLabelledBy="demo-modal-title"
    >
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
          <div className="flex items-center gap-2 mb-2"> 
            <p className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold">
              Demo Account
            </p>
          </div>
          <h2
            id="demo-modal-title"
            className="text-2xl font-light text-brand-navy leading-tight m-0"
          >
            Try TamaFlow
          </h2>
          <p className="mt-2 text-sm text-brand-navy/70 leading-relaxed m-0">
            This is a shared demo account hosted on AWS EC2 for testing.
          </p>
        </div>

        {/* Server URL */}
        <div className="mb-5">
          <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1.5">
            Server URL
          </label>
          <input
            type="text"
            value={DEMO_CONFIG.cliUrl}
            readOnly
            className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 px-3 text-xs text-gray-500 font-mono cursor-not-allowed"
          />
        </div>

        {/* Invite code (locked) */}
        <div className="mb-5">
          <label className="block font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1.5">
            Invite Code
          </label>
          <input
            type="text"
            value={DEMO_CONFIG.inviteCode}
            readOnly
            className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 px-3 text-xs text-gray-500 font-mono cursor-not-allowed"
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
            <span className="text-xs text-green-700">Connected to demo!</span>
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
                <Rocket size={14} />
                Connect to Demo Wallet
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
