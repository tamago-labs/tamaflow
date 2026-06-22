// Runtime constants for the renderer. Color palette lives in
// `tailwind.config.js`; this file is reserved for runtime-only values
// that are awkward to express as Tailwind classes (e.g. animation
// durations, the splash delay, the model-selector card max width).

/** Wordmark parts. Matches the `MedLife` / `Sim` split in the
 *  my-doctor-ai design. `prefix` is rendered in NAVY, `suffix` in
 *  the accent color (BLUE). */
export const WORDMARK = {
  prefix: 'Tama',
  suffix: 'flow',
} as const

/** Splash → model-selector transition delay (ms). */
export const SPLASH_DELAY_MS = 250

/** How long the LoadingScreen waits after the model reports
 *  `isReady = true` before advancing to the Ready page. Lets the
 *  progress bar land on 100% and the "Ready" label flash. */
export const LOADING_COMPLETE_DELAY_MS = 400
