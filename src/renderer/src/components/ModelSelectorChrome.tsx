import { WORDMARK } from '../theme'

/**
 * Visual chrome shared between the ModelSelector and the
 * AddCustomModelForm views. Wordmark is the Tamaflow logo
 * (`Tama` in NAVY + `flow` in BLUE); TealBar is the 3px accent
 * strip at the top of every card.
 */

export function Wordmark() {
  return (
    <p className="font-mono font-bold text-xl tracking-wide m-0">
      <span className="text-brand-navy">{WORDMARK.prefix}</span>
      <span className="text-brand-blue">{WORDMARK.suffix}</span>
    </p>
  )
}

export function TealBar() {
  return <div className="h-[3px] bg-brand-teal rounded-t" />
}
