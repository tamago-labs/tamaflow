"use client";

/**
 * WalletContext — the single source of truth for Loop SDK state in the
 * TamaFlow web app.
 *
 * Lifecycle
 * ---------
 * On mount (client only):
 *   1. `loop.init({ ... })` — registers the onAccept / onReject callbacks.
 *   2. `loop.autoConnect()` — silent; resumes from localStorage if possible.
 *
 * The `useRef` guard prevents double-init under React 19 StrictMode in dev.
 * The SDK's `init()` replaces the previous callbacks when called twice, but
 * the WebSocket subscription is not, so a guard is the safer pattern.
 *
 * State
 * -----
 *   status:           idle → connecting → connected (or error)
 *   provider:         the SDK's Provider object once `onAccept` fires
 *   account:          cached `provider.getAccount()` result (for the modal)
 *   holdings:         cached `provider.getHolding()` array (for the dashboard)
 *   error:            last surfaced error string (clears on next connect)
 *   isAutoConnecting: true during the silent `autoConnect()` call so the
 *                     connect button can show "Resuming…" without flashing
 *
 * SSR safety
 * ----------
 * `loop.init()` throws unless window/document/localStorage exist. Everything
 * here lives behind a "use client" directive and an effect, so server renders
 * are safe. The default context value is a no-op stub so a hook call in an
 * unusual environment (test, story) doesn't crash.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loop } from "@fivenorth/loop-sdk";
import type {
  Account,
  Holding,
  HoldingFormatted,
  WalletProvider,
  WalletStatus,
} from "./types";
import { formatHolding } from "./format";

type WalletContextValue = {
  status: WalletStatus;
  provider: WalletProvider | null;
  partyId: string | null;
  account: Account | null;
  holdings: HoldingFormatted[];
  error: string | null;
  isAutoConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshAccount: () => Promise<void>;
  refreshHoldings: () => Promise<void>;
};

const noop = () => {};
const noopAsync = async () => {};

const defaultValue: WalletContextValue = {
  status: "idle",
  provider: null,
  partyId: null,
  account: null,
  holdings: [],
  error: null,
  isAutoConnecting: false,
  connect: noopAsync,
  disconnect: noop,
  refreshAccount: noopAsync,
  refreshHoldings: noopAsync,
};

const WalletContext = createContext<WalletContextValue>(defaultValue);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [provider, setProvider] = useState<WalletProvider | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [holdings, setHoldings] = useState<HoldingFormatted[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAutoConnecting, setIsAutoConnecting] = useState(true);

  // Refs that don't drive renders but need to outlive renders. The init
  // guard ensures we only call `loop.init()` once across StrictMode's
  // intentional double-mount in dev.
  const initedRef = useRef(false);
  const providerRef = useRef<WalletProvider | null>(null);

  useEffect(() => {
    if (initedRef.current) return;
    if (typeof window === "undefined") return;
    initedRef.current = true;

    try {
      loop.init({
        appName: "TamaFlow",
        network: "devnet",
        onAccept: (prov: WalletProvider) => {
          providerRef.current = prov;
          setProvider(prov);
          setStatus("connected");
          setError(null);
          // Best-effort: pre-populate account so the modal has data the
          // moment the user clicks "Account Info". Holdings are loaded
          // on demand by the dashboard so we don't hammer the backend.
          prov
            .getAccount()
            .then((acc) => setAccount(acc))
            .catch((err) => {
              console.warn("[WalletContext] getAccount failed", err);
            });
        },
        onReject: () => {
          setStatus("idle");
          setError("Connection rejected.");
        },
        onTransactionUpdate: (payload) => {
          // No-op for now; the dashboard will subscribe to specific
          // settlement events later. We log so devs can see updates.
          console.debug("[WalletContext] transaction update", payload);
        },
        options: {
          openMode: "popup",
          requestSigningMode: "popup",
        },
      });

      // Silent resume from a previous session. Resolves with no UI when
      // there's nothing to restore; if a session is found, onAccept fires
      // synchronously inside autoConnect. The setIsAutoConnecting(false)
      // happens inside the .finally callback (an async microtask) so we
      // don't violate the "no setState in effect body" lint rule.
      loop
        .autoConnect()
        .catch((err) => {
          // autoConnect throws if there's no session — that's expected
          // on first visit, not an error worth surfacing.
          console.debug("[WalletContext] autoConnect skipped", err);
        })
        .finally(() => {
          setIsAutoConnecting(false);
        });
    } catch (err) {
      // init() throws on the server. We've already guarded with
      // `typeof window`, so any throw here is a real init failure.
      // We defer the state updates with queueMicrotask so the setState
      // calls happen inside a callback (not synchronously in the effect
      // body) — that's what the React 19/Next 16 lint rule expects.
      console.error("[WalletContext] init failed", err);
      const message =
        err instanceof Error ? err.message : "Failed to initialize wallet SDK.";
      queueMicrotask(() => {
        setStatus("error");
        setError(message);
        setIsAutoConnecting(false);
      });
    }
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      await loop.connect();
      // Status flips to "connected" inside onAccept. We don't set it here
      // because the QR/popup is still waiting on user approval.
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to start wallet connection.");
    }
  }, []);

  const disconnect = useCallback(() => {
    try {
      loop.logout();
    } catch (err) {
      console.warn("[WalletContext] logout threw", err);
    }
    providerRef.current = null;
    setProvider(null);
    setAccount(null);
    setHoldings([]);
    setStatus("idle");
    setError(null);
  }, []);

  const refreshAccount = useCallback(async () => {
    const prov = providerRef.current;
    if (!prov) return;
    try {
      const acc = await prov.getAccount();
      setAccount(acc);
    } catch (err) {
      console.warn("[WalletContext] refreshAccount failed", err);
      setError(err instanceof Error ? err.message : "Failed to load account info.");
    }
  }, []);

  const refreshHoldings = useCallback(async () => {
    const prov = providerRef.current;
    if (!prov) return;
    try {
      const raw: Holding[] = await prov.getHolding();
      setHoldings(raw.map(formatHolding));
    } catch (err) {
      console.warn("[WalletContext] refreshHoldings failed", err);
      setError(err instanceof Error ? err.message : "Failed to load holdings.");
    }
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      provider,
      partyId: provider?.party_id ?? null,
      account,
      holdings,
      error,
      isAutoConnecting,
      connect,
      disconnect,
      refreshAccount,
      refreshHoldings,
    }),
    [
      status,
      provider,
      account,
      holdings,
      error,
      isAutoConnecting,
      connect,
      disconnect,
      refreshAccount,
      refreshHoldings,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  return useContext(WalletContext);
}
