"use client";

/**
 * useWalletMode — CLI-only wallet state.
 *
 * Provides: { connected, cliPartyId, connect, disconnect }
 * No Loop wallet — CLI only.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { cli } from "@/lib/cli";

interface WalletModeValue {
  connected: boolean;
  cliPartyId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  checking: boolean;
}

const WalletModeContext = createContext<WalletModeValue | null>(null);

export function WalletModeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [cliPartyId, setCliPartyId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Check CLI availability on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await cli.health();
        const status = await cli.wallet.status();
        if (!cancelled && status.exists && status.partyId) {
          setConnected(true);
          setCliPartyId(status.partyId);
        }
      } catch {
        // CLI not reachable
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(async () => {
    await cli.health();
    const status = await cli.wallet.status();
    let partyId = status.partyId;
    if (!status.exists) {
      const created = await cli.wallet.create();
      partyId = created.partyId;
    }
    setConnected(true);
    setCliPartyId(partyId!);
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setCliPartyId(null);
  }, []);

  return (
    <WalletModeContext.Provider value={{ connected, cliPartyId, connect, disconnect, checking }}>
      {children}
    </WalletModeContext.Provider>
  );
}

export function useWalletMode(): WalletModeValue {
  const ctx = useContext(WalletModeContext);
  if (!ctx) throw new Error("useWalletMode must be used within WalletModeProvider");
  return ctx;
}
