// Shared placeholder page. Renders a centered icon + title + a
// short "coming soon" line. Used by every Tamaflow page that
// hasn't shipped yet (Chat, Shareable, Employees,
// Settlements, Assets). Flow Builder renders the real
// FlowBuilderPage instead.

import type { LucideIcon } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
}

export function PlaceholderPage({
  title,
  description,
  icon: Icon
}: PlaceholderPageProps) {
  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center text-center'>
      <div className='mb-5 flex h-16 w-16 items-center justify-center rounded-md border border-brand-border bg-brand-light'>
        <Icon size={26} className='text-brand-navy' aria-hidden='true' />
      </div>
      <p className='mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider3 text-brand-muted'>
        {title}
      </p>
      <h1 className='mb-2 text-3xl font-light tracking-tight text-brand-navy'>
        Coming soon
      </h1>
      <p className='max-w-md text-sm leading-relaxed text-brand-muted'>
        {description}
      </p>
    </div>
  )
}

export default PlaceholderPage
