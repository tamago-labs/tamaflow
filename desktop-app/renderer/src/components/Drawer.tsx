// Right-side slide-in drawer. Used for the Employee add/edit form
// and other forms that need to keep the underlying list visible.

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
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
        <div key='drawer-root' className='fixed inset-0 z-[200]' role='dialog' aria-modal='true' aria-label={title}>
          <motion.button
            type='button'
            aria-label='Close'
            className='absolute inset-0 cursor-default border-0 bg-black/40'
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          />
          <motion.aside
            key='drawer-panel'
            className='absolute right-0 top-0 flex h-full flex-col border-l border-brand-border bg-white shadow-xl'
            style={{ width }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className='absolute left-0 right-0 top-0 h-[3px] bg-brand-teal' />
            <div className='flex flex-shrink-0 items-start justify-between gap-3 border-b border-brand-border px-6 py-5'>
              <div className='min-w-0'>
                <h2 className='m-0 font-sans text-lg font-medium text-brand-navy'>{title}</h2>
                {subtitle && (
                  <p className='m-0 mt-1 font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'>
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type='button'
                onClick={onClose}
                aria-label='Close'
                className='flex-shrink-0 cursor-pointer rounded border-0 bg-transparent p-1 text-brand-muted hover:bg-brand-light hover:text-brand-navy'
              >
                <X size={16} />
              </button>
            </div>
            <div className='flex-1 overflow-y-auto px-6 py-5'>{children}</div>
            {footer && (
              <div className='flex-shrink-0 border-t border-brand-border bg-brand-light/50 px-6 py-4'>
                {footer}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
