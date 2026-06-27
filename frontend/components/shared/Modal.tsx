"use client";

/**
 * Modal — the canonical animated overlay used by every modal in the
 * app (DownloadEmployerClientModal, AccountInfoModal, …).
 *
 * Rendered via createPortal into document.body so the backdrop covers
 * the whole viewport (including the fixed sidebar). framer-motion
 * provides the entrance/exit animation; AnimatePresence handles the
 * exit cleanly when the modal unmounts.
 *
 * Visual language (shared by every modal):
 *
 *   • Backdrop: `bg-brand-navy/60` + `backdrop-blur-sm`, fades 0→1 in 200ms
 *   • Card: spring entry (stiffness 320 / damping 28 / mass 0.9)
 *           scale 0.94 → 1, opacity 0 → 1, y 8 → 0
 *   • Card shadow: `0_30px_80px_-20px_rgba(10,10,92,0.45)`
 *   • z-index: [200] (above the sidebar at [100] and topbar at [50])
 *
 * Closing: backdrop click, Escape, or the consumer's own close button.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

interface ModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Called when the user wants to close (backdrop click, Escape, X). */
  onClose: () => void;
  /** Max-width Tailwind class for the card. Default: `max-w-md`. */
  maxWidth?: string;
  /** ARIA `aria-labelledby` id of the modal's title element. */
  ariaLabelledBy?: string;
  /** Extra className for the card (e.g. custom width). */
  className?: string;
  /** Modal contents — header / body / footer — go here. */
  children: React.ReactNode;
}

export default function Modal({
  open,
  onClose,
  maxWidth = "max-w-md",
  ariaLabelledBy,
  className = "",
  children,
}: ModalProps) {
  // SSR safety — `document` doesn't exist on the server, so we defer
  // the portal until after mount. `queueMicrotask` lands the setState
  // inside a callback (no synchronous setState-in-effect lint).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Escape closes the modal. We attach the listener only while open
  // so multiple modals don't stack key handlers.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Backdrop — clickable to close */}
          <motion.button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="absolute inset-0 bg-brand-navy/60 backdrop-blur-sm border-0 p-0 cursor-default"
            tabIndex={-1}
          />

          {/* Card — stop click propagation so clicks inside the card
              (copy buttons, inputs, etc.) don't bubble up to the backdrop's
              onClose handler. The backdrop button above closes only when
              the click lands on the backdrop itself. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 28,
              mass: 0.9,
            }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full ${maxWidth} bg-white border border-brand-border rounded-lg shadow-[0_30px_80px_-20px_rgba(10,10,92,0.45)] overflow-hidden ${className}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}