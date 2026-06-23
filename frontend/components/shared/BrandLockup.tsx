import Link from "next/link";
import { cn } from "@/lib/utils";
import { WORDMARK } from "@/lib/theme";
import Logomark, {
  type LogomarkBox,
  type LogomarkVariant,
} from "./Logomark";

/**
 * BrandLockup — composes the Logomark with the wordmark into a single
 * brand unit. Use this everywhere the brand needs to appear together
 * (navbar, footer, OG card, etc.).
 *
 *   `<Logomark>` (navy box w/ `{ }`)  +  `Tama flow` (mono)
 *
 * Pass `mark={false}` to render the wordmark alone (current behaviour
 * before the rebrand), or `mark="ball" | "t" | "dots" | "tail"` to
 * experiment with the other concepts. The default is `mark="brace"`
 * (the brand-approved option for v1).
 *
 * Sizing is tied to the `size` prop: each step multiplies both the
 * box edge length and the text size by the same factor so the
 * lockup stays proportional.
 */

const sizeMap = {
  sm: { mark: 20, text: "text-base" },
  md: { mark: 28, text: "text-lg" },
  lg: { mark: 36, text: "text-xl" },
  xl: { mark: 48, text: "text-2xl" },
} as const;

export interface BrandLockupProps {
  /** Optional link target. `null` renders without an anchor. */
  href?: string | null;
  /** Which mark variant to show. `false` hides it. */
  mark?: LogomarkVariant | false;
  /** Box style for the mark. */
  box?: LogomarkBox;
  /** Overall scale. */
  size?: keyof typeof sizeMap;
  /** Optional extra className on the wrapper. */
  className?: string;
}

export default function BrandLockup({
  href = "/",
  mark = "brace",
  box = "solid",
  size = "md",
  className,
}: BrandLockupProps) {
  const { mark: markSize, text } = sizeMap[size];

  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 leading-none no-underline",
        className,
      )}
    >
      {mark && <Logomark variant={mark} box={box} size={markSize} />}
      <span
        className={cn(
          "font-mono font-bold tracking-wide",
          text,
        )}
      >
        <span className="text-brand-navy">{WORDMARK.prefix}</span>
        <span className="text-brand-blue">{WORDMARK.suffix}</span>
      </span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="no-underline">
      {inner}
    </Link>
  );
}
