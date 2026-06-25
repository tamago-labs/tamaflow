import Link from "next/link";
import {
  TrendingUp,
  Check,
  ShieldCheck,
  Receipt,
  FileText,
  IdCard,
  Wallet,
  Clock,
} from "lucide-react";

/**
 * Dashboard — the Employee Portal's home.
 *
 * Layout (top → bottom):
 *
 *   1. Welcome banner — full-width, navy with radial-gradient glows
 *      (matches the landing CTA's visual language)
 *   2. 3 stat cards — Total Assets, Last Payroll Received, Pending Payments
 *   3. Recent Activity card — 3 most recent events (salary / payroll / KYC)
 *   4. Quick Actions — 3 clickable cards linking into the sidebar pages
 *
 * No AI / model picker here — this is the employee side. Those controls
 * live in the desktop app (which the employer uses).
 */

const STATS = [
  {
    label: "Total Assets",
    value: "$ 12,450.00",
    hint: "Across 3 tokens",
    Icon: Wallet,
    accent: "blue" as const,
  },
  {
    label: "Last Payroll Received",
    value: "+$2,500.00",
    hint: "5N ID verified",
    Icon: TrendingUp,
    accent: "ok" as const,
  },
  {
    label: "Pending Payments",
    value: "0",
    hint: "No payouts queued",
    Icon: Clock,
    accent: "muted" as const,
  },
];

const ACTIVITY = [
  {
    Icon: TrendingUp,
    accent: "ok" as const,
    title: "Salary Received",
    detail: "Canton · July 2026 cycle",
    meta: "+$2,500.00",
    time: "2 days ago",
  },
  {
    Icon: Check,
    accent: "ok" as const,
    title: "Payroll Processed",
    detail: "3 employees · settled on Canton",
    meta: "July 2026",
    time: "2 days ago",
  },
  {
    Icon: ShieldCheck,
    accent: "ok" as const,
    title: "Identity Verified",
    detail: "KYC completed by Tamago Labs",
    meta: "5N ID",
    time: "14 days ago",
  },
];

const QUICK_ACTIONS = [
  {
    label: "View Payslip",
    hint: "Latest statement",
    Icon: Receipt,
    href: "/app/statement",
  },
  {
    label: "Download Statement",
    hint: "PDF · CSV",
    Icon: FileText,
    href: "/app/statement",
  },
  {
    label: "Verify Identity",
    hint: "5N ID credentials",
    Icon: IdCard,
    href: "/app/identification",
  },
];

const accentDot: Record<"ok" | "blue" | "muted", string> = {
  ok: "bg-brand-ok",
  blue: "bg-brand-blue",
  muted: "bg-brand-muted",
};
const accentIconWrap: Record<"ok" | "blue" | "muted", string> = {
  ok: "bg-[#e6f7ee] text-brand-ok border-brand-ok",
  blue: "bg-[#eaeefc] text-brand-blue border-brand-blue",
  muted: "bg-brand-light text-brand-muted border-brand-border",
};

export default function DashboardPage() {
  return (
    <div>
      {/* ── Welcome banner ───────────────────────────────────────────── */}
      <div className="relative bg-brand-navy text-white rounded-lg overflow-hidden p-10 lg:p-14 mb-6">
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
          <h1 className="text-3xl md:text-4xl font-light leading-tight">
            Welcome to your{" "}
            <span className="text-brand-teal">Employee Portal</span>
          </h1>
          <p className="mt-4 text-base text-white/70 max-w-2xl leading-relaxed">
            Your payroll activity, balances, and recent activity in one
            place. All settled atomically on Canton.
          </p>
        </div>
      </div>

      {/* ── 3 stat cards (Identity Status removed) ──────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {STATS.map((s) => {
          const Icon = s.Icon;
          return (
            <div
              key={s.label}
              className="bg-white border border-brand-border rounded-md p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0">
                  {s.label}
                </p>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${accentDot[s.accent]}`}
                  aria-hidden
                />
              </div>
              <p className="font-sans text-2xl font-light text-brand-navy m-0">
                {s.value}
              </p>
              <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mt-1">
                {s.hint}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Recent Activity ─────────────────────────────────────────── */}
      <div className="bg-white border border-brand-border rounded-md mb-6 max-w-4xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0">
            Recent Activity
          </p>
          <Link
            href="/app/payments"
            className="font-mono text-[10px] font-bold tracking-wider2 text-brand-blue uppercase no-underline hover:text-brand-navy"
          >
            View all →
          </Link>
        </div>

        <ul className="divide-y divide-brand-border">
          {ACTIVITY.map((a, i) => {
            const Icon = a.Icon;
            return (
              <li
                key={i}
                className="flex items-center gap-4 px-5 py-4 hover:bg-brand-light/40 transition-colors"
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-md border flex-shrink-0 ${accentIconWrap[a.accent]}`}
                  aria-hidden
                >
                  <Icon size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-brand-navy m-0">
                    {a.title}
                  </p>
                  <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mt-0.5">
                    {a.detail}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm font-bold text-brand-navy m-0">
                    {a.meta}
                  </p>
                  <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mt-0.5">
                    {a.time}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold m-0">
            Quick Actions
          </p>
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
            {QUICK_ACTIONS.length} actions
          </p>
        </div>
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
