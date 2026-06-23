"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Monitor, Apple, Github } from "lucide-react";

/**
 * DownloadDesktopApp — secondary CTA in the Hero, for the
 * *employer* audience.
 *
 *   "I'm an Employer" button
 *     └─ dropdown (Windows / Linux / Build from Source)
 *
 * All three install paths point to the GitHub repo so the user
 * lands on the releases / source regardless of which OS they
 * pick. (Swap to direct asset URLs once the build pipeline
 * publishes `.exe` / `.AppImage` artifacts.)
 *
 * Click-to-open dropdown. Closes on:
 *   • click on an option (navigates to GH)
 *   • click outside
 *   • Escape key
 */

const GITHUB_REPO = "https://github.com/tamago-labs/tamaflow";

interface DownloadOption {
  label: string;
  Icon: typeof Monitor;
  href: string;
  hint: string;
}

const options: DownloadOption[] = [
  {
    label: "Windows",
    Icon: Monitor,
    href: GITHUB_REPO,
    hint: ".exe installer",
  },
//   {
//     label: "Linux",
//     Icon: Apple,
//     href: GITHUB_REPO,
//     hint: ".AppImage · .deb",
//   },
  {
    label: "Build from Source",
    Icon: Github,
    href: GITHUB_REPO,
    hint: "git clone · pnpm install",
  },
];

export default function DownloadDesktopApp() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 py-3 px-6 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light transition-colors"
      >
        I'm an Employer
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 bg-white border border-brand-border rounded-md shadow-[0_18px_50px_-12px_rgba(10,10,92,0.25)] overflow-hidden z-50"
        >
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold px-4 pt-3 pb-2">
            Download Desktop App
          </p>
          <ul className="pb-1">
            {options.map(({ label, Icon, href, hint }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-light transition-colors no-underline group"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-md bg-brand-light border border-brand-border text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
                    <Icon size={16} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-[12px] font-bold tracking-wider2 text-brand-navy uppercase">
                      {label}
                    </span>
                    <span className="block font-mono text-[10px] text-brand-muted">
                      {hint}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
