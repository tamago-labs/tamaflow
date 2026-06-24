"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { routeLabels } from "@/lib/nav";
import ConnectButton from "@/components/wallet/ConnectButton";
import NetworkBadge from "@/components/wallet/NetworkBadge";

/**
 * Sticky 56px top bar for the in-app shell.
 *
 *   Left  — breadcrumb (mono, brand-muted) derived from the matched route.
 *   Right — Connect Wallet button + AI status dot.
 *
 * The breadcrumb is computed from a static route→label map so we
 * don't need a router config to introspect. The first crumb is
 * always the Dashboard root, with deeper segments appended.
 */

interface Crumb {
  path: string;
  label: string;
}

/**
 * Build breadcrumbs from a URL pathname. The /app prefix is stripped
 * before we look up labels in the routeLabels map.
 */
function buildCrumbs(pathname: string): Crumb[] {
  // Strip /app prefix and any trailing slash
  const stripped = pathname.replace(/^\/app\/?/, "").replace(/\/$/, "");
  const segments = stripped.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ path: "/app", label: "Dashboard" }];
  }

  const crumbs: Crumb[] = [{ path: "/app", label: "Dashboard" }];
  let acc = "/app";
  for (const seg of segments) {
    acc += `/${seg}`;
    // /app/flows/new should be a single "New Flow" crumb, not
    // "Active Flows / New Flow".
    if (acc === "/app/flows/new") {
      crumbs.push({ path: acc, label: "New Flow" });
      continue;
    }
    crumbs.push({ path: acc, label: routeLabels[seg] ?? seg });
  }
  return crumbs;
}

export default function TopBar() {
  const pathname = usePathname() ?? "/app";
  const crumbs = buildCrumbs(pathname);

  return (
    <header className="sticky top-0 z-50 h-14 bg-white border-b border-brand-border flex items-center justify-between px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={c.path} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <ChevronRight
                  size={12}
                  className="text-brand-muted flex-shrink-0"
                />
              )}
              <span
                className={`font-mono text-[11px] tracking-wider2 uppercase whitespace-nowrap ${
                  isLast
                    ? "text-brand-navy font-medium"
                    : "text-brand-muted"
                }`}
              >
                {c.label}
              </span>
            </span>
          );
        })}
      </nav>

      {/* Right-side actions */}
      <div className="flex items-center gap-3">
        {/* Network badge */}
        <NetworkBadge />

        {/* Connect Wallet — drives the Loop SDK */}
        <ConnectButton />
      </div>
    </header>
  );
}
