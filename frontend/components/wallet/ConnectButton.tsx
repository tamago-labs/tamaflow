"use client";

/**
 * ConnectButton — the only place in the app that initiates a wallet
 * connection. Three render branches:
 *
 *   1. `connected`  → shows the truncated party ID + a copy button + a
 *                     chevron that opens the wallet menu.
 *   2. `connecting` → disabled "Connecting…" with a spinning loader.
 *   3. idle / error → the brand outline button.
 *
 * The error string (if any) renders in a single line below the button so
 * we don't have to add a separate toast system. The next click clears it.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, LogIn, X } from "lucide-react";
import { useWallet } from "@/lib/wallet/WalletContext";
import { STYLES } from "@/lib/theme";
import { truncateParty } from "@/lib/wallet/format";
import CopyButton from "./CopyButton";
import WalletMenu from "./WalletMenu";

export default function ConnectButton() {
  const { status, partyId, error, connect, isAutoConnecting } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close the menu on outside click. We use a native mousedown listener
  // rather than a backdrop element so clicks anywhere on the page close it.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // The autoConnect phase is essentially a silent "we're checking for a
  // saved session" — render a subtle disabled state so the button doesn't
  // appear clickable but is still recognisable.
  if (status === "connected" && partyId) {
    return (
      <div ref={wrapperRef} className="relative">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setMenuOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setMenuOpen((v) => !v);
            }
          }}
          className="flex items-center gap-2 py-1.5 pl-2.5 pr-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-1"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="font-sans text-[11px] font-medium tracking-normal text-brand-navy">
            {truncateParty(partyId)}
          </span>
          <span className="w-px h-3 bg-brand-border" aria-hidden="true" />
          <CopyButton
            value={partyId}
            label="Copy party ID"
            className="-mr-1"
          />
          <ChevronDown size={12} className="text-brand-muted" />
        </div>
        {menuOpen && <WalletMenu onClose={() => setMenuOpen(false)} />}
      </div>
    );
  }

  if (status === "connecting" || isAutoConnecting) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center gap-1.5 py-1.5 px-3 border border-brand-blue text-brand-blue bg-white rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase opacity-60 cursor-not-allowed"
      >
        <Loader2 size={12} className="animate-spin" />
        {isAutoConnecting ? "Resuming…" : "Connecting…"}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={connect}
        className={STYLES.buttonOutlineBlue}
      >
        <LogIn size={12} />
        Login
      </button>
      {status === "error" && error && (
        <span
          className="font-mono text-[9px] text-brand-err tracking-wider2 uppercase flex items-center gap-1 max-w-[260px]"
          title={error}
        >
          <X size={10} className="flex-shrink-0" />
          <span className="truncate">{error}</span>
        </span>
      )}
    </div>
  );
}
