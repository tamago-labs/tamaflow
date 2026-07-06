import { Atom, CircleDot, Fingerprint, Hexagon, Layers, Orbit } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'

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
 * This is a focused port of `frontend/components/shared/Logomark.tsx`
 * — same visual identity, simplified to drop the `cn` helper and the
 * legacy text-glyph experiments. If you need them back later, just
 * re-import the frontend component.
 */

export type LogomarkVariant =
  | 'hexagon'
  | 'atom'
  | 'orbit'
  | 'circle-dot'
  | 'fingerprint'
  | 'layers'

export type LogomarkBox =
  | 'solid' // solid navy fill, white glyph
  | 'duotone' // diagonal navy → blue split (default v1)
  | 'outlined' // transparent w/ navy 2px border
  | 'teal' // teal fill, navy glyph

export interface LogomarkProps {
  /** Visual mark style. Default: "hexagon". */
  variant?: LogomarkVariant
  /** Box style. Default: "duotone". */
  box?: LogomarkBox
  /** Box edge length in px. Default: 28. */
  size?: number
  /** Extra className for the outer box. */
  className?: string
  /** Optional aria-label override. Defaults to "TamaFlow". */
  label?: string
}

const LUCIDE_MAP: Record<LogomarkVariant, LucideIcon> = {
  hexagon: Hexagon,
  atom: Atom,
  orbit: Orbit,
  'circle-dot': CircleDot,
  fingerprint: Fingerprint,
  layers: Layers,
}

export default function Logomark({
  variant = 'hexagon',
  box = 'duotone',
  size = 28,
  className = '',
  label = 'TamaFlow',
}: LogomarkProps) {
  const boxClass = {
    solid: 'bg-brand-navy text-white',
    duotone: 'text-white',
    outlined: 'bg-transparent text-brand-navy border-2 border-brand-navy',
    teal: 'bg-brand-teal text-brand-navy',
  }[box]

  // The duotone is a clean 135° gradient that splits the box
  // exactly in half: top-left = brand-navy, bottom-right = brand-blue.
  // This needs inline `background` because Tailwind's `bg-gradient-to-br`
  // is a soft three-stop gradient, not a hard split, so we use a custom
  // linear-gradient with a hard stop.
  const duotoneStyle: CSSProperties = {
    background: 'linear-gradient(135deg, #0a0a5c 50%, #1A1AE8 50%)',
  }

  const style: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    ...(box === 'duotone' ? duotoneStyle : {}),
  }

  // Lucide icons are drawn at 24x24 in their own viewBox. We size the
  // inner glyph to ~60% of the box so it has comfortable padding —
  // matches the cap-height of the wordmark next to it.
  const glyphSize = Math.round(size * 0.6)
  const Lucide = LUCIDE_MAP[variant]

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-md font-mono font-bold leading-none select-none flex-shrink-0 ${boxClass} ${className}`}
      style={style}
    >
      <Lucide
        size={glyphSize}
        strokeWidth={2.5}
        // Lucide's default stroke is `currentColor`, which inherits
        // the box's text color. A slightly heavier stroke (2.5 vs 2.25)
        // keeps the icon crisp on the duotone box where half the
        // background is brand-blue (lighter than navy).
        aria-hidden
      />
    </span>
  )
}
