import { NextResponse } from "next/server";
import { z } from "zod";
import { getFacilitatorConfig } from "@/lib/facilitator/config";
import { decideIntervention } from "@/lib/facilitator/decide";
import { detectCrisisL1 } from "@/lib/safety/detectCrisis";
import {
  DEDUPE_WINDOW_MS,
  composeFacilitatorText,
  endRoom,
  getAdmin,
  getUserId,
  insertMessage,
  jsonError,
  loadRoomAsMember,
  msSinceLastAi,
} from "@/lib/rooms/service";

// Vercel で、LLMの呼び出しが途中で打ち切られないように（秒）
export const maxDuration = 60;

const bodySchema = z.object({ event: z.enum(["time_warning", "closing", "silence"]) });
const DEMO_FAST = process.env.NEXT_PUBLIC_DEMO_FAST_TIMER === "true";

// 時間の経過・沈黙で司会を呼ぶ（クライアントのタイマーから）。2人とも送るので、重複は無視する
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;

  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400);
  const { event } = parsed.data;

  try {
    const admin = getAdmin();
    const room = await loadRoomAsMember(admin, roomId, userId);
    if (!room) return jsonError(403);
    if (room.status !== "active") return NextResponse.json({ ok: true, skipped: "ended" });

    const now = Date.now();
    const startedAt = new Date(room.started_at).getTime();
    const endsAt = new Date(room.ends_at).getTime();

    // 時刻はサーバー側でも確認する（クライアントの時計に頼らない）
    if (event === "time_warning") {
      if (now - startedAt < ((endsAt - startedAt) * 5) / 6) return NextResponse.json({ ok: true, skipped: "early" });
      if ((await msSinceLastAi(admin, roomId)) < DEDUPE_WINDOW_MS) {
        return NextResponse.json({ ok: true, skipped: "duplicate" });
      }
      const text = await composeFacilitatorText(admin, roomId, "time_warning");
      if (text) await insertMessage(admin, roomId, { sender_id: null, sender_type: "ai", body: text });
      return NextResponse.json({ ok: true });
    }

    if (event === "silence") {
      const cfg = getFacilitatorConfig(DEMO_FAST);
      const { data: lastMsg } = await admin
        .from("room_messages")
        .select("created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1);
      const lastTime = lastMsg?.[0]?.created_at ? new Date(lastMsg[0].created_at).getTime() : startedAt;
      const silenceMs = now - lastTime;
      const sinceAi = await msSinceLastAi(admin, roomId);
      const action = decideIntervention({
        elapsedMs: now - startedAt,
        timeWarningAlreadySent: true,
        silenceMs,
        msSinceLastIntervention: Number.isFinite(sinceAi) ? sinceAi : null,
        config: cfg,
      });
      if (!action.shouldIntervene || action.trigger !== "silence") {
        return NextResponse.json({ ok: true, skipped: "not_needed" });
      }
      const text = await composeFacilitatorText(admin, roomId, "silence");
      if (text && detectCrisisL1(text).level !== "crisis") {
        await insertMessage(admin, roomId, { sender_id: null, sender_type: "ai", body: text });
      }
      return NextResponse.json({ ok: true });
    }

    // closing: 終了のあいさつを入れてルームを閉じる（先に閉じた1回だけ実行される）
    if (now < endsAt - 2000) return NextResponse.json({ ok: true, skipped: "early" });
    const text = await composeFacilitatorText(admin, roomId, "closing");
    const ended = await endRoom(admin, roomId, "timeout", null);
    if (ended && text) await insertMessage(admin, roomId, { sender_id: null, sender_type: "ai", body: text });
    return NextResponse.json({ ok: true });
  } catch {
    console.warn("[room] facilitate failed", { roomId });
    return jsonError(500);
  }
}
