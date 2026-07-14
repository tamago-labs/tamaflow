"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { topItems, navCategories } from "@/lib/nav";
import BrandLockup from "@/components/shared/BrandLockup";
import HowToUseModal from "./HowToUseModal";

/**
 * Fixed 200px left navigation for the in-app shell (Employee Portal).
 *
 *   topItems       — top-level items, no label (Dashboard / Assets /
 *                     Payments / Rewards Hub)
 *   navCategories  — Account category (Identification / Security /
 *                     Account Statement / Settings)
 *   bottomLink     — single utility button at the bottom
 *                     (Download → opens DownloadEmployerClientModal)
 *
 * Active link = brand-blue fill + white text; hover = brand-light.
 *
 * Uses `usePathname()` so server-side prefetched links can be
 * highlighted without a full router context.
 */
export default function Sidebar() {
  const pathname = usePathname() ?? "";
  const [howToUseOpen, setHowToUseOpen] = useState(false);

  return (
    <>
      <aside
        className="fixed top-0 left-0 w-[200px] h-screen bg-white border-r border-brand-border flex flex-col z-[100] box-border"
        style={{ padding: "24px 16px" }}
      >
        {/* Wordmark — links back to the landing page */}
        <div className="mb-8">
          <BrandLockup href="/" mark="hexagon" box="duotone" size="md" />
        </div>

        {/* Nav items: top section + category + bottom button */}
        <nav className="flex flex-col gap-4 flex-1 overflow-y-auto">
          {/* Top-level items (no category label) */}
          <div className="flex flex-col gap-1">
            {topItems.map((item) => {
              const Icon = item.icon;
              // Match either the exact path or a deeper child route
              const isActive = item.end
                ? pathname === item.path
                : pathname === item.path ||
                  pathname.startsWith(item.path + "/");

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

          {/* Categorized items */}
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
                    : pathname === item.path ||
                      pathname.startsWith(item.path + "/");

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

        {/* Bottom utility button — How to Use */}
        <div className="pt-4 mt-2 border-t border-brand-border">
          <button
            type="button"
            onClick={() => setHowToUseOpen(true)}
            className="flex items-center gap-2.5 py-2 px-3 rounded-md w-full bg-transparent border-0 cursor-pointer text-brand-muted hover:text-brand-navy hover:bg-brand-light transition-colors group"
          >
            <HelpCircle
              size={16}
              className="flex-shrink-0 group-hover:text-brand-blue"
            />
            <span className="font-sans text-[13px] text-brand-muted group-hover:text-brand-navy">
              What's New
            </span>
          </button>
        </div>
      </aside>

      {/* How to Use modal — opens when the bottom button is clicked */}
      <HowToUseModal
        open={howToUseOpen}
        onClose={() => setHowToUseOpen(false)}
      />
    </>
  );
}