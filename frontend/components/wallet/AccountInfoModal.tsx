"use client";

/**
 * AccountInfoModal — animated overlay shown when the user picks
 * "Account Info" from the wallet menu.
 *
 * Rendered via the shared `<Modal>` (which portals to `document.body`
 * and handles backdrop / entry animation / Escape / scroll lock).
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
import { useEffect } from "react";
import { X } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { useWallet } from "@/lib/wallet/WalletContext";
import { STYLES } from "@/lib/theme";
import { formatAccountField } from "@/lib/wallet/format";

interface AccountInfoModalProps {
  onClose: () => void;
}

export default function AccountInfoModal({ onClose }: AccountInfoModalProps) {
  const { account, partyId, refreshAccount } = useWallet();

  // Refresh on mount in case flags changed since the menu opened.
  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  return (
    <Modal open onClose={onClose} ariaLabelledBy="account-info-title">
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
    </Modal>
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