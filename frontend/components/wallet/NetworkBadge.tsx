"use client";

/**
 * Static "DevNet" pill rendered in the top bar. Currently read-only — when
 * multi-network support is added, this becomes the network switcher trigger
 * and the prop is widened to include a click handler.
 */
import { STYLES } from "@/lib/theme";

export default function NetworkBadge() {
  return (
    <span
      className={STYLES.pillBlue}
      title="Canton DevNet"
      aria-label="Network: DevNet"
    >
      DevNet
    </span>
  );
}
