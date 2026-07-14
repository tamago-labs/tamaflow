"use client";

/**
 * Assets Page — Employee's tokenized portfolio on Canton.
 * CLI wallet only.
 */

import { useContext, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useWalletMode } from "@/lib/wallet/useWalletMode";
import { PriceContext, formatChange } from "@/lib/price/PriceContext";
import { cli } from "@/lib/cli";

interface Holding {
  symbol: string;
  amount: number;
  usdValue: number;
  change24h: number;
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

export default function AssetsPage() {
  const { connected } = useWalletMode();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);
  const prices = useContext(PriceContext);

  const fetchHoldings = async () => {
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
  };

  useEffect(() => {
    if (connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchHoldings();
    }
  }, [connected]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-tight text-[#0a0a5c]">Assets</h1>
        <button
          onClick={fetchHoldings}
          disabled={loading || !connected}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Holdings Table */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Asset</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Balance</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">USD Value</th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">24h</th>
            </tr>
          </thead>
          <tbody>
            {!connected ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">
                  Connect your CLI wallet to view assets.
                </td>
              </tr>
            ) : holdings.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">
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
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
