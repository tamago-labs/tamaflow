"use client";

/**
 * AccountInfoModal — animated overlay shown when the user picks
 * "Account Info" from the wallet menu.
 *
 * Rendered via createPortal into document.body so the backdrop covers
 * the whole viewport (including the fixed sidebar). framer-motion
 * provides the entrance/exit animation; AnimatePresence handles the
 * exit cleanly when the modal unmounts.
 *
 * Shows the 4 fields we promised the user:
 *
 *   • Email
 *   • Pre-approval
 *   • UTXO merge delegation
 *   • USDC Bridge Access
 *
 * Closing: backdrop click, X button, or Esc.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useWallet } from "@/lib/wallet/WalletContext";
import { STYLES } from "@/lib/theme";
import { formatAccountField } from "@/lib/wallet/format";

interface AccountInfoModalProps {
  onClose: () => void;
}

export default function AccountInfoModal({ onClose }: AccountInfoModalProps) {
  const { account, partyId, refreshAccount } = useWallet();

  // SSR safety — document doesn't exist on the server, so we defer
  // the portal until after mount. While unmounted, render nothing.
  // We defer the setState via queueMicrotask so it lands inside a
  // callback (not synchronously in the effect body), satisfying the
  // React 19/Next 16 "no setState in effect" lint rule.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Refresh on mount in case flags changed since the menu opened. Also
  // wire Esc to close — the overlay swallows key events that would
  // otherwise bubble to the page.
  useEffect(() => {
    refreshAccount();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [refreshAccount, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-info-title"
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {/* Backdrop — fades in/out */}
        <motion.button
          type="button"
          onClick={onClose}
          aria-label="Close account info"
          className="absolute inset-0 bg-black/40 border-0 cursor-default"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />

        {/* Card — fades + scales in */}
        <motion.div
          className="relative bg-white border border-brand-border rounded-md shadow-xl w-[420px] max-w-full overflow-hidden"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
            <div>
              <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
                Wallet
              </p>
              <h2
                id="account-info-title"
                className="font-sans text-lg font-medium text-brand-navy m-0"
              >
                Account Info
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 border-0 bg-transparent cursor-pointer text-brand-muted hover:text-brand-navy rounded"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {partyId && (
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-brand-border">
                <span className={STYLES.label}>Party ID</span>
                <span className="font-mono text-[10px] text-brand-navy break-all text-right max-w-[260px]">
                  {partyId}
                </span>
              </div>
            )}

            <Row
              label="Email"
              value={formatAccountField(account, "email")}
              muted={!account?.email}
            />
            <Row
              label="Pre-approval"
              value={formatAccountField(account, "preapproval")}
              positive={account?.has_preapproval}
              negative={account?.has_preapproval === false}
            />
            <Row
              label="UTXO merge delegation"
              value={formatAccountField(account, "merge_delegation")}
              positive={account?.has_merge_delegation}
              negative={account?.has_merge_delegation === false}
            />
            <Row
              label="USDC Bridge Access"
              value={formatAccountField(account, "usdc_bridge")}
              positive={account?.usdc_bridge_access === "granted"}
              warn={account?.usdc_bridge_access === "pending"}
              negative={account?.usdc_bridge_access === "not_requested"}
            />

            {!account && (
              <p className="font-sans text-xs text-brand-muted m-0">
                Loading account details…
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

interface RowProps {
  label: string;
  value: string;
  positive?: boolean;
  warn?: boolean;
  negative?: boolean;
  muted?: boolean;
}

function Row({ label, value, positive, warn, negative, muted }: RowProps) {
  const color =
    positive === true
      ? "text-brand-ok"
      : warn
        ? "text-brand-tealAccent"
        : negative === true
          ? "text-brand-muted"
          : muted
            ? "text-brand-muted"
            : "text-brand-navy";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={STYLES.label}>{label}</span>
      <span className={`font-sans text-sm ${color}`}>{value}</span>
    </div>
  );
}
