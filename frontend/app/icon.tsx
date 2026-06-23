import { ImageResponse } from "next/og";

/**
 * TamaFlow app icon — the `Hexagon` lucide mark on a diagonal
 * navy → blue duotone box.
 *
 * Next.js will generate the favicon (and apple-touch-icon) at
 * every required size from this file. Renders the same
 * duotone mark as the in-app Logomark, so the browser tab,
 * mobile home screen, and OG previews all share one identity.
 *
 * Uses `ImageResponse` (the same engine that powers Vercel OG
 * images) so we don't have to ship a separate `.ico`/`.png`
 * asset for each size.
 *
 * The Hexagon SVG path is inlined here (rather than imported
 * from `lucide-react`) because `ImageResponse` runs server-side
 * with its own React renderer and doesn't ship the lucide tree.
 */

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          // Diagonal duotone: top-left = navy ("Tama"),
          // bottom-right = blue ("flow"). Hard 50/50 stop so it
          // reads as a clean split, not a gradient.
          background: "linear-gradient(135deg, #0a0a5c 50%, #1A1AE8 50%)",
          color: "#ffffff",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Hexagon — same path data as lucide-react's Hexagon icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
