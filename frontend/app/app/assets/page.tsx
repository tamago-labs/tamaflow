"use client";

/**
 * Assets Page — Employee's tokenized portfolio on Canton.
 * CLI wallet only. Shows pending transfers + holdings.
 */

import { useCallback, useContext, useEffect, useState } from "react";
import { RefreshCw, Check, X, ArrowDownLeft, Send } from "lucide-react";
import { useWalletMode } from "@/lib/wallet/useWalletMode";
import { PriceContext, formatChange } from "@/lib/price/PriceContext";
import { cli } from "@/lib/cli";
import SendModal from "@/components/app/SendModal";

interface Holding {
  symbol: string;
  amount: number;
  usdValue: number;
  change24h: number;
}

interface PendingTransfer {
  contractId: string;
  sender: string;
  receiver: string;
  amount: string;
  instrumentId: string;
  executeBefore: string;
  memo: string;
}

const TOKEN_IMAGE_OVERRIDES: Record<string, string> = {
  CC: "https://s2.coinmarketcap.com/static/img/coins/64x64/37263.png",
  JPYC: "https://s2.coinmarketcap.com/static/img/coins/64x64/20648.png",
};

const TOKEN_IMAGE_BASE_URL = "https://devnet.cantonloop.com";

function formatAmount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toFixed(2);
}

function formatUsd(value: number): string {
  if (value >= 100) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 3 })}`;
  return `$${value.toFixed(3)}`;
}

function truncateAddr(addr: string): string {
  if (!addr) return "—";
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function formatExpiry(executeBefore: string): { text: string; urgent: boolean; expired: boolean } {
  const now = Date.now();
  const expiry = new Date(executeBefore).getTime();
  const diff = expiry - now;

  if (diff <= 0) return { text: "Expired", urgent: false, expired: true };
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours > 0) return { text: `in ${hours}h ${minutes}m`, urgent: hours < 1, expired: false };
  return { text: `in ${minutes}m`, urgent: true, expired: false };
}

export default function AssetsPage() {
  const { connected } = useWalletMode();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const prices = useContext(PriceContext);

  const fetchHoldings = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const result = await cli.holdings.list();
      if (Array.isArray(result)) {
        const ccUtxos = result.filter((c: Record<string, unknown>) => {
          const tid = (c.contractEntry as Record<string, unknown>)?.JsActiveContract as Record<string, unknown> | undefined;
          const createdEvent = tid?.createdEvent as Record<string, unknown> | undefined;
          const templateId = (createdEvent?.templateId as string) || "";
          return templateId.includes(":Splice.Amulet:Amulet");
        });

        let totalCc = 0;
        for (const c of ccUtxos) {
          const entry = (c.contractEntry as Record<string, unknown>)?.JsActiveContract as Record<string, unknown> | undefined;
          const createdEvent = entry?.createdEvent as Record<string, unknown> | undefined;
          const arg = (createdEvent?.createArgument as Record<string, unknown>) || {};
          const amountObj = arg.amount as Record<string, unknown> | undefined;
          const initialAmount = parseFloat(String(amountObj?.initialAmount || "0"));
          totalCc += initialAmount;
        }

        const mapped: Holding[] = totalCc > 0
          ? [{ symbol: "CC", amount: totalCc, usdValue: 0, change24h: 0 }]
          : [];
        setHoldings(mapped);
      }
    } catch (e) {
      console.error("[Assets] Failed to fetch holdings:", e);
    } finally {
      setLoading(false);
    }
  }, [connected]);

  const fetchPendingTransfers = useCallback(async () => {
    if (!connected) return;
    setPendingLoading(true);
    try {
      const result = await cli.assets.pendingTransfers();
      if (Array.isArray(result)) {
        setPendingTransfers(result);
      }
    } catch (e) {
      console.error("[Assets] Failed to fetch pending transfers:", e);
    } finally {
      setPendingLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    if (connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchHoldings();
      fetchPendingTransfers();
    }
  }, [connected]);

  const handleAccept = useCallback(async (contractId: string) => {
    setAcceptingId(contractId);
    try {
      await cli.assets.accept(contractId);
      fetchPendingTransfers();
      fetchHoldings();
    } catch (e) {
      console.error("[Assets] Accept failed:", e);
    } finally {
      setAcceptingId(null);
    }
  }, [fetchPendingTransfers, fetchHoldings]);

  const handleReject = useCallback(async (contractId: string) => {
    setAcceptingId(contractId);
    try {
      await cli.assets.reject(contractId);
      fetchPendingTransfers();
    } catch (e) {
      console.error("[Assets] Reject failed:", e);
    } finally {
      setAcceptingId(null);
    }
  }, [fetchPendingTransfers]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-tight text-[#0a0a5c]">Assets</h1>
        <button
          onClick={() => { fetchHoldings(); fetchPendingTransfers(); }}
          disabled={loading || !connected}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Pending Transfers */}
      {!connected ? (
        <div className="rounded-md border border-gray-200 bg-white py-12 text-center mb-6">
          <p className="m-0 text-sm text-gray-400">Connect your CLI wallet to view assets.</p>
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 mb-6">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200">
            <ArrowDownLeft size={14} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">Pending Transfers</span>
            <span className="text-[10px] text-amber-600">
              {pendingLoading ? "Loading..." : `(${pendingTransfers.length})`}
            </span>
          </div>
          {pendingTransfers.length === 0 && !pendingLoading ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-amber-600 m-0">No pending transfers</p>
            </div>
          ) : (
            <ul className="divide-y divide-amber-100">
              {pendingTransfers.map((t) => (
                <li key={t.contractId} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 m-0">
                      {t.amount} CC from {truncateAddr(t.sender)}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {t.memo && (
                        <p className="text-xs text-gray-500 m-0">{t.memo}</p>
                      )}
                      {t.executeBefore && (() => {
                        const expiry = formatExpiry(t.executeBefore);
                        return (
                          <span className={`text-[10px] font-medium ${expiry.expired ? "text-red-600" : expiry.urgent ? "text-amber-600" : "text-gray-400"}`}>
                            {expiry.text}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleAccept(t.contractId)}
                      disabled={acceptingId === t.contractId || !!(t.executeBefore && formatExpiry(t.executeBefore).expired)}
                      className="flex items-center gap-1 rounded bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check size={12} />
                      Accept
                    </button>
                    <button
                      onClick={() => handleReject(t.contractId)}
                      disabled={acceptingId === t.contractId || !!(t.executeBefore && formatExpiry(t.executeBefore).expired)}
                      className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X size={12} />
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Holdings Table */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Asset</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Balance</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">USD Value</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">24h</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                  {loading ? "Loading..." : "No holdings yet"}
                </td>
              </tr>
            ) : (
              holdings.map((h) => {
                const priceInfo = prices[h.symbol];
                const usdValue = h.amount * (priceInfo?.usd || 0);
                return (
                  <tr key={h.symbol} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={TOKEN_IMAGE_OVERRIDES[h.symbol] || `${TOKEN_IMAGE_BASE_URL}/api/v1/assets/${h.symbol}/icon`}
                          alt={h.symbol}
                          className="h-8 w-8 rounded-full"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <span className="font-sans text-sm font-medium text-gray-900">Canton</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm text-gray-900">{formatAmount(h.amount)}</span>
                      <span className="font-mono text-xs text-gray-400 ml-1">{h.symbol}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm text-gray-900">{formatUsd(usdValue)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono text-sm font-medium ${h.change24h >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatChange(h.change24h)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSendOpen(true)}
                        className="inline-flex items-center gap-1 rounded bg-brand-blue px-2.5 py-1 text-[10px] font-bold text-white hover:opacity-90"
                      >
                        <Send size={10} />
                        Send
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Send Modal */}
      <SendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        onSent={() => { fetchHoldings(); fetchPendingTransfers(); }}
        balance={holdings.find((h) => h.symbol === "CC")?.amount?.toString() || "0"}
        symbol="CC"
      />
    </div>
  );
}
