"use client";

/**
 * DownloadEmployerClientModal — opens when the user clicks the
 * "Download" button at the bottom of the Sidebar.
 *
 * The visual chrome (backdrop, card, entry animation, scroll lock,
 * Escape handling) is provided by the shared `<Modal>` component;
 * this file only owns the *content* of the modal.
 *
 * Layout (top → bottom):
 *   1. Icon + title on a single row — minimal, brand-anchored
 *   2. Body copy — the product promise, in one paragraph
 *   3. Primary CTA — "Download Page" → opens the GitHub repo in a new tab
 *
 * No platforms grid, no feature pills — the body copy carries the
 * full message. The CTA is the single action.
 */
import { motion } from "framer-motion";
import { X, Download } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { bottomLink } from "@/lib/nav";

interface DownloadEmployerClientModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DownloadEmployerClientModal({
  open,
  onClose,
}: DownloadEmployerClientModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-md"
      ariaLabelledBy="download-employer-client-title"
    >
      {/* Close X */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-md text-brand-muted hover:text-brand-navy hover:bg-brand-light transition-colors z-10"
      >
        <X size={16} />
      </button>

      <div className="p-6 lg:p-8">
        {/* Header — single row, icon + title */}
        <div className="flex items-center gap-3 mb-5">
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.08,
              type: "spring",
              stiffness: 360,
              damping: 22,
            }}
            className="inline-flex items-center justify-center w-11 h-11 rounded-md bg-brand-navy text-white flex-shrink-0"
          >
            <Download size={20} />
          </motion.span>
          <h2
            id="download-employer-client-title"
            className="text-[22px] font-light text-brand-navy tracking-tight leading-tight m-0"
          >
            Download Employer Client
          </h2>
        </div>

        {/* Body copy — one paragraph: install + local AI + private Canton settlement */}
        <p className="font-sans text-sm text-brand-navy/80 leading-relaxed m-0 mb-5">
          Install the desktop client to process payroll with{" "}
          <span className="font-semibold text-brand-navy">local AI</span> so
          sensitive employee data never leaves the machine and
          settle via the{" "}
          <span className="font-semibold text-brand-navy">
            Canton network
          </span>
          .
        </p>

        {/* Primary CTA — opens the GitHub repo in a new tab */}
        <motion.a
          href={bottomLink.href}
          target="_blank"
          rel="noreferrer"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase no-underline hover:opacity-90 transition-opacity shadow-[0_4px_18px_-6px_rgba(26,26,232,0.45)]"
        >
          <Download size={14} />
          Download Page
        </motion.a>
      </div>
    </Modal>
  );
}
