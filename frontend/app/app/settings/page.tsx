"use client";

import { useState, type ReactNode } from "react";
import { User } from "lucide-react";

type Tab = "profile";

interface TabDef {
  key: Tab;
  label: string;
  icon: ReactNode;
}

const TABS: TabDef[] = [
  { key: "profile", label: "Profile", icon: <User size={12} /> },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");

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

      {tab === "profile" && (
        <div className="bg-white border border-brand-border rounded-md p-6 max-w-2xl">
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase mb-3 m-0">
            Employer Profile
          </p>
          <p className="text-sm text-gray-600 m-0">
            Profile settings will be available here.
          </p>
        </div>
      )}
    </div>
  );
}
