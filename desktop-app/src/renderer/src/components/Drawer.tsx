import { ReactNode, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Right-side slide-in drawer. Used for the Employee add/edit form.
 *
 * Unlike the centered `WalletModal`, the drawer keeps the underlying
 * list visible to the left so the user retains context — handy when
 * editing an existing row. Same brand-blue/teal 3px top accent as
 * `WalletModal` for visual consistency.
 *
 * The `stopPropagation` discipline (no clicks inside the panel bubble
 * to the backdrop) is critical — same gotcha noted in MEMORY.md for
 * `WalletModal`. Without it, clicking a select inside the form would
 * close the drawer.
 */
interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  /** Optional footer slot (action buttons). */
  footer?: ReactNode
  /** Width — default '480px'. Tailwind doesn't allow dynamic widths. */
  width?: string
}

export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = '480px'
}: DrawerProps) {
  // Close on Escape (matches WalletModal).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div
          key="drawer-root"
          className="fixed inset-0 z-[200]"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40 border-0 cursor-default"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          />

          {/* Panel — slides in from the right */}
          <motion.aside
            key="drawer-panel"
            className="absolute top-0 right-0 h-full bg-white shadow-xl border-l border-brand-border flex flex-col"
            style={{ width }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Teal top accent — matches sidebar / WalletModal */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand-teal" />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-brand-border flex-shrink-0">
              <div className="min-w-0">
                <h2 className="font-sans text-lg font-medium text-brand-navy m-0">
                  {title}
                </h2>
                {subtitle && (
                  <p className="font-mono text-[10px] uppercase tracking-wider2 text-brand-muted m-0 mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex-shrink-0 bg-transparent border-0 text-brand-muted cursor-pointer p-1 rounded hover:bg-brand-light hover:text-brand-navy"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body — scrolls independently */}
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

            {/* Footer — typically Cancel + Save actions */}
            {footer && (
              <div className="flex-shrink-0 px-6 py-4 border-t border-brand-border bg-brand-light/50">
                {footer}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}