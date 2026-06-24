"use client";

/**
 * Small copy-to-clipboard button. Renders as a lucide `Copy` icon; flips to
 * a teal `Check` for 1.5s on success. Falls back to a no-op feedback state
 * if the browser blocks clipboard access (e.g. insecure context).
 */
import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  /** The string to copy. Required — there's nothing to copy without it. */
  value: string;
  /** Optional accessible label; defaults to "Copy to clipboard". */
  label?: string;
  /** Pixel size of the icon. */
  size?: number;
  /** Extra Tailwind classes merged onto the button. */
  className?: string;
}

export default function CopyButton({
  value,
  label = "Copy to clipboard",
  size = 12,
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // Clipboard can be blocked in non-secure contexts; surface but don't
      // break the surrounding UI.
      console.warn("[CopyButton] clipboard write failed", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? "Copied!" : label}
      aria-label={label}
      className={`inline-flex items-center justify-center p-1 border-0 bg-transparent cursor-pointer rounded transition-colors ${
        copied ? "text-brand-ok" : "text-brand-muted hover:text-brand-navy"
      } ${className}`}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}
