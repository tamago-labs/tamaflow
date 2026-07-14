// PageHeader — used by the Settings page. Mirrors the
// frontend's `components/app/PageHeader.tsx`: small uppercase mono
// label, big light-weight title, optional subtitle + right-side
// actions. The new Tamaflow design system (DM Sans / brand-navy)
// means the title is sans + tracking-tight, the label is the only
// mono micro-text in the block.

import type { ReactNode } from 'react'

interface PageHeaderProps {
  label: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ label, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className='mb-8 flex items-start justify-between gap-4'>
      <div className='min-w-0'>
        <p className='m-0 mb-2 font-mono text-[11px] font-medium uppercase tracking-wider3 text-brand-muted'>
          {label}
        </p>
        <h1 className='m-0 text-[28px] font-light leading-[1.15] tracking-tight text-brand-navy'>
          {title}
        </h1>
        {subtitle && (
          <p className='m-0 mt-2 max-w-2xl font-sans text-sm text-brand-muted'>{subtitle}</p>
        )}
      </div>
      {actions && <div className='flex flex-shrink-0 items-center gap-2'>{actions}</div>}
    </div>
  )
}

export default PageHeader
