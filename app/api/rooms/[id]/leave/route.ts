import { NextResponse } from "next/server";
import { endRoom, getAdmin, getUserId, jsonError, loadRoomAsMember, markLeft } from "@/lib/rooms/service";

// 退出: 確認なしで即座に退出する。相手には「退出しました」だけを伝える
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;

  const userId = await getUserId();
  if (!userId) return jsonError(401);

  try {
    const admin = getAdmin();
    const room = await loadRoomAsMember(admin, roomId, userId);
    if (!room) return jsonError(403);

    await markLeft(admin, roomId, userId);
    await endRoom(admin, roomId, "left", null);
    return NextResponse.json({ ok: true });
  } catch {
    console.warn("[room] leave failed", { roomId });
    return jsonError(500);
  }
}
