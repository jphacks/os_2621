import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";

const bodySchema = z.object({
  mood: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
});

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 気分チェックインは7日（SPEC §5.9）

// 気分チェックインを保存する
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "気分とエネルギーは1〜5で送ってください。");

  try {
    const admin = getAdmin();
    const { error } = await admin.from("checkins").insert({ user_id: userId, ...parsed.data });
    if (error) throw error;
    // 期限切れの記録は、保存のついでに消す
    await admin
      .from("checkins")
      .delete()
      .eq("user_id", userId)
      .lt("created_at", new Date(Date.now() - RETENTION_MS).toISOString());
    return NextResponse.json({ ok: true });
  } catch {
    console.warn("[checkin] failed");
    return jsonError(500);
  }
}
