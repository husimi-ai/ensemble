/**
 * Thin back-compat re-export so existing `@/lib/types` imports keep resolving
 * after the domain model was split into `lib/types/`. The real definitions
 * live in `lib/types/index.ts`; import from either path.
 */

export * from "./types/index";
