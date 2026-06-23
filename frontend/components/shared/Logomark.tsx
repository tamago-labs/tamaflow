import {
  Atom,
  Orbit,
  CircleDot,
  Fingerprint,
  Hexagon,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TamaFlow logomark — the brand "box + icon" mark.
 *
 *   Default: `Hexagon` (lucide) on a diagonal navy → blue duotone.
 *
 * The two-tone reflects the wordmark beside it: top-left half is
 * `brand-navy` ("Tama"), bottom-right half is `brand-blue` ("flow").
 * The two colours meet exactly where "Tama" becomes "flow" in the
 * text, so the icon + wordmark form a single visual unit.
 *
 * Each `variant` is a real `lucide-react` icon, so the brand mark
 * stays consistent with the rest of the icon system, gets free
 * accessibility (`role="img"` + `aria-label`), and scales crisply
 * from a 16px favicon to a 96px hero mark.
 *
 * The legacy text-glyph variants (`brace`, `ball`, `t`, `dots`,
 * `tail`) are kept around for experimentation — pass them via the
 * `mark` prop on `BrandLockup` to swap.
 */

export type LogomarkVariant =
  // Lucide icons (default v1 mark + alternates)
  | "hexagon"
  | "atom"
  | "orbit"
  | "circle-dot"
  | "fingerprint"
  | "layers"
  // Legacy text-glyph variants (kept for experimentation)
  | "brace"
  | "ball"
  | "t"
  | "dots"
  | "tail";

export type LogomarkBox =
  | "solid" // solid navy fill
  | "duotone" // diagonal navy → blue split (default v1)
  | "outlined" // transparent w/ navy 2px border
  | "teal"; // teal fill w/ navy mark

export interface LogomarkProps {
  /** Visual mark style. Default: "hexagon". */
  variant?: LogomarkVariant;
  /** Box style. Default: "duotone". */
  box?: LogomarkBox;
  /** Box edge length in px. Default: 28. */
  size?: number;
  /** Extra className for the outer box. */
  className?: string;
  /** Optional aria-label override. Defaults to "TamaFlow". */
  label?: string;
}

const sizeMap = {
  sm: 20,
  md: 28,
  lg: 40,
  xl: 56,
} as const;

export default function Logomark({
  variant = "hexagon",
  box = "duotone",
  size,
  className,
  label = "TamaFlow",
}: LogomarkProps) {
  const px = size ?? sizeMap.md;

  const boxClass = {
    solid: "bg-brand-navy text-white",
    duotone: "text-white",
    outlined: "bg-transparent text-brand-navy border-2 border-brand-navy",
    teal: "bg-brand-teal text-brand-navy",
  }[box];

  // The duotone is a clean 135° gradient that splits the box
  // exactly in half: top-left = brand-navy, bottom-right = brand-blue.
  // This needs inline `background` because Tailwind's
  // `bg-gradient-to-br` is a soft three-stop gradient, not a hard
  // split, so we use a custom linear-gradient with a hard stop.
  const duotoneStyle: React.CSSProperties = {
    background:
      "linear-gradient(135deg, #0a0a5c 50%, #1A1AE8 50%)",
  };

  const style: React.CSSProperties = {
    width: `${px}px`,
    height: `${px}px`,
    ...(box === "duotone" ? duotoneStyle : {}),
  };

  // Lucide icons are drawn at 24x24 in their own viewBox. We size the
  // inner glyph to ~60% of the box so it has comfortable padding —
  // matches the cap-height of the wordmark next to it.
  const glyphSize = Math.round(px * 0.6);

  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-mono font-bold leading-none select-none flex-shrink-0",
        boxClass,
        className,
      )}
      style={style}
    >
      <MarkGlyph variant={variant} size={glyphSize} />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lucide map — each lucide icon is imported once and reused per variant.    */
/* -------------------------------------------------------------------------- */
const LUCIDE_MAP: Record<string, LucideIcon> = {
  hexagon: Hexagon,
  atom: Atom,
  orbit: Orbit,
  "circle-dot": CircleDot,
  fingerprint: Fingerprint,
  layers: Layers,
};

function MarkGlyph({
  variant,
  size,
}: {
  variant: LogomarkVariant;
  size: number;
}) {
  const Lucide = LUCIDE_MAP[variant];
  if (Lucide) {
    return (
      <Lucide
        size={size}
        strokeWidth={2.5}
        aria-hidden
        // Lucide's default stroke is `currentColor`, which inherits the
        // box's text color. A slightly heavier stroke (2.5 vs 2.25)
        // keeps the icon crisp on the duotone box where half the
        // background is brand-blue (lighter than navy).
      />
    );
  }
  // Legacy text-glyph variants
  return <LegacyGlyph variant={variant} />;
}

/* -------------------------------------------------------------------------- */
/*  Legacy text glyphs — kept so call sites that pass "brace" etc. keep      */
/*  working without changes.                                                  */
/* -------------------------------------------------------------------------- */
function LegacyGlyph({ variant }: { variant: LogomarkVariant }) {
  switch (variant) {
    case "brace":
      return (
        <span
          className="font-mono font-bold tracking-tighter whitespace-pre"
          aria-hidden
          style={{ fontSize: "0.55em" }}
        >
          {"{ }"}
        </span>
      );
    case "t":
      return (
        <span className="leading-none" aria-hidden>
          T
        </span>
      );
    case "ball":
      return (
        <span
          aria-hidden
          className="block rounded-full bg-current"
          style={{ width: "38%", height: "38%" }}
        />
      );
    case "dots":
      return (
        <span aria-hidden className="relative inline-block w-[55%] h-[55%]">
          <span className="absolute top-0 left-0 w-[35%] h-[35%] rounded-full bg-current" />
          <span className="absolute bottom-0 right-0 w-[55%] h-[55%] rounded-full bg-current" />
        </span>
      );
    case "tail":
      return (
        <span aria-hidden className="relative inline-block">
          <span className="leading-none">T</span>
          <span
            className="absolute top-[55%] left-[60%] h-[2px] bg-current"
            style={{ width: "60%" }}
          />
        </span>
      );
    default:
      return null;
  }
}
