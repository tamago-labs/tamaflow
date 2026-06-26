"use client";

/**
 * ReceiveModal — shown when the user picks "Receive" from the wallet
 * menu. Displays a QR code of the wallet's party ID so another party
 * can scan it to send funds. The party ID is also rendered in plain
 * text for wallets that prefer to paste.
 *
 * QR is generated client-side via `qrcode.toDataURL` and rendered as
 * an <img>. The encoded payload is just the raw party ID — Canton
 * wallets are expected to parse it as a destination party.
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { useWallet } from "@/lib/wallet/WalletContext";
import CopyButton from "./CopyButton";

interface ReceiveModalProps {
  onClose: () => void;
}

export default function ReceiveModal({ onClose }: ReceiveModalProps) {
  const { partyId } = useWallet();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Re-render the QR whenever the party ID changes.
  useEffect(() => {
    if (!partyId) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(partyId, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
      color: { dark: "#0a0a5c", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("[ReceiveModal] QR generation failed", err);
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [partyId]);

  return (
    <Modal open onClose={onClose} ariaLabelledBy="receive-title" maxWidth="max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
        <div>
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
            Wallet
          </p>
          <h2
            id="receive-title"
            className="font-sans text-lg font-medium text-brand-navy m-0"
          >
            Receive
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
        <p className="font-sans text-xs text-brand-muted m-0 leading-relaxed">
          Senders can scan the QR or paste the party ID below to transfer
          Amulet (CC) or other Canton instruments to this wallet.
        </p>

        {/* QR code */}
        <div className="flex items-center justify-center p-4 bg-brand-light border border-brand-border rounded-md">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for party ${partyId}`}
              width={256}
              height={256}
              className="block w-64 h-64"
            />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center">
              <p className="font-mono text-[10px] tracking-wider2 uppercase text-brand-muted">
                {partyId ? "Generating…" : "No wallet connected"}
              </p>
            </div>
          )}
        </div>

        {/* Party ID + copy */}
        {partyId && (
          <div className="flex items-center justify-between gap-3 p-3 bg-brand-light border border-brand-border rounded-md">
            <div className="min-w-0 flex-1">
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

        <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
          Network · DevNet
        </p>
      </div>
    </Modal>
  );
}