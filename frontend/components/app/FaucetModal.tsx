"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, CheckCircle2, Droplets } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { cli } from "@/lib/cli";

interface FaucetModalProps {
  open: boolean;
  onClose: () => void;
}

export default function FaucetModal({ open, onClose }: FaucetModalProps) {
  const [step, setStep] = useState<"idle" | "minting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const handleMint = async () => {
    setStep("minting");
    setError("");
    try {
      await cli.wallet.faucet("1000.0000000000");
      setStep("done");
    } catch {
      setStep("error");
      setError("Faucet request failed. Check CLI server logs.");
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
      maxWidth="max-w-sm"
      ariaLabelledBy="faucet-modal-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-md text-brand-muted hover:text-brand-navy hover:bg-brand-light transition-colors z-10"
      >
        <X size={16} />
      </button>

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-blue-50 text-blue-600">
            <Droplets size={20} />
          </span>
          <div>
            <h2
              id="faucet-modal-title"
              className="text-lg font-light text-brand-navy leading-tight m-0"
            >
              Faucet
            </h2>
            <p className="text-xs text-gray-500 m-0">Canton DevNet</p>
          </div>
        </div>

        {/* Status */}
        <div className="mb-4">
          {step === "idle" && (
            <p className="text-sm text-gray-600 m-0">
              Mint free Canton Coin (CC) tokens to your wallet for testing on the DevNet.
            </p>
          )}
          {step === "minting" && (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Loader2 size={14} className="animate-spin" />
              Minting tokens...
            </div>
          )}
          {step === "done" && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 size={14} />
              1,000 CC minted successfully!
            </div>
          )}
          {step === "error" && (
            <div className="text-sm text-red-600">{error}</div>
          )}
        </div>

        {/* Mint button */}
        <motion.button
          type="button"
          onClick={handleMint}
          disabled={step === "minting" || step === "done"}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-5 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step === "minting" ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Minting...
            </>
          ) : step === "done" ? (
            <>
              <CheckCircle2 size={14} />
              Minted
            </>
          ) : (
            <>
              <Droplets size={14} />
              Mint 1,000 CC
            </>
          )}
        </motion.button>
      </div>
    </Modal>
  );
}
