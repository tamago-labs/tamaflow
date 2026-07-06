import { WORDMARK } from '../theme'
import Logomark from './Logomark'

/**
 * Visual chrome shared between the ModelSelector and the
 * AddCustomModelForm views.
 *
 * `Wordmark` is the brand lockup: a duotone Hexagon Logomark next to
 * the `Tama` (navy) + `flow` (blue) mono wordmark. Sizing is passed
 * through to both pieces so they stay proportional.
 *
 * `TealBar` is the 3px accent strip at the top of every card.
 */

interface WordmarkProps {
  /** Box edge length of the Logomark in px. Default: 24. */
  markSize?: number
  /** Tailwind text-size class for the wordmark. Default: `text-xl`. */
  textSize?: string
  /** Pass false to drop the mark and render the wordmark alone. */
  showMark?: boolean
  /** Extra className on the wrapper span. */
  className?: string
}

export function Wordmark({
  markSize = 24,
  textSize = 'text-xl',
  showMark = true,
  className = '',
}: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 leading-none ${className}`}>
      {showMark && <Logomark size={markSize} />}
      <p className={`font-mono font-bold tracking-wide m-0 ${textSize}`}>
        <span className="text-brand-navy">{WORDMARK.prefix}</span>
        <span className="text-brand-blue">{WORDMARK.suffix}</span>
      </p>
    </span>
  )
}

export function TealBar() {
  return <div className="h-[3px] bg-brand-teal rounded-t" />
}
