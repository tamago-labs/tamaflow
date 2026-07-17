"use client";

/**
 * Rewards Hub — Employee points balance and how-to-earn info.
 * Points are stored on the EmployeeRecord DAML contract (running total).
 * Earned via attendance check-in: +1,000 first time, +10 each after.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Star } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { cli } from "@/lib/cli";
import { useWalletMode } from "@/lib/wallet/useWalletMode";

interface EmployeeRecord {
  contractId: string;
  companyName: string;
  displayName: string;
  points: number;
  offset: number;
}

function parseRecord(c: Record<string, unknown>): EmployeeRecord {
  const entry = (c.contractEntry as Record<string, unknown>)
    ?.JsActiveContract as Record<string, unknown> | undefined;
  const createdEvent = entry?.createdEvent as Record<string, unknown> | undefined;
  const arg = (createdEvent?.createArgument as Record<string, unknown>) || {};
  return {
    contractId: (createdEvent?.contractId as string) || "",
    companyName: (arg.companyName as string) || "",
    displayName: (arg.displayName as string) || "",
    points: (arg.points as number) || 0,
    offset: (createdEvent?.offset as number) || 0,
  };
}

function deduplicate(records: EmployeeRecord[]): EmployeeRecord[] {
  const latestByCompany = new Map<string, EmployeeRecord>();
  for (const r of records) {
    const existing = latestByCompany.get(r.companyName);
    if (!existing || r.offset > existing.offset) {
      latestByCompany.set(r.companyName, r);
    }
  }
  return Array.from(latestByCompany.values());
}

const EARNING_STEPS = [
  { num: "01", title: "First check-in", desc: "Earn 1,000 points on your first attendance check-in." },
  { num: "02", title: "Daily check-ins", desc: "Earn 10 points for each subsequent check-in." },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const stepContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const stepItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
};

export default function RewardsPage() {
  const { connected } = useWalletMode();
  const [records, setRecords] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await cli.contracts.query(
        "TamaFlow.Company.EmployeeRecord:EmployeeRecord"
      );
      if (Array.isArray(result)) {
        setRecords(deduplicate(result.map(parseRecord)));
      }
    } catch (e) {
      console.error("[Rewards] Failed to fetch records:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) fetchRecords();
  }, [connected, fetchRecords]);

  const totalPoints = useMemo(
    () => records.reduce((sum, r) => sum + r.points, 0),
    [records]
  );

  return (
    <div className="space-y-4 max-w-3xl">
      {/* ── Warning when wallet not connected */}
      {!connected && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="font-sans text-sm text-amber-800 m-0">
            Wallet not connected. Points shown are from the last session.
          </p>
        </div>
      )}

      {/* ── Points Welcome Card (matches dashboard welcome card style) */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="relative bg-brand-navy text-white rounded-lg overflow-hidden p-8 lg:p-10"
      >
        {/* Teal halo (top-right) */}
        <div
          className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(62, 196, 192, 0.3) 0%, rgba(62, 196, 192, 0) 70%)",
          }}
        />
        {/* Blue halo (bottom-left) */}
        <div
          className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(26, 26, 232, 0.25) 0%, rgba(26, 26, 232, 0) 70%)",
          }}
        />

        <div className="relative">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold mb-3">
            Rewards Hub
          </p>

          {/* Points balance */}
          <div className="flex items-baseline gap-3 mb-1">
            {loading ? (
              <div className="h-12 w-40 bg-white/10 rounded animate-pulse" />
            ) : (
              <h1 className="text-4xl md:text-5xl font-light leading-tight">
                <span className="font-mono">{Number(totalPoints).toLocaleString()}</span>
              </h1>
            )}
            <span className="font-mono text-xs text-white/50 uppercase tracking-wider">
              points
            </span>
          </div>
          <p className="font-mono text-[10px] tracking-wider2 text-white/50 uppercase m-0 mb-8">
            Earned from attendance check-ins
          </p>

          {/* How points are earned — grid like dashboard steps */}
          <motion.ol
            variants={stepContainerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 list-none p-0 m-0"
          >
            {EARNING_STEPS.map((s) => (
              <motion.li key={s.num} variants={stepItemVariants} className="flex flex-col">
                <span className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold">
                  {s.num}
                </span>
                <p className="font-sans text-sm font-medium text-white mt-1 mb-0">
                  {s.title}
                </p>
                <p className="font-sans text-xs text-white/60 mt-1 mb-0 leading-snug">
                  {s.desc}
                </p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </motion.div>

      {/* ── Per-company breakdown (only if multiple employers) */}
      {records.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-white border border-brand-border rounded-md p-6"
        >
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0 mb-3">
            Points by Employer
          </p>
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.contractId}
                className="flex items-center justify-between py-2 border-b border-brand-border last:border-0"
              >
                <span className="font-sans text-sm text-brand-navy">
                  {r.companyName}
                </span>
                <span className="font-mono text-sm font-semibold text-brand-blue">
                  {r.points.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
