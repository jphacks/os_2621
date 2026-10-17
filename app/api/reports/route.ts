import { NextResponse } from "next/server";
import { z } from "zod";
import { endRoom, getAdmin, getUserId, jsonError, loadRoomAsMember } from "@/lib/rooms/service";

const bodySchema = z.object({
  reported_user_id: z.string().uuid(),
  room_id: z.string().uuid(),
  reason: z.enum(["aggressive", "pii", "uncomfortable", "other"]),
});

// 通報: 記録して、ルームを自動で終了する（BANは管理画面で手動）
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.reported_user_id === userId) return jsonError(400);
  const { reported_user_id, room_id, reason } = parsed.data;

  try {
    const admin = getAdmin();
    // 自分がメンバーのルームについてだけ通報できる
    if (!(await loadRoomAsMember(admin, room_id, userId))) return jsonError(403);

    const { error } = await admin.from("reports").insert({ reporter: userId, reported: reported_user_id, room_id, reason });
    if (error) throw error;

    await endRoom(admin, room_id, "report", "ルームが終了しました");
    return NextResponse.json({ ok: true });
  } catch {
    console.warn("[reports] failed", { room_id });
    return jsonError(500);
  }
}
