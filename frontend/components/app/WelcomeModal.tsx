"use client";

import { useState, type ReactNode } from "react";
import Modal from "@/components/shared/Modal";

/**
 * WelcomeModal — auto-opens every time the user lands on the
 * dashboard. Explains that this is the dev version of TamaFlow and
 * what they can already do here:
 *
 *   1. Connect Loop wallet → see Canton party ID
 *   2. Download the desktop app → build a payroll flow and pay
 *      into this account
 *   3. Build flows two ways: direct payment to a freelancer, or
 *      local-employee pay with automatic withholding for taxes
 *      and social security
 *
 * No "don't show again" — the user wants the modal on every
 * dashboard visit. Closing unmounts it; the next /app route mount
 * re-opens it via the `useState(true)` initialiser.
 */
export default function WelcomeModal() {
  const [open, setOpen] = useState(true);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="max-w-lg"
      ariaLabelledBy="welcome-modal-title"
    >
      <div className="p-8">
        <p className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold mb-2">
          Welcome
        </p>
        <h2
          id="welcome-modal-title"
          className="text-2xl font-light text-brand-navy leading-tight"
        >
          This is the dev version of{" "}
          <span className="text-brand-blue">TamaFlow</span>.
        </h2>
        <p className="mt-3 text-sm text-brand-navy/70 leading-relaxed">
          You&apos;re at the Employer Portal — it&apos;s early, but
          here&apos;s what you can already do here:
        </p>
        <ol className="mt-5 space-y-3 text-sm text-brand-navy/80">
          <Step num="01">
            Connect your Loop wallet to see your Canton party ID.
          </Step>
          <Step num="02">
            Download the desktop app to build a payroll flow and
            pay into this account.
          </Step>
          <Step num="03">
            Build flows two ways:
            <ul className="mt-1.5 ml-4 space-y-1 text-brand-navy/70 list-disc">
              <li>Direct payment to a freelancer, or</li>
              <li>
                Pay a local employee in the same jurisdiction with
                automatic withholding for taxes and social security.
              </li>
            </ul>
          </Step>
        </ol>
        <div className="mt-7 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 py-2.5 px-6 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Step({ num, children }: { num: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold mt-0.5 flex-shrink-0">
        {num}
      </span>
      <div>{children}</div>
    </li>
  );
}
