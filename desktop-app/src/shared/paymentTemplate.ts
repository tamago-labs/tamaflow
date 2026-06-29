// Runtime sentinel for the built-in Direct Payment tile. Mirrors
// `DIRECT_PAYMENT_TEMPLATE_ID` declared in `preload/index.d.ts` for
// the type system. Always use this runtime value (not the type-level
// alias) in `.ts` files; the .d.ts version is only there to make the
// Payment template lookup types resilient without an extra import.

/**
 * Sentinel id for the built-in Direct Payment tile. Stored in
 * `PaymentFields.templateId` only when the user explicitly wants to
 * pin it (undefined also resolves to Direct Payment — this is purely
 * a documentation aid / future-proofing hook).
 */
export const DIRECT_PAYMENT_TEMPLATE_ID = 'direct'
