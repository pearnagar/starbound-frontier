declare const brandTag: unique symbol

/**
 * Nominal typing helper: makes structurally-identical IDs (e.g. PlayerId vs
 * CaptainId) incompatible with each other and with plain strings, so a
 * PlayerId can't be passed where a different branded ID is expected.
 */
export type Brand<T, TBrand extends string> = T & { readonly [brandTag]: TBrand }
