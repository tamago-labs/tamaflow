"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { routeLabels } from "@/lib/nav";
import ConnectButton from "@/components/wallet/ConnectButton";
import { useWalletMode } from "@/lib/wallet/useWalletMode";

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

export default function TopBar() {
  const pathname = usePathname() ?? "/app";
  const crumbs = buildCrumbs(pathname);
  const { mode, setMode, cliAvailable, cliPartyId } = useWalletMode();
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setWalletMenuOpen(false);
        setPartyModalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = async () => {
    if (cliPartyId) {
      await navigator.clipboard.writeText(cliPartyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-50 h-14 bg-white border-b border-brand-border flex items-center justify-between px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 min-w-0">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <li key={c.path} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <ChevronRight size={12} className="text-brand-muted flex-shrink-0" aria-hidden />}
                {isLast ? (
                  <span aria-current="page" className="font-mono text-[11px] tracking-wider2 uppercase whitespace-nowrap text-brand-navy font-medium">
                    {c.label}
                  </span>
                ) : (
                  <Link href={c.path} className="font-mono text-[11px] tracking-wider2 uppercase whitespace-nowrap text-brand-muted hover:text-brand-blue transition-colors no-underline">
                    {c.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Right-side actions */}
      <div className="flex items-center gap-2" ref={menuRef}>
        {/* Wallet type switcher with label */}
        <span className="text-xs text-gray-500 font-medium">Wallet:</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setWalletMenuOpen(!walletMenuOpen)}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <span>{mode === "loop" ? "Loop" : "CLI"}</span>
            <ChevronDown size={11} />
          </button>

          {walletMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-48 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
              <div className="p-2">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider2 text-gray-400">Wallet Type</p>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input type="radio" name="walletMode" checked={mode === "loop"} onChange={() => setMode("loop")} className="accent-blue-600" />
                  <span className="text-sm text-gray-700">Loop Wallet</span>
                </label>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input type="radio" name="walletMode" checked={mode === "cli"} onChange={() => setMode("cli")} disabled={!cliAvailable} className="accent-blue-600" />
                  <span className="text-sm text-gray-700">CLI Wallet</span>
                  {!cliAvailable && <span className="text-[10px] text-gray-400">(offline)</span>}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Connect Wallet / CLI Connected Button with Dropdown */}
        {mode === "cli" && cliPartyId ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPartyModalOpen(!partyModalOpen)}
              className="flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 cursor-pointer"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider2">Connected</span>
              <ChevronDown size={11} />
            </button>

            {partyModalOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-72 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-3">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-wider2 text-gray-400">CLI Wallet</p>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-md p-2 mb-3">
                    <code className="flex-1 font-mono text-[10px] text-gray-700 break-all leading-tight">{cliPartyId}</code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
                      title="Copy party ID"
                    >
                      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-gray-500" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-3">Use this party ID to identify your CLI wallet on the Canton network.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("loop")}
                      className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Switch to Loop
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartyModalOpen(false)}
                      className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <ConnectButton />
        )}
      </div>

    </header>
  );
}
