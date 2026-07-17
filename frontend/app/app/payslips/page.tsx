"use client";

/**
 * Payslips Page — Display received payslips from employer via P2P.
 * Rich summary cards with full HTML preview on expand.
 */

import { useCallback, useEffect, useState } from "react";
import { FileText, ChevronDown, ChevronRight, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
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

  const fetchPayslips = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
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
            html: "",
            companyName: "",
            createdAt: (r.createdAt as string) || "",
            onChain: true,
          }));
        }
      } catch {
        // PayslipRecord query may fail if contract not deployed yet
      }

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
      fetchPayslips();
    }
  }, [connected, fetchPayslips]);

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

      {/* Warning when wallet not connected */}
      {!connected && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="font-sans text-sm text-amber-800 m-0">
            Wallet not connected. Connect your wallet to view payslips.
          </p>
        </div>
      )}

      {/* Payslip list */}
      {loading ? (
        <div className="rounded-md border border-gray-200 bg-white py-12 text-center">
          <div className="mb-3 flex justify-center">
            <Loader2 size={20} className="text-brand-blue animate-spin" />
          </div>
          <p className="m-0 text-sm text-brand-muted">Loading payslips…</p>
        </div>
      ) : payslips.length > 0 ? (
        <div className="space-y-3">
          {payslips.map((p, i) => {
            const isExpanded = expanded === p.id;
            const hasContent = !!p.html;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3, ease: "easeOut" }}
                className="rounded-md border border-gray-200 bg-white overflow-hidden"
              >
                {/* Collapsed header — single row summary */}
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : p.id)}
                  className="w-full text-left px-5 py-3.5 flex items-center gap-6 transition-colors hover:bg-gray-50/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-sm font-semibold text-brand-navy truncate">
                      {p.companyName ? `From ${p.companyName}` : "Unknown Payslip"}
                    </p>
                    <p className="m-0 text-[11px] text-brand-muted font-mono uppercase tracking-wider">
                      {p.period}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="m-0 text-sm font-mono font-semibold text-brand-navy">
                      Gross {p.currency} {parseFloat(p.grossPay).toLocaleString()}
                    </p>
                    <p className="m-0 text-[11px] font-mono text-brand-muted">
                      Net {p.currency} {parseFloat(p.netPay).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="m-0 text-[11px] font-mono text-brand-muted">
                      {p.createdAt
                        ? new Date(p.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                    <p className="m-0 text-[11px] font-mono">
                      {hasContent ? (
                        <span className="text-brand-ok font-semibold">Attachment available</span>
                      ) : (
                        <span className="text-brand-muted">No attachment</span>
                      )}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded — full HTML preview */}
                <AnimatePresence>
                  {isExpanded && hasContent && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-brand-border px-5 py-4">
                        <div className="rounded-md border border-brand-border bg-white overflow-hidden">
                          <iframe
                            srcDoc={p.html}
                            title={`Payslip ${p.id}`}
                            sandbox="allow-same-origin"
                            className="w-full"
                            style={{ height: 600, border: "none" }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
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
