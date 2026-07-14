"use client";

import React, { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { useWalletMode } from "@/lib/wallet/useWalletMode";
import { cli } from "@/lib/cli";

interface AccountInfoModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AccountInfoModal({ open, onClose }: AccountInfoModalProps) {
  const { cliPartyId } = useWalletMode();
  const [copied, setCopied] = useState(false);
  const [accountInfo, setAccountInfo] = useState<Record<string, unknown> | null>(null);

  const fetchAccountInfo = async () => {
    try {
      const info = await cli.account.info();
      setAccountInfo(info);
    } catch (e) {
      console.error("[AccountInfo] Failed to fetch:", e);
    }
  };

  // Fetch account info when modal opens
  if (open && !accountInfo) {
    fetchAccountInfo();
  }

  const handleCopy = async () => {
    if (cliPartyId) {
      await navigator.clipboard.writeText(cliPartyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-md"
      ariaLabelledBy="account-info-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-md text-brand-muted hover:text-brand-navy hover:bg-brand-light transition-colors z-10"
      >
        <X size={16} />
      </button>

      <div className="p-6 lg:p-8">
        <h2
          id="account-info-title"
          className="text-xl font-light text-brand-navy leading-tight m-0 mb-4"
        >
          Account Info
        </h2>

        {/* Party ID */}
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Party ID</p>
          <div className="flex items-center gap-2 bg-gray-50 rounded-md p-2">
            <code className="flex-1 font-mono text-[10px] text-gray-700 break-all leading-tight">{cliPartyId}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
              title="Copy party ID"
            >
              {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-gray-500" />}
            </button>
          </div>
        </div>

        {/* Account details */}
        {accountInfo && (
          <div className="space-y-2">
            {accountInfo.fingerprint ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Fingerprint</p>
                <p className="font-mono text-xs text-gray-700 break-all">{accountInfo.fingerprint as React.ReactNode}</p>
              </div>
            ) : null}
            {accountInfo.publicKey ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 mb-1">Public Key</p>
                <p className="font-mono text-xs text-gray-700 break-all">{accountInfo.publicKey as React.ReactNode}</p>
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-brand-blue px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
