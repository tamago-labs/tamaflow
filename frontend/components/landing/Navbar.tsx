"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import Wordmark from "@/components/shared/Wordmark";
import { marketingNav, marketingMore } from "@/lib/nav";

/**
 * Sticky landing-page navbar.
 *
 *   Left   — wordmark
 *   Mid    — 3 anchor links (How it works, Features, Why Canton)
 *           + a "More ▾" dropdown (GitHub in v1, expandable)
 *   Right  — "Employee Dashboard" CTA (links to /app)
 *
 * On small screens the mid links collapse into a hamburger drawer.
 * The More dropdown is flattened into a regular <a> in the drawer
 * (dropdowns on touch drawers are clunky).
 *
 * Background switches from transparent → 80%-opaque white once the
 * user scrolls past 16px so the bar remains readable on the hero.
 */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close "More" dropdown on outside-click
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        moreRef.current &&
        !moreRef.current.contains(e.target as Node)
      ) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [moreOpen]);

  // Close "More" dropdown on Escape
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

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
              className="font-sans text-xs font-semibold tracking-wider2 text-brand-navy uppercase no-underline hover:text-brand-blue transition-colors"
            >
              {item.label}
            </a>
          ))}

          {/* "More ▾" dropdown */}
          {marketingMore.length > 0 && (
            <div ref={moreRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
                className="font-sans text-xs font-semibold tracking-wider2 text-brand-navy uppercase cursor-pointer bg-transparent border-0 p-0 mb-2 inline-flex items-center gap-1 leading-none hover:text-brand-blue transition-colors"
              >
                More
                <ChevronDown
                  size={12}
                  className={`transition-transform ${
                    moreOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-56 bg-white border border-brand-border rounded-md shadow-[0_18px_50px_-12px_rgba(10,10,92,0.25)] overflow-hidden z-50"
                >
                  <ul className="py-1">
                    {marketingMore.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          target={item.external ? "_blank" : undefined}
                          rel={item.external ? "noreferrer" : undefined}
                          role="menuitem"
                          onClick={() => setMoreOpen(false)}
                          className="flex items-center px-4 py-2.5 hover:bg-brand-light transition-colors no-underline"
                        >
                          <span className="font-sans text-xs font-bold tracking-wider2 text-brand-navy uppercase">
                            {item.label}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Right-side CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-brand-blue text-white rounded-md font-mono text-xs font-bold tracking-wider2 uppercase no-underline hover:opacity-90 transition-opacity"
          > 
            Employee Portal 
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
                className="font-sans text-xs font-semibold tracking-wider2 text-brand-navy uppercase no-underline"
              >
                {item.label}
              </a>
            ))}

            {/* Flatten the "More" dropdown into the drawer */}
            {marketingMore.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                onClick={() => setOpen(false)}
                className="font-sans text-xs font-semibold tracking-wider2 text-brand-navy uppercase no-underline"
              >
                {item.label}
              </a>
            ))}

            <Link
              href="/app"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-brand-blue text-white rounded-md font-mono text-xs font-bold tracking-wider2 uppercase no-underline"
            > 
              Employee Portal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
