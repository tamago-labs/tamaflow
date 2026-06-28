// Theme constants used by the flow builder canvas. Mirrors the colors
// from my-doctor-ai's theme.ts so the ported canvas components stay
// visually consistent. Keep these in sync with `tailwind.config.js`'s
// `brand.*` palette.
//
// Used only by `flow/` components (Canvas, CanvasCard, etc.) where we
// still use inline styles for geometry. The rest of the app uses
// Tailwind classes.

export const BLUE = '#1A1AE8'
export const TEAL = '#3EC4C0'
export const NAVY = '#0a0a5c'
export const MUTED = '#9999bb'
export const LIGHT_BLUE = '#f7f7fc'
export const BORDER = '#e0e0f0'

export const monoFont = "'Space Mono', monospace"
export const sansFont = "'DM Sans', sans-serif"