/**
 * Runtime constants for TamaFlow. Color values are duplicated here for
 * any non-Tailwind contexts (e.g. inline styles, SVG fills, dynamic
 * JS-driven theme changes). The source of truth for utility classes
 * is `app/globals.css` (Tailwind v4 @theme).
 */

/** Wordmark parts. `prefix` renders in NAVY, `suffix` in BLUE. */
export const WORDMARK = {
  prefix: "Tama",
  suffix: "flow",
} as const;

/** Site-level metadata. */
export const SITE = {
  name: "TamaFlow",
  tagline: "AI Auto-Payroll on Canton",
  shortDesc:
    "Privacy-first payroll that nets cross-border obligations and settles atomically on Canton — without ever leaking data to a third-party LLM.",
  url: "https://tamaflow.xyz",
  twitter: "@tamaflow",
  version: "v0.1",
} as const;

/** Reusable Tailwind className bundles — keeps components terse. */
export const STYLES = {
  card: "bg-white border border-brand-border rounded-md",
  pillBlue: "inline-flex items-center font-mono text-[10px] font-bold rounded-full px-2.5 py-0.5 tracking-wider2 uppercase border border-brand-blue text-brand-blue bg-[#eaeefc]",
  pillTeal: "inline-flex items-center font-mono text-[10px] font-bold rounded-full px-2.5 py-0.5 tracking-wider2 uppercase border border-brand-teal text-brand-tealAccent bg-[#eafaf8]",
  pillOk: "inline-flex items-center font-mono text-[10px] font-bold rounded-full px-2.5 py-0.5 tracking-wider2 uppercase border border-brand-ok text-brand-ok bg-[#e6f7ee]",
  label: "font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold",
  labelLarge: "font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase",
  title: "text-[28px] font-light text-brand-navy tracking-tight leading-[1.15]",
  subtitle: "font-sans text-sm text-brand-muted",
  buttonPrimary:
    "inline-flex items-center gap-2 py-2.5 px-5 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 transition-opacity",
  buttonSecondary:
    "inline-flex items-center gap-2 py-2.5 px-5 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light transition-colors",
  buttonOutlineBlue:
    "inline-flex items-center gap-1.5 py-1.5 px-3 bg-white text-brand-blue border border-brand-blue rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light transition-colors",
} as const;
