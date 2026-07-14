import { Hexagon } from 'lucide-react'
import type { CSSProperties } from 'react'

/**
 * Tamaflow logomark — the brand "box + icon" mark used in the desktop
 * splash, the splash-header, and (eventually) the in-app sidebar.
 *
 * Mirrors the frontend's `frontend/components/shared/Logomark.tsx`
 * (hexagon + duotone default) so the desktop boot screen and the
 * public marketing site read as the same product. The two-tone is a
 * 135° gradient that splits the box exactly in half: top-left
 * `brand-navy` ("Tama"), bottom-right `brand-blue` ("flow"). Tailwind
 * v4's `bg-gradient-to-br` is a soft three-stop gradient, so the
 * hard split is inline `linear-gradient(135deg, ... 50%, ... 50%)`.
 *
 * Variants (`box`):
 *   • `duotone` (default) — navy → blue hard split
 *   • `solid`            — solid brand-navy
 *   • `outlined`         — transparent + 2px navy border
 *   • `teal`             — brand-teal fill + brand-navy mark
 *
 * Variants (`variant`):
 *   • `hexagon` (default v1 mark) — same as the frontend header
 *   • `sparkles`                   — the legacy Tamarind mark, kept
 *     for backwards-compat with any in-flight splash work
 */

export type LogomarkBox = 'duotone' | 'solid' | 'outlined' | 'teal'
export type LogomarkVariant = 'hexagon' | 'sparkles'

export interface LogomarkProps {
  variant?: LogomarkVariant
  box?: LogomarkBox
  /** Box edge length in px. Default: 48. */
  size?: number
  /** Extra className for the outer box. */
  className?: string
  /** Optional aria-label override. Defaults to "Tamaflow". */
  label?: string
}

const boxClass: Record<LogomarkBox, string> = {
  duotone: 'text-white',
  solid: 'bg-brand-navy text-white',
  outlined: 'bg-transparent text-brand-navy border-2 border-brand-navy',
  teal: 'bg-brand-teal text-brand-navy'
}

const duotoneStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #0a0a5c 50%, #1A1AE8 50%)'
}

export function Logomark({
  variant = 'hexagon',
  box = 'duotone',
  size = 48,
  className = '',
  label = 'Tamaflow'
}: LogomarkProps) {
  // Lucide icons draw at 24×24 in their own viewBox; size the inner
  // glyph to ~60% of the box so the mark has comfortable padding
  // and matches the cap-height of the wordmark beside it.
  const glyphSize = Math.round(size * 0.6)
  const style: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    ...(box === 'duotone' ? duotoneStyle : {})
  }

  return (
    <span
      role='img'
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-md font-mono font-bold leading-none select-none flex-shrink-0 shadow-[0_8px_24px_-6px_rgba(26,26,232,0.45)] ${boxClass[box]} ${className}`}
      style={style}
    >
      {variant === 'hexagon' ? (
        <Hexagon
          size={glyphSize}
          strokeWidth={2.5}
          aria-hidden='true'
        />
      ) : null}
    </span>
  )
}

export default Logomark
