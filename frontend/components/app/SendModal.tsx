"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, CheckCircle2, Send, AlertTriangle } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { cli } from "@/lib/cli";

interface SendModalProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  balance?: string;
  symbol?: string;
}

export default function SendModal({
  open,
  onClose,
  onSent,
  balance = "0",
  symbol = "CC",
}: SendModalProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    updateId?: string;
    amount?: string;
    recipient?: string;
  } | null>(null);

  const canSubmit =
    step === "idle" &&
    recipient.trim().length >= 10 &&
    !!amount.trim() &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= parseFloat(balance);

  const handleSend = async () => {
    if (!canSubmit) return;
    setStep("sending");
    setError("");
    try {
      const r = await cli.assets.transfer({
        recipient: recipient.trim(),
        amount: amount.trim(),
        memo: memo.trim() || undefined,
      });
      if (r.success) {
        setResult({
          updateId: r.updateId,
          amount: r.amount,
          recipient: r.recipient,
        });
        setStep("done");
        onSent();
      } else {
        setError(r.error || "Transfer failed");
        setStep("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
      setStep("error");
    }
  };

  const handleClose = () => {
    setStep("idle");
    setRecipient("");
    setAmount("");
    setMemo("");
    setError("");
    setResult(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      maxWidth="max-w-md"
      ariaLabelledBy="send-modal-title"
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
            <Send size={20} />
          </span>
          <div>
            <h2
              id="send-modal-title"
              className="text-lg font-light text-brand-navy leading-tight m-0"
            >
              Send {symbol}
            </h2>
            <p className="text-xs text-gray-500 m-0">
              Balance: {parseFloat(balance).toLocaleString()} {symbol}
            </p>
          </div>
        </div>

        {step === "idle" && (
          <div className="space-y-4">
            {/* Recipient */}
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-brand-muted">
                Recipient Party ID
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="party-hint::1220abcd..."
                className="w-full rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-brand-muted">
                Amount
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-sm text-brand-navy focus:border-brand-blue focus:outline-none"
                />
                <span className="font-mono text-sm font-bold text-brand-muted">
                  {symbol}
                </span>
              </div>
              {amount && parseFloat(amount) > parseFloat(balance) && (
                <p className="mt-1 text-xs text-red-600 m-0">
                  Insufficient balance
                </p>
              )}
            </div>

            {/* Memo */}
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-brand-muted">
                Memo <span className="normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="e.g. payroll-2026-06"
                className="w-full rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
              />
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 m-0">
                The recipient must accept the pending transfer within 24 hours.
              </p>
            </div>
          </div>
        )}

        {step === "sending" && (
          <div className="flex items-center gap-2 text-sm text-blue-700 py-4">
            <Loader2 size={14} className="animate-spin" />
            Sending transfer...
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-2 rounded-md border border-brand-border bg-brand-light p-3">
            <div className="flex items-center gap-2 text-sm text-brand-teal font-semibold">
              <CheckCircle2 size={14} />
              Transfer Submitted
            </div>
            <p className="text-xs text-brand-navy m-0">
              Sent {result.amount} {symbol} to{" "}
              <span className="break-all font-mono text-[11px]">
                {result.recipient}
              </span>
            </p>
            {result.updateId && (
              <p className="break-all font-mono text-[10px] text-brand-muted m-0">
                update: {result.updateId}
              </p>
            )}
            <p className="text-[11px] text-brand-muted m-0">
              The recipient must accept the pending transfer to claim the funds.
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700 m-0">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={step === "sending"}
            className="rounded-md border border-brand-border bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-brand-navy hover:bg-brand-light disabled:opacity-50"
          >
            {step === "done" ? "Close" : "Cancel"}
          </button>
          {step === "idle" && (
            <motion.button
              type="button"
              onClick={handleSend}
              disabled={!canSubmit}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-blue px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={12} />
              Send
            </motion.button>
          )}
        </div>
      </div>
    </Modal>
  );
}
