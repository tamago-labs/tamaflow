// Shared modal shell used by every wallet modal (Setup, AccountInfo,
// ExportKey, ConfirmDestroy). Framer-motion overlay + animated
// card. Closes on backdrop click or X.

import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

interface WalletModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  /** Tailwind max-width class. Default `max-w-md`. */
  maxWidth?: string
}

export function WalletModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-md'
}: WalletModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key='wallet-modal-backdrop'
          className='fixed inset-0 z-[200] flex items-center justify-center'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <motion.button
            type='button'
            aria-label='Close'
            className='absolute inset-0 cursor-default border-0 bg-black/40'
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            key='wallet-modal-card'
            role='dialog'
            aria-modal='true'
            aria-label={title}
            className={`relative mx-4 w-full max-h-[85vh] overflow-y-auto rounded-md border border-brand-border bg-white p-6 shadow-xl ${maxWidth}`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className='mb-4 flex items-start justify-between gap-3'>
              <div>
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
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default WalletModal
