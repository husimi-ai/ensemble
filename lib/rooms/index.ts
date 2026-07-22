/**
 * Room data surface. Import via `@/lib/rooms`.
 *
 * `loadRoom` is server-only (pulls the request-scoped Supabase client);
 * client components should import the view-model types from `@/lib/rooms/types`
 * directly to avoid dragging `next/headers` into their bundle.
 */
export { loadRoom, loadMyRooms } from "./data";
export { MESSAGE_COLUMNS, mapMessageRow, type MessageRow } from "./map";
export type { RoomData, RoomMember, RoomSummary } from "./types";
