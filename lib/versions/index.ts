/**
 * Version endgame (C13/C14) -- public surface. Import via `@/lib/versions`.
 * Groups a room's paper+codebase submission (`submitVersion`) and its history
 * loader (`loadGroupVersions`), plus the shared view-model types.
 */
export type { GroupVersion, SubmitResult } from "./types";
export { submitVersion } from "./submit";
export { loadGroupVersions } from "./data";
