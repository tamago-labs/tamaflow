/**
 * Tiny utility helpers used across the app.
 *
 * The codebase intentionally avoids pulling in `clsx` / `tailwind-merge`
 * to keep the bundle small — a single concat-and-filter is enough for
 * our needs. If the surface grows, swap this for `clsx` + `twMerge`.
 */

/**
 * Merge class names — falsy values (`false`, `null`, `undefined`,
 * empty string) are dropped, the rest are joined with a single space.
 *
 * @example
 *   cn("base", isActive && "active", className)
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
