"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { routeLabels } from "@/lib/nav";
import ConnectButton from "@/components/wallet/ConnectButton";
import NetworkBadge from "@/components/wallet/NetworkBadge";

/**
 * Sticky 56px top bar for the in-app shell.
 *
 *   Left  — clickable breadcrumb derived from the matched route.
 *   Right — Network badge + Connect Wallet button.
 *
 * The breadcrumb is built from `routeLabels` (a static route→label
 * map in `lib/nav.ts`) so we don't need a router config to
 * introspect. The first crumb is always the Dashboard root, with
 * deeper segments appended.
 */

interface Crumb {
  path: string;
  label: string;
}

/**
 * Build breadcrumbs from a URL pathname. The /app prefix is stripped
 * before we look up labels in the routeLabels map.
 *
 * Mirrors the new Sidebar structure:
 *   /app                          → Dashboard
 *   /app/assets                   → Assets
 *   /app/payments                 → Payments
 *   /app/rewards                  → Rewards Hub
 *   /app/identification           → Identification
 *   /app/security                  → Security
 *   /app/statement                 → Account Statement
 *   /app/settings                  → Settings
 */
function buildCrumbs(pathname: string): Crumb[] {
  // Strip /app prefix and any trailing slash
  const stripped = pathname.replace(/^\/app\/?/, "").replace(/\/$/, "");
  const segments = stripped.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ path: "/app", label: routeLabels.app }];
  }

  const crumbs: Crumb[] = [{ path: "/app", label: routeLabels.app }];
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

        {/* Connect Wallet — drives the Loop SDK */}
        <ConnectButton />
      </div>
    </header>
  );
}