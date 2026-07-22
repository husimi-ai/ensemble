import { Users } from "lucide-react";
import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { RoomView } from "@/components/room/RoomView";
import { loadRoom } from "@/lib/rooms/data";

export const metadata: Metadata = { title: "Ensemble room" };

/**
 * Room page: server-load the room, membership, and initial thread under RLS
 * (task 012), then hand off to `RoomView` which subscribes to the room's
 * Realtime channel. A `null` load means the room doesn't exist or you're not a
 * member -- indistinguishable by design (fail closed).
 */
export default async function RoomPage({ params }: { params: { roomId: string } }) {
  const data = await loadRoom(params.roomId);

  if (!data) {
    return (
      <PagePlaceholder
        icon={Users}
        title="Room unavailable"
        description="This room doesn't exist, or you're not a member of it."
      />
    );
  }

  return <RoomView data={data} />;
}
