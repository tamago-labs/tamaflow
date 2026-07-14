"use client";

/**
 * useWalletMode — CLI wallet state with P2P tracking.
 *
 * Provides: { connected, cliPartyId, p2pConnected, connect, disconnect, checking }
 * No Loop wallet — CLI only.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { cli } from "@/lib/cli";

interface WalletModeValue {
  connected: boolean;
  cliPartyId: string | null;
  p2pConnected: boolean;
  connect: (inviteCode?: string) => Promise<void>;
  disconnect: () => void;
  checking: boolean;
}

const WalletModeContext = createContext<WalletModeValue | null>(null);

export function WalletModeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [cliPartyId, setCliPartyId] = useState<string | null>(null);
  const [p2pConnected, setP2pConnected] = useState(false);
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
          // Check P2P status
          const roomStatus = await cli.room.status();
          if (!cancelled && roomStatus.connected) {
            setP2pConnected(true);
          }
        }
      } catch {
        // CLI not reachable
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(async (inviteCode?: string) => {
    await cli.health();
    const status = await cli.wallet.status();
    let partyId = status.partyId;
    if (!status.exists) {
      const created = await cli.wallet.create();
      partyId = created.partyId;
    }
    setConnected(true);
    setCliPartyId(partyId!);

    // Join P2P if invite code provided
    if (inviteCode) {
      try {
        await cli.room.connect(inviteCode);
        setP2pConnected(true);
      } catch (e) {
        console.error("[useWalletMode] P2P connect failed:", e);
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setCliPartyId(null);
    setP2pConnected(false);
  }, []);

  return (
    <WalletModeContext.Provider value={{ connected, cliPartyId, p2pConnected, connect, disconnect, checking }}>
      {children}
    </WalletModeContext.Provider>
  );
}

export function useWalletMode(): WalletModeValue {
  const ctx = useContext(WalletModeContext);
  if (!ctx) throw new Error("useWalletMode must be used within WalletModeProvider");
  return ctx;
}
