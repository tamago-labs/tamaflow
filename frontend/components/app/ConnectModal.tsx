"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, CheckCircle2, LinkIcon } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { useWalletMode } from "@/lib/wallet/useWalletMode";

interface ConnectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ConnectModal({ open, onClose }: ConnectModalProps) {
  const { connect } = useWalletMode();
  const [step, setStep] = useState<"idle" | "connecting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setStep("connecting");
    setError("");
    try {
      await connect();
      setStep("done");
      setTimeout(() => onClose(), 800);
    } catch {
      setStep("error");
      setError("CLI server not reachable. Start the employee-cli first.");
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
            CLI Wallet
          </h2>
          <p className="mt-2 text-sm text-brand-navy/70 leading-relaxed m-0">
            Connect to your local CLI wallet to interact with the Canton network.
          </p>
        </div>

        {/* Status */}
        <div className="mb-6">
          {step === "idle" && (
            <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
              <LinkIcon size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600">Not connected</span>
            </div>
          )}
          {step === "connecting" && (
            <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-3">
              <Loader2 size={16} className="text-blue-600 animate-spin" />
              <span className="text-sm text-blue-700">Connecting to CLI server...</span>
            </div>
          )}
          {step === "done" && (
            <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 p-3">
              <CheckCircle2 size={16} className="text-green-600" />
              <span className="text-sm text-green-700">Connected successfully!</span>
            </div>
          )}
          {step === "error" && (
            <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-3">
              <X size={16} className="text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
        </div>

        {/* Connect button */}
        <motion.button
          type="button"
          onClick={handleConnect}
          disabled={step === "connecting" || step === "done"}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase hover:opacity-90 transition-opacity shadow-[0_4px_18px_-6px_rgba(26,26,232,0.45)] disabled:opacity-50 disabled:cursor-not-allowed"
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

        <p className="mt-3 text-center text-[11px] text-brand-muted m-0">
          Make sure the employee-cli server is running on localhost:3001.
        </p>
      </div>
    </Modal>
  );
}
