"use client";

/**
 * HoldingsCard — dashboard "My Tokens" island. Reads `holdings` from
 * `useWallet()` and shows either:
 *
 *   • Not connected  → "Connect wallet to view holdings" CTA
 *   • Connected, no tokens → "No tokens yet" + Refresh button
 *   • Has tokens → list of holdings (icon, symbol, unlocked, locked)
 *
 * Holdings are loaded on demand via the Refresh button — we don't poll and
 * we don't auto-fetch on mount (the React 19/Next 16 lint rule forbids
 * setState in effect bodies, and pre-fetching on every dashboard visit
 * would hammer the wallet backend for no real benefit).
 */
import { useState } from "react";
import { Coins, Loader2, RefreshCw, Wallet } from "lucide-react";
import { useWallet } from "@/lib/wallet/WalletContext";
import { STYLES } from "@/lib/theme";

export default function HoldingsCard() {
  const { status, holdings, refreshHoldings, connect } = useWallet();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshHoldings();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className={`${STYLES.card} p-6 mb-6 max-w-3xl`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mb-1">
            My Tokens
          </p>
          <h3 className="font-sans text-lg font-medium text-brand-navy m-0">
            Holdings
          </h3>
        </div>
        {status === "connected" && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reload holdings from the ledger"
          >
            {isRefreshing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Refresh
          </button>
        )}
      </div>

      {status !== "connected" ? (
        <EmptyState
          icon={<Wallet size={20} />}
          title="Connect wallet to view holdings"
          body="Link a Canton wallet to see your token balances on this network."
          cta={
            <button
              type="button"
              onClick={connect}
              className={STYLES.buttonPrimary}
            >
              <Wallet size={12} />
              Connect Wallet
            </button>
          }
        />
      ) : holdings.length === 0 ? (
        <EmptyState
          icon={<Coins size={20} />}
          title="No tokens yet"
          body={
            isRefreshing
              ? "Loading…"
              : "Once tokens are minted to your wallet they'll show up here."
          }
        />
      ) : (
        <ul className="divide-y divide-brand-border -mx-2">
          {holdings.map((h) => {
            const key = `${h.instrumentId.admin}::${h.instrumentId.id}`;
            return (
              <li
                key={key}
                className="flex items-center gap-4 px-2 py-3"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-light border border-brand-border font-mono text-[11px] font-bold text-brand-navy"
                  aria-hidden="true"
                >
                  {h.symbol.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-brand-navy m-0">
                    {h.symbol}
                  </p>
                  <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
                    {h.orgName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-brand-navy m-0">
                    {h.unlocked} {h.symbol}
                  </p>
                  {h.locked !== "0.0000000000" && h.locked !== "0" && (
                    <p className="font-mono text-[10px] text-brand-muted m-0">
                      locked {h.locked}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: React.ReactNode;
}

function EmptyState({ icon, title, body, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-6 gap-2">
      <div className="w-10 h-10 rounded-full bg-brand-light border border-brand-border flex items-center justify-center text-brand-muted">
        {icon}
      </div>
      <p className="font-sans text-sm font-medium text-brand-navy m-0">
        {title}
      </p>
      <p className="font-sans text-xs text-brand-muted m-0 max-w-sm">
        {body}
      </p>
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  );
}
