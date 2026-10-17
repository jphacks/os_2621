import { after, NextResponse } from "next/server";
import { z } from "zod";
import { afterMessage } from "@/lib/facilitator/analyze";
import { detectCrisisL1 } from "@/lib/safety/detectCrisis";
import { maskPii } from "@/lib/safety/piiMask";
import { endRoom, getAdmin, getUserId, insertMessage, jsonError, loadRoomAsMember, markLeft } from "@/lib/rooms/service";
import type { MessageResponse } from "@/types/room";

const bodySchema = z.object({ body: z.string().trim().min(1).max(500) });

// メッセージ送信: マスク → L1の危機判定 → 保存 → （配信後に非同期で）L2と司会
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;

  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "メッセージは1〜500文字で入力してください。");
  const original = parsed.data.body;

  try {
    const admin = getAdmin();
    const room = await loadRoomAsMember(admin, roomId, userId);
    if (!room) return jsonError(403);

    // 終了済み、または時間切れのルームには送れない（サーバー側でも拒否する）
    if (room.status !== "active") return jsonError(409, "このルームは終了しました。");
    if (Date.now() >= new Date(room.ends_at).getTime()) {
      await endRoom(admin, roomId, "timeout", "時間になったので、ルームを終了しました。");
      return jsonError(409, "このルームは終了しました。");
    }

    // L1: 危機を表す発言は配信しない。本人にだけ知らせ、相手には理由を伏せる
    if (detectCrisisL1(original).level === "crisis") {
      await markLeft(admin, roomId, userId);
      await endRoom(admin, roomId, "safety", "ルームが終了しました");
      console.warn("[room] L1 crisis", { roomId, userId });
      return NextResponse.json<MessageResponse>({ type: "crisis" });
    }

    const { text, masked } = maskPii(original);
    const messageId = await insertMessage(admin, roomId, {
      sender_id: userId,
      sender_type: "user",
      body: text,
      masked,
    });

    after(() => afterMessage(admin, roomId, messageId, userId));

    return NextResponse.json<MessageResponse>({ type: "ok", masked });
  } catch {
    console.warn("[room] message failed", { roomId });
    return jsonError(500);
  }
}
