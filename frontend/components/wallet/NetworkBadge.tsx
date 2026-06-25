"use client";

/**
 * NetworkBadge — the network switcher in the top bar.
 *
 *   Visual: same gray chrome as the *idle* `Connect Wallet` button
 *   (white bg, navy text, brand-border) so the two right-side actions
 *   pair visually. Trailing `ChevronDown` + click-to-open dropdown.
 *
 *   A small teal dot before the label communicates "active / selected"
 *   status without screaming.
 *
 * Behaviour:
 *   • Click the trigger → toggle dropdown
 *   • Click outside → close
 *   • Escape → close
 *   • Pick an item → close (no-op for now since there's only Devnet;
 *     future networks can wire up an `onSelect` callback)
 *
 * Adding new networks later is a one-line append to `NETWORKS`.
 */
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

interface Network {
  key: string;
  label: string;
  /** Whether this is the currently-connected network (shows ✓ + active dot) */
  active?: boolean;
  /** Optional visual hint shown under the label (e.g. "Canton DM") */
  hint?: string;
}

// v1 ships with just Devnet. Adding Testnet / Mainnet later is a
// one-line append + an `onSelect` handler in the parent.
const NETWORKS: Network[] = [
  { key: "devnet", label: "Devnet", active: true, hint: "Canton DevNet" },
];

export default function NetworkBadge() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside-click
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
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

  const active = NETWORKS.find((n) => n.active) ?? NETWORKS[0];

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger — same chrome as the idle Connect Wallet button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-1 transition-colors group"
      >
        {/* Active-network dot */}
        <span
          className="w-1.5 h-1.5 rounded-full bg-brand-teal flex-shrink-0"
          aria-hidden
        />
        <span>{active.label}</span>
        <ChevronDown
          size={12}
          className={`text-brand-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 min-w-[180px] bg-white border border-brand-border rounded-md shadow-[0_18px_50px_-12px_rgba(10,10,92,0.25)] overflow-hidden z-50"
        >
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold px-3 pt-2.5 pb-1.5">
            Switch network
          </p>
          <ul className="pb-1">
            {NETWORKS.map((n) => (
              <li key={n.key}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-brand-light transition-colors"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-[11px] font-bold tracking-wider2 text-brand-navy uppercase">
                      {n.label}
                    </span>
                    {n.hint && (
                      <span className="block font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
                        {n.hint}
                      </span>
                    )}
                  </span>
                  {n.active && (
                    <Check
                      size={14}
                      className="text-brand-teal flex-shrink-0"
                      strokeWidth={3}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}