"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ArrowUpRight } from "lucide-react";
import Wordmark from "@/components/shared/Wordmark";
import { marketingNav } from "@/lib/nav";

/**
 * Sticky landing-page navbar.
 *
 *   Left  — wordmark
 *   Mid   — anchor links to the marketing sections
 *   Right — "Launch App" CTA (links to /app)
 *
 * On small screens the mid links collapse into a hamburger drawer.
 * Background switches from transparent → 80%-opaque white once the
 * user scrolls past 16px so the bar remains readable on the hero.
 */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-colors ${
        scrolled
          ? "bg-white/85 backdrop-blur border-brand-border"
          : "bg-white/0 border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-6">
        <Wordmark size="md" />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7 flex-1 justify-center">
          {marketingNav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="font-mono text-[11px] font-semibold tracking-wider2 text-brand-navy uppercase no-underline hover:text-brand-blue transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right-side CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase no-underline hover:opacity-90 transition-opacity"
          >
            Launch App
            <ArrowUpRight size={12} />
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex items-center justify-center w-10 h-10 border border-brand-border rounded-md bg-white"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-brand-border bg-white">
          <div className="px-6 py-4 flex flex-col gap-3">
            {marketingNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="font-mono text-[11px] font-semibold tracking-wider2 text-brand-navy uppercase no-underline"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/app"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase no-underline"
            >
              Launch App
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
