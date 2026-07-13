"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronRight, MessageCircle } from "lucide-react";
import { routeLabels } from "@/lib/nav";
import ConnectButton from "@/components/wallet/ConnectButton";
import NetworkBadge from "@/components/wallet/NetworkBadge";
import { useWalletMode, type WalletMode } from "@/lib/wallet/useWalletMode";

interface Crumb {
  path: string;
  label: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const stripped = pathname.replace(/^\/app\/?/, "").replace(/\/$/, "");
  const segments = stripped.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ path: "/app", label: routeLabels.app }];
  }

  const crumbs: Crumb[] = [];
  let acc = "/app";
  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({ path: acc, label: routeLabels[seg] ?? seg });
  }
  return crumbs;
}

interface TopBarProps {
  onChatToggle?: () => void;
}

export default function TopBar({ onChatToggle }: TopBarProps) {
  const pathname = usePathname() ?? "/app";
  const crumbs = buildCrumbs(pathname);
  const { mode, setMode, cliAvailable } = useWalletMode();
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 h-14 bg-white border-b border-brand-border flex items-center justify-between px-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 min-w-0 flex-1"
      >
        <ol className="flex items-center gap-1.5 min-w-0">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <li
                key={c.path}
                className="flex items-center gap-1.5 min-w-0"
              >
                {i > 0 && (
                  <ChevronRight
                    size={12}
                    className="text-brand-muted flex-shrink-0"
                    aria-hidden
                  />
                )}
                {isLast ? (
                  <span
                    aria-current="page"
                    className="font-mono text-[11px] tracking-wider2 uppercase whitespace-nowrap text-brand-navy font-medium"
                  >
                    {c.label}
                  </span>
                ) : (
                  <Link
                    href={c.path}
                    className="font-mono text-[11px] tracking-wider2 uppercase whitespace-nowrap text-brand-muted hover:text-brand-blue transition-colors no-underline"
                  >
                    {c.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Right-side actions */}
      <div className="flex items-center gap-3">
        {/* Network badge */}
        <NetworkBadge />

        {/* Wallet switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setWalletMenuOpen(!walletMenuOpen)}
            className="flex items-center gap-1.5 rounded-md border border-brand-blue bg-white px-3 py-1.5 text-xs font-semibold text-brand-blue hover:bg-brand-light cursor-pointer"
          >
            <span>{mode === "loop" ? "Loop Wallet" : "CLI Wallet"}</span>
            <ChevronDown size={11} />
          </button>

          {walletMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-48 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
              <div className="p-2">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider2 text-gray-400">
                  Wallet Type
                </p>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="walletMode"
                    checked={mode === "loop"}
                    onChange={() => setMode("loop")}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">Loop Wallet</span>
                </label>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="walletMode"
                    checked={mode === "cli"}
                    onChange={() => setMode("cli")}
                    disabled={!cliAvailable}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">CLI Wallet</span>
                  {!cliAvailable && (
                    <span className="text-[10px] text-gray-400">(offline)</span>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Connect Wallet — drives the Loop SDK */}
        <ConnectButton />
      </div>
    </header>
  );
}
