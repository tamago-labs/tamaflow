"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, LogIn, LogOut, User, Droplets, PenLine, TestTube2 } from "lucide-react";
import { routeLabels } from "@/lib/nav";
import { useWalletMode } from "@/lib/wallet/useWalletMode";
import ConnectModal from "./ConnectModal";
import DemoConnectModal from "./DemoConnectModal";
import AccountInfoModal from "./AccountInfoModal";
import FaucetModal from "./FaucetModal";
import UsernameModal from "./UsernameModal";

function truncateParty(partyId: string): string {
  if (!partyId) return "";
  if (partyId.length <= 20) return partyId;
  return `${partyId.slice(0, 12)}...${partyId.slice(-6)}`;
}

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
  const { connected, cliPartyId, p2pConnected, disconnect } = useWalletMode();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [accountInfoOpen, setAccountInfoOpen] = useState(false);
  const [faucetModalOpen, setFaucetModalOpen] = useState(false);
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDisconnect = () => {
    disconnect();
    setDropdownOpen(false);
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
        {/* Network Badge */}
        {/* <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-brand-blue bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-blue hover:bg-brand-light"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" />
            <span className="font-sans text-xs font-bold ">Devnet</span>
          </button>
        </div> */}

        {connected && cliPartyId ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <span className="font-mono text-[11px]">{truncateParty(cliPartyId)}</span>
              <ChevronDown size={11} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-44 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); setAccountInfoOpen(true); }}
                    className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-[13px] text-brand-navy hover:bg-brand-light cursor-pointer"
                  >
                    <User size={14} className="text-brand-muted" />
                    Account Info
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); setUsernameModalOpen(true); }}
                    disabled={!p2pConnected}
                    className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-[13px] text-brand-navy hover:bg-brand-light cursor-pointer disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <PenLine size={14} className="text-brand-muted" />
                    Change Username
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); setFaucetModalOpen(true); }}
                    className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-[13px] text-brand-navy hover:bg-brand-light cursor-pointer"
                  >
                    <Droplets size={14} className="text-brand-muted" />
                    Faucet
                  </button>
                  <div className="my-0.5 border-t border-gray-100" />
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-[13px] text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <LogOut size={14} />
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDemoModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-brand-teal bg-white px-3 py-1.5 text-[11px] font-bold uppercase text-brand-teal tracking-wider2 hover:bg-brand-light cursor-pointer font-mono"
            >
              <TestTube2 size={12} />
              Demo
            </button>
            <button
              type="button"
              onClick={() => setConnectModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-brand-blue bg-white px-3 py-1.5 text-[11px] font-bold uppercase text-brand-blue tracking-wider2  hover:bg-brand-light cursor-pointer font-mono"
            >
              <LogIn size={12} />
              Connect
            </button>
          </div>
        )}
      </div>

      <ConnectModal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
      />
      <DemoConnectModal
        open={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
      />
      <AccountInfoModal
        open={accountInfoOpen}
        onClose={() => setAccountInfoOpen(false)}
      />
      <FaucetModal
        open={faucetModalOpen}
        onClose={() => setFaucetModalOpen(false)}
      />
      <UsernameModal
        open={usernameModalOpen}
        onClose={() => setUsernameModalOpen(false)}
      />
    </header>
  );
}
