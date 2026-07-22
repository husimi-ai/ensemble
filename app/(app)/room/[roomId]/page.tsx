import { Users } from "lucide-react";
import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = { title: "Ensemble room" };

/**
 * Empty room shell. The multi-author chat + shared AI participant are wired in
 * tasks 005 (message UI) and 012 (realtime).
 */
export default function RoomPage({ params }: { params: { roomId: string } }) {
  return (
    <PagePlaceholder
      icon={Users}
      title="Ensemble room"
      description={`Room ${params.roomId}. The multi-author chat and shared AI participant land here.`}
    />
  );
}
