import BrandLockup from "./BrandLockup";

/**
 * The TamaFlow wordmark.
 *
 * After the v1 rebrand, the wordmark renders with the `Hexagon`
 * lucide icon on a diagonal navy → blue duotone box. The two-tone
 * reflects the wordmark's own two-colour split ("Tama" navy +
 * "flow" blue) so the lockup forms a single visual unit.
 *
 * This component is a thin shim over `BrandLockup` and is kept
 * around so existing call sites keep working without changes.
 *
 * If you ever need to render the wordmark *without* the new
 * mark, import `BrandLockup` directly and pass `mark={false}`.
 */

export interface WordmarkProps {
  /** Link target. `null` → no anchor. Default: "/" */
  href?: string | null;
  /** Size step. Default: "md". */
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional className on the wrapper. */
  className?: string;
}

export default function Wordmark({
  href = "/",
  size = "md",
  className,
}: WordmarkProps) {
  return (
    <BrandLockup
      href={href}
      mark="hexagon"
      box="duotone"
      size={size}
      className={className}
    />
  );
}
