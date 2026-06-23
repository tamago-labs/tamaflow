import { type ReactNode } from 'react'

/**
 * Reusable page header — small uppercase label, big title, optional
 * right slot for action buttons. Used by every placeholder page so the
 * layout stays consistent.
 */
interface PageHeaderProps {
  label: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

export default function PageHeader({ label, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8 gap-4">
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-2 m-0">
          {label}
        </p>
        <h1 className="text-[28px] font-light text-brand-navy tracking-tight leading-[1.15] m-0">
          {title}
        </h1>
        {subtitle && (
          <p className="font-sans text-sm text-brand-muted mt-2 mb-0 max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
