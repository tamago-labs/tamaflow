"use client";

import { useState, type ReactNode } from "react";
import { Wallet, User } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import AccountIsland from "@/components/wallet/AccountIsland";

/**
 * Settings placeholder — two sub-tabs (mirrors the desktop-app):
 *   • Wallet    — Connect Wallet (Canton)
 *   • Profile   — company / employer info
 *
 * The AI Model and Netting tabs that used to live here have been
 * removed — local AI and auto-netting are desktop-app-only surfaces.
 */

type Tab = "wallet" | "profile";

interface TabDef {
  key: Tab;
  label: string;
  icon: ReactNode;
}

const TABS: TabDef[] = [
  { key: "wallet", label: "Wallet", icon: <Wallet size={12} /> },
  { key: "profile", label: "Profile", icon: <User size={12} /> },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("wallet");

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
    </div>
  );
}
