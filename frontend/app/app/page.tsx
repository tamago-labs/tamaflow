"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Wallet,
  Clock,
  ArrowDownLeft,
  Send,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { cli } from "@/lib/cli";
import { useWalletMode } from "@/lib/wallet/useWalletMode";

interface Payslip {
  id: string;
  companyName: string;
  period: string;
  grossPay: string;
  netPay: string;
  currency: string;
  html: string;
  createdAt: string;
}

const STEPS = [
  {
    num: "01",
    title: "Connect CLI wallet",
    desc: "Set up your wallet to hold payroll and receive payslips.",
  },
  {
    num: "02",
    title: "Receive payment",
    desc: "Get your salary settled on Canton.",
  },
  {
    num: "03",
    title: "Download your payslip",
    desc: "Via P2P hyperswarm with tax, SS, and withholding breakdown.",
  },
  {
    num: "04",
    title: "Bridge to Loop wallet",
    desc: "Move funds out for cash-out or DeFi.",
  },
];

const QUICK_ACTIONS = [
  {
    label: "View Payslip",
    hint: "Payslip history",
    Icon: FileText,
    href: "/app/payslips",
  },
  {
    label: "Send Assets",
    hint: "Transfer to other",
    Icon: Send,
    href: "/app/assets",
  },
  {
    label: "Check Attendance",
    hint: "Daily timesheet",
    Icon: Clock,
    href: "/app/attendance",
  },
];

const accentIconWrap: Record<"ok" | "blue" | "muted", string> = {
  ok: "bg-[#e6f7ee] text-brand-ok border-brand-ok",
  blue: "bg-[#eaeefc] text-brand-blue border-brand-blue",
  muted: "bg-brand-light text-brand-muted border-brand-border",
};

const stepContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const stepItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 26 },
  },
};

const headingVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function DashboardPage() {
  const { connected } = useWalletMode();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPayslips = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const result = await cli.payslips.list();
      if (Array.isArray(result)) {
        const mapped: Payslip[] = result
          .filter((p: Record<string, unknown>) => p.type === "payslip" && (p.markdown || p.html))
          .map((p: Record<string, unknown>) => ({
            id: (p.id as string) || "",
            companyName: (p.companyName as string) || "",
            period: (p.period as string) || "",
            grossPay: (p.grossPay as string) || "0",
            netPay: (p.netPay as string) || "0",
            currency: (p.currency as string) || "USD",
            html: (p.html as string) || (p.markdown as string) || "",
            createdAt: (p.createdAt as string) || "",
          }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 3);
        setPayslips(mapped);
      }
    } catch (e) {
      console.error("[Dashboard] Failed to fetch payslips:", e);
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  return (
    <div>
      {/* ── Welcome banner ─────────────────────────────────────────── */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={headingVariants}
        className="relative bg-brand-navy text-white rounded-lg overflow-hidden p-8 lg:p-10 mb-6 max-w-4xl"
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
            Dashboard
          </p>
          <h1 className="text-3xl md:text-4xl font-light leading-tight mb-8">
            Welcome to{" "}
            <span className="text-brand-teal">Employee Portal</span>
          </h1>

          <motion.ol
            variants={stepContainerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 list-none p-0 m-0"
          >
            {STEPS.map((s) => (
              <motion.li
                key={s.num}
                variants={stepItemVariants}
                className="flex flex-col"
              >
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

      {/* ── Recent Activity ─────────────────────────────────────────── */}
      <div className="bg-white border border-brand-border rounded-md mb-6 max-w-4xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0">
            Recent Activity
          </p>
          <Link
            href="/app/payslips"
            className="font-mono text-[10px] font-bold tracking-wider2 text-brand-blue uppercase no-underline hover:text-brand-navy"
          >
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center">
            <p className="font-mono text-xs text-brand-muted m-0">Loading…</p>
          </div>
        ) : payslips.length > 0 ? (
          <ul className="divide-y divide-brand-border">
            {payslips.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-brand-light/40 transition-colors"
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-md border flex-shrink-0 ${accentIconWrap.ok}`}
                  aria-hidden
                >
                  <ArrowDownLeft size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-brand-navy m-0">
                    {p.companyName ? `From ${p.companyName}` : "Payslip received"}
                  </p>
                  <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mt-0.5">
                    {p.period}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm font-bold text-brand-navy m-0">
                    {p.currency} {parseFloat(p.grossPay).toLocaleString()}
                  </p>
                  <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mt-0.5">
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand-muted">
                <FileText size={16} />
              </div>
            </div>
            <p className="font-sans text-sm font-medium text-brand-navy m-0">No payslips yet</p>
            <p className="font-mono text-xs text-brand-muted m-0 mt-1">
              Your employer will send payslips via P2P after running payroll.
            </p>
          </div>
        )}
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0 mb-3">
          Quick Actions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.Icon;
            return (
              <Link
                key={a.label}
                href={a.href}
                className="bg-white border border-brand-border rounded-md p-5 flex items-center gap-4 no-underline hover:border-brand-blue/50 hover:bg-brand-light/30 transition-colors group"
              >
                <span
                  className="flex items-center justify-center w-10 h-10 rounded-md bg-brand-light border border-brand-border text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors flex-shrink-0"
                  aria-hidden
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="font-sans text-sm font-medium text-brand-navy m-0 group-hover:text-brand-blue transition-colors">
                    {a.label}
                  </p>
                  <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mt-0.5">
                    {a.hint}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
