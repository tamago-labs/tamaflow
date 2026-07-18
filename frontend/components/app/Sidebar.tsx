"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { topItems, navCategories } from "@/lib/nav";
import BrandLockup from "@/components/shared/BrandLockup";
import HowToUseModal from "./HowToUseModal";

export default function Sidebar() {
  const pathname = usePathname() ?? "";
  const [howToUseOpen, setHowToUseOpen] = useState(true);

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

        {/* Nav items */}
        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {topItems.map((item) => {
            const Icon = item.icon;
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

          {/* Categories */}
          {navCategories.map((cat) => (
            <div key={cat.key} className="mt-4">
              <p className="px-3 mb-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-brand-muted">
                {cat.label}
              </p>
              {cat.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
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
          ))}
        </nav>

        {/* Bottom utility button — What's New */}
        <div className="pt-4 mt-2 border-t border-brand-border">
          <button
            type="button"
            onClick={() => setHowToUseOpen(true)}
            className="flex items-center gap-2.5 py-2 px-3 rounded-md w-full bg-transparent border-0 cursor-pointer text-brand-navy hover:bg-brand-light transition-colors group"
          >
            <HelpCircle size={16} className="flex-shrink-0 group-hover:text-brand-blue" />
            <span className="font-sans text-[13px]">What&apos;s New</span>
          </button>
        </div>
      </aside>

      <HowToUseModal
        open={howToUseOpen}
        onClose={() => setHowToUseOpen(false)}
      />
    </>
  );
}
