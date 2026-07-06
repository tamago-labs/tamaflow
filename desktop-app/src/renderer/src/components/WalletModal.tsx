import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Shared modal shell used by every wallet modal (Setup, AccountInfo,
 * Faucet, ExportKey, ConfirmDestroy). Fixed overlay + animated card.
 * Closes on backdrop click or X.
 */

interface WalletModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  maxWidth?: string // tailwind class, default 'max-w-md'
}

export default function WalletModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-md',
}: WalletModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="wallet-modal-backdrop"
          className="fixed inset-0 z-[200] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40 border-0 cursor-default"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            key="wallet-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative bg-white rounded-md shadow-xl border border-brand-border ${maxWidth} w-full mx-4 p-6 max-h-[85vh] overflow-y-auto`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
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
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
