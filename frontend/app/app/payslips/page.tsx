"use client";

/**
 * Payslips Page — Display received payslips from employer via P2P.
 * Payslips arrive as chat messages prefixed with [payslip].
 */

import { useCallback, useEffect, useState } from "react";
import { FileText, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { cli } from "@/lib/cli";
import { useWalletMode } from "@/lib/wallet/useWalletMode";

interface Payslip {
  id: string;
  type: string;
  employee: string;
  period: string;
  grossPay: string;
  netPay: string;
  currency: string;
  style: string;
  html: string;
  companyName: string;
  createdAt: string;
}

export default function PayslipsPage() {
  const { connected } = useWalletMode();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "source">("preview");
  const [p2pConnected, setP2pConnected] = useState(false);

  const fetchPayslips = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      // Fetch P2P payslips (have html content)
      const p2pResult = await cli.payslips.list();
      const p2pPayslips: Payslip[] = Array.isArray(p2pResult)
        ? p2pResult
            .filter((p: Record<string, unknown>) => p.type === "payslip" && (p.markdown || p.html))
            .map((p: Record<string, unknown>) => ({
              id: (p.id as string) || "",
              type: "payslip",
              employee: (p.employee as string) || "",
              period: (p.period as string) || "",
              grossPay: (p.grossPay as string) || "0",
              netPay: (p.netPay as string) || "0",
              currency: (p.currency as string) || "USD",
              style: (p.style as string) || "standard",
              html: (p.html as string) || (p.markdown as string) || "",
              companyName: (p.companyName as string) || "",
              createdAt: (p.createdAt as string) || "",
            }))
        : [];

      // Fetch on-ledger PayslipRecord contracts
      let onChainPayslips: Payslip[] = [];
      try {
        const records = await cli.payslipRecords.list();
        if (Array.isArray(records)) {
          onChainPayslips = records.map((r: Record<string, unknown>) => ({
            id: (r.payslipId as string) || "",
            type: "payslip",
            employee: (r.employee as string) || "",
            period: (r.period as string) || "",
            grossPay: "0",
            netPay: "0",
            currency: "USD",
            style: "standard",
            html: "", // Content is in P2P, not on-chain
            companyName: "",
            createdAt: (r.createdAt as string) || "",
            onChain: true,
          }));
        }
      } catch {
        // PayslipRecord query may fail if contract not deployed yet
      }

      // Merge: prefer P2P payslips (they have html), fill gaps from on-chain
      const mergedMap = new Map<string, Payslip>();
      for (const p of onChainPayslips) {
        if (p.id) mergedMap.set(p.id, p);
      }
      for (const p of p2pPayslips) {
        if (p.id) mergedMap.set(p.id, { ...mergedMap.get(p.id), ...p });
      }

      setPayslips(
        Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    } catch (e) {
      console.error("[Payslips] Failed to fetch payslips:", e);
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    if (connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchPayslips();
      // Check P2P room status
      cli.room.status().then((status: Record<string, unknown>) => {
        setP2pConnected(!!status.connected);
      }).catch(() => {});
    }
  }, [connected]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-tight text-[#0a0a5c]">Payslips</h1>
        <button
          onClick={fetchPayslips}
          disabled={loading || !connected}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700"> 
          <p className="m-0 mt-1">
            Ensure you have connected to the team room via P2P hyperswarm. If you see payslip metadata but no content, disconnect and reconnect with the correct invite code.
          </p>
        </div>

      {/* Payslip list */}
      {!connected ? (
        <div className="rounded-md border border-gray-200 bg-white py-12 text-center">
          <p className="m-0 text-sm text-gray-400">Connect your CLI wallet to view payslips.</p>
        </div>
      ) : payslips.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-200">
            {payslips.map((p) => {
              const isExpanded = expanded === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { setExpanded(isExpanded ? null : p.id); setViewMode("preview"); }}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <FileText size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="m-0 text-sm font-medium text-gray-900">{p.companyName}</p>
                      <p className="m-0 text-xs text-gray-500">{p.period}</p>
                    </div>
                    <div className="text-right">
                      <p className="m-0 text-sm font-medium text-gray-900">
                        {p.currency} {parseFloat(p.grossPay).toLocaleString()}
                      </p>
                      <p className="m-0 text-xs text-gray-500">
                        Net: {p.currency} {parseFloat(p.netPay).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="m-0 text-[10px] text-gray-400">
                        {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-wider2 text-gray-400">
                          Payslip
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setViewMode("preview"); }}
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              viewMode === "preview" ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setViewMode("source"); }}
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              viewMode === "source" ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            Source
                          </button>
                        </div>
                      </div>
                      {viewMode === "preview" ? (
                        <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
                          <iframe
                            srcDoc={p.html}
                            title={`Payslip ${p.id}`}
                            sandbox="allow-same-origin"
                            className="w-full"
                            style={{ height: 600, border: "none" }}
                          />
                        </div>
                      ) : (
                        <pre className="m-0 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-white p-4 font-mono text-xs leading-relaxed text-gray-900">
                          {p.html}
                        </pre>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : !loading ? (
        <div className="rounded-md border border-gray-200 bg-white py-12 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
              <FileText size={20} />
            </div>
          </div>
          <p className="m-0 text-sm font-medium text-gray-900">No payslips yet</p>
          <p className="m-0 mt-1 text-xs text-gray-400">
            Your employer will send payslips via P2P after running payroll.
          </p>
        </div>
      ) : null}
    </div>
  );
}
