"use client";

/**
 * AccountIsland — the in-place content for the Settings → Wallet tab.
 * Reuses useWallet() so the same connection state powers the top bar.
 *
 * Shows:
 *   • Connection status pill + Connect/Disconnect button
 *   • Same 4 account fields the modal shows, as a static form
 *   • Party ID with copy button
 *
 * The island is intentionally verbose — settings pages should be readable
 * without a popover hunt.
 */
import { CheckCircle2, Copy, Loader2, Power, Wallet, XCircle } from "lucide-react";
import { useWallet } from "@/lib/wallet/WalletContext";
import { STYLES } from "@/lib/theme";
import { formatAccountField, truncateParty } from "@/lib/wallet/format";
import CopyButton from "./CopyButton";

export default function AccountIsland() {
  const {
    status,
    partyId,
    account,
    error,
    isAutoConnecting,
    connect,
    disconnect,
    refreshAccount,
  } = useWallet();

  const isConnected = status === "connected";
  const isBusy = status === "connecting" || isAutoConnecting;

  return (
    <div className={STYLES.card + " p-6 max-w-2xl"}>
      {/* Header + status */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mb-1">
            Canton Wallet
          </p>
          <h3 className="font-sans text-lg font-medium text-brand-navy m-0">
            {isConnected ? "Connected" : "Not connected"}
          </h3>
        </div>
        <StatusPill isConnected={isConnected} isBusy={isBusy} />
      </div>

      {error && status === "error" && (
        <div className="mb-5 p-3 bg-brand-errBg border border-brand-errBorder rounded-md flex items-start gap-2">
          <XCircle size={14} className="text-brand-err flex-shrink-0 mt-0.5" />
          <p className="font-sans text-xs text-brand-errDark m-0 break-all">
            {error}
          </p>
        </div>
      )}

      {/* Connect / Disconnect */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {isConnected ? (
          <button
            type="button"
            onClick={disconnect}
            className="flex items-center gap-1.5 py-2 px-4 bg-white text-brand-err border border-brand-err rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-errBg"
          >
            <Power size={12} />
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={isBusy}
            className={STYLES.buttonPrimary + " disabled:opacity-50 disabled:cursor-not-allowed"}
          >
            {isBusy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Wallet size={12} />
            )}
            {isBusy ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
        {isConnected && (
          <button
            type="button"
            onClick={refreshAccount}
            className={STYLES.buttonSecondary}
          >
            Refresh Info
          </button>
        )}
      </div>

      {/* Party ID */}
      {partyId && (
        <div className="mb-6 p-4 bg-brand-light border border-brand-border rounded-md flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mb-1">
              Party ID
            </p>
            <p className="font-mono text-xs text-brand-navy m-0 break-all">
              {partyId}
            </p>
          </div>
          <CopyButton value={partyId} label="Copy party ID" />
        </div>
      )}

      {/* Account details */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className={STYLES.label}>Account Details</p>
          {isConnected && (
            <span className="font-mono text-[10px] text-brand-muted tracking-wider2 uppercase">
              {truncateParty(partyId)}
            </span>
          )}
        </div>
        <div className="divide-y divide-brand-border border border-brand-border rounded-md">
          <DetailRow
            label="Email"
            value={formatAccountField(account, "email")}
          />
          <DetailRow
            label="Pre-approval"
            value={formatAccountField(account, "preapproval")}
            positive={account?.has_preapproval}
            negative={account ? account.has_preapproval === false : false}
          />
          <DetailRow
            label="UTXO merge delegation"
            value={formatAccountField(account, "merge_delegation")}
            positive={account?.has_merge_delegation}
            negative={account ? account.has_merge_delegation === false : false}
          />
          <DetailRow
            label="USDC Bridge Access"
            value={formatAccountField(account, "usdc_bridge")}
            positive={account?.usdc_bridge_access === "granted"}
            warn={account?.usdc_bridge_access === "pending"}
            negative={account?.usdc_bridge_access === "not_requested"}
          />
        </div>
        {!account && isConnected && (
          <p className="font-sans text-xs text-brand-muted m-0 mt-3">
            Loading account details…
          </p>
        )}
        {!isConnected && (
          <p className="font-sans text-xs text-brand-muted m-0 mt-3">
            Connect your wallet to see your email, pre-approval status, UTXO
            merge delegation, and USDC bridge access.
          </p>
        )}
      </div>
    </div>
  );
}

interface StatusPillProps {
  isConnected: boolean;
  isBusy: boolean;
}

function StatusPill({ isConnected, isBusy }: StatusPillProps) {
  if (isBusy) {
    return (
      <span className={STYLES.pillBlue}>
        <Loader2 size={10} className="mr-1.5 animate-spin" />
        {isConnected ? "Resuming…" : "Connecting…"}
      </span>
    );
  }
  if (isConnected) {
    return (
      <span className={STYLES.pillOk}>
        <CheckCircle2 size={10} className="mr-1.5" />
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center font-mono text-[10px] font-bold rounded-full px-2.5 py-0.5 tracking-wider2 uppercase border border-brand-border text-brand-muted bg-brand-light">
      <Copy size={10} className="mr-1.5" />
      Offline
    </span>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  positive?: boolean;
  warn?: boolean;
  negative?: boolean;
}

function DetailRow({ label, value, positive, warn, negative }: DetailRowProps) {
  const color =
    positive === true
      ? "text-brand-ok"
      : warn
        ? "text-brand-tealAccent"
        : negative === true
          ? "text-brand-muted"
          : "text-brand-navy";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className={STYLES.label}>{label}</span>
      <span className={`font-sans text-sm ${color}`}>{value}</span>
    </div>
  );
}
