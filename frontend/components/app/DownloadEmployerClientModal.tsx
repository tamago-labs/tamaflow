"use client";

/**
 * DownloadEmployerClientModal — opens when the user clicks the
 * "Download" button at the bottom of the Sidebar.
 *
 * The visual chrome (backdrop, card, entry animation, scroll lock,
 * Escape handling) is provided by the shared `<Modal>` component;
 * this file only owns the *content* of the modal.
 *
 * Shows: an explanation of the desktop app (local AI + Canton
 * settlement), a platforms grid, and the actual download CTA which
 * opens the GitHub repo in a new tab.
 */
import { motion } from "framer-motion";
import { X, Download, Github, Monitor, Apple, Sparkles } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { bottomLink } from "@/lib/nav";

interface DownloadEmployerClientModalProps {
  open: boolean;
  onClose: () => void;
}

const platforms = [
  {
    Icon: Monitor,
    label: "Windows",
    hint: ".exe installer",
  },
  {
    Icon: Apple,
    label: "Linux",
    hint: ".AppImage · .deb",
  },
  {
    Icon: Github,
    label: "Build from source",
    hint: "git clone · pnpm install",
  },
];

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
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
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
          <div>
            <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold mb-1">
              Desktop App
            </p>
            <h2
              id="download-employer-client-title"
              className="text-[22px] font-light text-brand-navy tracking-tight leading-tight m-0"
            >
              Download Employer Client
            </h2>
          </div>
        </div>

        {/* Body copy */}
        <p className="font-sans text-sm text-brand-navy/80 leading-relaxed m-0 mb-5">
          Run payroll entirely on your machine with{" "}
          <span className="font-semibold text-brand-navy">local AI</span>{" "}
          and atomic settlement on{" "}
          <span className="font-semibold text-brand-navy">Canton</span>.
          No cloud LLMs, no third-party LLM exposure.
        </p>

        {/* Feature pill */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.25 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-light border border-brand-border rounded-full mb-5"
        >
          <Sparkles size={12} className="text-brand-teal" />
          <span className="font-mono text-[10px] tracking-wider2 text-brand-navy uppercase font-semibold">
            100% local · 0% cloud LLM
          </span>
        </motion.div>
  
        {/* CTA — opens the GitHub repo in a new tab */}
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