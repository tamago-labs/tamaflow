"use client";

import { useState, type ReactNode } from "react";
import { Cpu, Wallet, User, GitBranch } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import AccountIsland from "@/components/wallet/AccountIsland";

/**
 * Settings placeholder — four sub-tabs (mirrors the desktop-app):
 *   • AI Model  — load / change model (placeholder)
 *   • Wallet    — Connect Wallet (Canton)
 *   • Profile   — company / employer info
 *   • Netting   — netting rules / preferences
 */

type Tab = "ai" | "wallet" | "profile" | "netting";

interface TabDef {
  key: Tab;
  label: string;
  icon: ReactNode;
}

const TABS: TabDef[] = [
  { key: "ai", label: "AI Model", icon: <Cpu size={12} /> },
  { key: "wallet", label: "Wallet", icon: <Wallet size={12} /> },
  { key: "profile", label: "Profile", icon: <User size={12} /> },
  { key: "netting", label: "Netting", icon: <GitBranch size={12} /> },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("ai");

  return (
    <div> 

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-brand-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 py-2.5 px-4 border-0 bg-transparent cursor-pointer font-mono text-[11px] tracking-wider2 uppercase whitespace-nowrap ${
              tab === t.key
                ? "text-brand-navy font-semibold border-b-2 border-brand-blue"
                : "text-brand-muted font-normal hover:text-brand-navy"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ai" && (
        <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-3 m-0">
            AI Model
          </p>
          <p className="font-sans text-sm text-brand-muted m-0 mb-4">
            Load a local AI model to start processing payroll flows. The
            model runs entirely on your machine — no data ever leaves
            your network.
          </p>
          <button
            type="button"
            className="px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
          >
            <Cpu size={12} className="inline-block mr-1.5 -mt-0.5" />
            Load Model
          </button>
        </div>
      )}

      {tab === "wallet" && <AccountIsland />}

      {tab === "profile" && (
        <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-3 m-0">
            Employer Profile
          </p>
          <p className="font-sans text-sm text-brand-muted m-0">
            Company name, base country, and default currency will live
            here.
          </p>
        </div>
      )}

      {tab === "netting" && (
        <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-3 m-0">
            Netting Rules
          </p>
          <p className="font-sans text-sm text-brand-muted m-0">
            Toggles for auto-netting, minimum thresholds, and
            counterparty rules will live here.
          </p>
        </div>
      )}
    </div>
  );
}
