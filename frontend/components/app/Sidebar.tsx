"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navCategories } from "@/lib/nav";
import { SITE } from "@/lib/theme";
import BrandLockup from "@/components/shared/BrandLockup";

/**
 * Fixed 200px left navigation for the in-app shell.
 *
 * Visual:
 *   • Teal 3px accent bar across the top (matches the desktop-app
 *     reference and the landing mockup).
 *   • Wordmark in NAVY + BLUE.
 *   • Two categories (Payroll, Account) with mono uppercase labels.
 *   • Active link = brand-blue fill + white text; hover = brand-light.
 *   • Bottom strip with the mono version badge.
 *
 * Uses `usePathname()` so server-side prefetched links can be
 * highlighted without a full router context.
 */
export default function Sidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside
      className="fixed top-0 left-0 w-[200px] h-screen bg-white border-r border-brand-border flex flex-col z-[100] box-border"
      style={{ padding: "24px 16px" }}
    >
      {/* Teal top accent — matches the my-doctor-ai / desktop-app ref */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand-teal" />

      {/* Wordmark — links back to the landing page */}
      <div className="mb-8">
        <BrandLockup href="/" mark="hexagon" box="duotone" size="md" />
      </div>

      {/* Nav items grouped by category */}
      <nav className="flex flex-col gap-4 flex-1 overflow-y-auto">
        {navCategories.map((category) => (
          <div key={category.key}>
            <p className="font-mono text-[10px] font-semibold text-brand-muted uppercase tracking-wider2 m-0 mb-2 ml-3">
              {category.label}
            </p>
            <div className="flex flex-col gap-1">
              {category.items.map((item) => {
                const Icon = item.icon;
                // Match either the exact path or a deeper child route
                const isActive = item.end
                  ? pathname === item.path
                  : pathname === item.path || pathname.startsWith(item.path + "/");

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center gap-2.5 py-2 px-3 rounded-md no-underline text-[13px] transition-colors ${
                      isActive
                        ? "bg-brand-blue text-white font-medium"
                        : "text-brand-navy font-normal hover:bg-brand-light"
                    }`}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom footer — version label */}
      <div className="pt-4 mt-2 border-t border-brand-border">
        <p className="font-mono text-[9px] text-brand-muted tracking-wider2 uppercase m-0">
          {SITE.version} · TamaFlow
        </p>
      </div>
    </aside>
  );
}
