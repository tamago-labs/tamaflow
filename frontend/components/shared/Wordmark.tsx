import Link from "next/link";
import { WORDMARK } from "@/lib/theme";

/**
 * The TamaFlow wordmark — used in:
 *   • landing page navbar / footer
 *   • desktop-app sidebar (see app/Sidebar)
 *
 * Renders `Tama` in NAVY and `flow` in BLUE. Wraps in a Next.js Link
 * to the landing page by default. Pass `href={null}` or `as="span"` to
 * render without a wrapping anchor.
 */
export interface WordmarkProps {
  href?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
} as const;

export default function Wordmark({
  href = "/",
  size = "md",
  className = "",
}: WordmarkProps) {
  const inner = (
    <p
      className={`font-mono font-bold tracking-wide leading-none m-0 ${sizeMap[size]} ${className}`}
    >
      <span className="text-brand-navy">{WORDMARK.prefix}</span>
      <span className="text-brand-blue">{WORDMARK.suffix}</span>
    </p>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="no-underline">
      {inner}
    </Link>
  );
}
