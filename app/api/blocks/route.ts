import { NextResponse } from "next/server";
import { z } from "zod";
import { endRoom, getAdmin, getUserId, jsonError, loadRoomAsMember, markLeft } from "@/lib/rooms/service";

const bodySchema = z.object({
  blocked_user_id: z.string().uuid(),
  room_id: z.string().uuid().optional(),
});

// ブロック: 記録して、ルームにいれば退出も行う。以後、互いに候補に出ない
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.blocked_user_id === userId) return jsonError(400);
  const { blocked_user_id, room_id } = parsed.data;

  try {
    const admin = getAdmin();
    const { error } = await admin
      .from("blocks")
      .upsert({ blocker: userId, blocked: blocked_user_id }, { onConflict: "blocker,blocked", ignoreDuplicates: true });
    if (error) throw error;

    if (room_id && (await loadRoomAsMember(admin, room_id, userId))) {
      await markLeft(admin, room_id, userId);
      await endRoom(admin, room_id, "left", null);
    }
    return NextResponse.json({ ok: true });
  } catch {
    console.warn("[blocks] failed");
    return jsonError(500);
  }
}
