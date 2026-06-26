"use client";

/**
 * WalletMenu — popover anchored to the connect button when the wallet is
 * connected. Three items:
 *
 *   • Receive       — opens the ReceiveModal (QR + party ID)
 *   • Account Info  — opens the AccountInfoModal
 *   • Disconnect    — calls useWallet().disconnect()
 *
 * The parent passes `onClose` so menu-item clicks can dismiss it; outside
 * clicks are handled by ConnectButton's own mousedown listener.
 */
import { LogOut, QrCode, UserCircle2 } from "lucide-react";
import { useWallet } from "@/lib/wallet/WalletContext";
import AccountInfoModal from "./AccountInfoModal";
import ReceiveModal from "./ReceiveModal";
import { useState } from "react";

interface WalletMenuProps {
  onClose: () => void;
}

export default function WalletMenu({ onClose }: WalletMenuProps) {
  const { disconnect, refreshAccount } = useWallet();
  const [infoOpen, setInfoOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  const handleOpenAccount = () => {
    // Refresh on open in case flags have changed since connect (e.g. user
    // granted pre-approval in their wallet between page loads).
    refreshAccount();
    setInfoOpen(true);
  };

  return (
    <>
      <div
        role="menu"
        className="absolute right-0 top-full mt-2 min-w-[180px] bg-white border border-brand-border rounded-md shadow-lg overflow-hidden z-50"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => setReceiveOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-transparent border-0 cursor-pointer font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-navy hover:bg-brand-light"
        >
          <QrCode size={12} />
          Receive Funds
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={handleOpenAccount}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-transparent border-0 cursor-pointer font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-navy hover:bg-brand-light"
        >
          <UserCircle2 size={12} />
          Account Info
        </button>
        <div className="h-px bg-brand-border" />
        <button
          type="button"
          role="menuitem"
          onClick={handleDisconnect}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-transparent border-0 cursor-pointer font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-err hover:bg-brand-light"
        >
          <LogOut size={12} />
          Disconnect
        </button>
      </div>
      {infoOpen && (
        <AccountInfoModal
          onClose={() => {
            setInfoOpen(false);
            onClose();
          }}
        />
      )}
      {receiveOpen && (
        <ReceiveModal
          onClose={() => {
            setReceiveOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}