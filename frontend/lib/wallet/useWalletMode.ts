"use client";

/**
 * useWalletMode — Hook for switching between Loop and CLI wallet modes.
 * 
 * Stores the selected mode in localStorage and provides auto-creation
 * for CLI wallets.
 */

import { useCallback, useEffect, useState } from "react";
import { cli } from "../cli";

export type WalletMode = "loop" | "cli";

interface WalletModeValue {
  mode: WalletMode;
  setMode: (mode: WalletMode) => void;
  cliAvailable: boolean;
  cliPartyId: string | null;
  ensureCliWallet: () => Promise<string | null>;
}

export function useWalletMode(): WalletModeValue {
  const [mode, setModeState] = useState<WalletMode>("loop");
  const [cliAvailable, setCliAvailable] = useState(false);
  const [cliPartyId, setCliPartyId] = useState<string | null>(null);

  // Check CLI availability on mount
  useEffect(() => {
    cli.health()
      .then(() => {
        setCliAvailable(true);
        // Auto-create wallet if CLI is available and no wallet exists
        cli.wallet.status().then((status) => {
          if (status.exists) {
            setCliPartyId(status.partyId);
          }
        });
      })
      .catch(() => setCliAvailable(false));
  }, []);

  const setMode = useCallback(async (newMode: WalletMode) => {
    setModeState(newMode);
    localStorage.setItem("walletMode", newMode);

    // Auto-create CLI wallet when switching to CLI mode
    if (newMode === "cli" && cliAvailable) {
      try {
        const status = await cli.wallet.status();
        if (!status.exists) {
          const result = await cli.wallet.create();
          if (result.success) {
            setCliPartyId(result.partyId);
            console.log("[useWalletMode] CLI wallet created:", result.partyId);
          }
        } else {
          setCliPartyId(status.partyId);
        }
      } catch (err) {
        console.error("[useWalletMode] Failed to create CLI wallet:", err);
      }
    }
  }, [cliAvailable]);

  const ensureCliWallet = useCallback(async (): Promise<string | null> => {
    try {
      const status = await cli.wallet.status();
      if (status.exists) {
        setCliPartyId(status.partyId);
        return status.partyId;
      }
      // Auto-create wallet
      const result = await cli.wallet.create();
      if (result.success) {
        setCliPartyId(result.partyId);
        return result.partyId;
      }
      return null;
    } catch (err) {
      console.error("[useWalletMode] Failed to ensure CLI wallet:", err);
      return null;
    }
  }, []);

  // Load saved mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("walletMode") as WalletMode;
    if (saved === "loop" || saved === "cli") {
      setModeState(saved);
    }
  }, []);

  return {
    mode,
    setMode,
    cliAvailable,
    cliPartyId,
    ensureCliWallet,
  };
}
