import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";
import { loadAgeGroups, loadBlockedIds } from "@/lib/api/match";
import { isRiskBlocked } from "@/lib/api/risk";
import { isAgeCompatible } from "@/lib/matching/score";
import { getFacilitatorConfig } from "@/lib/facilitator/config";
import { composeFacilitatorText, insertMessage } from "@/lib/rooms/service";

const bodySchema = z.object({ accept: z.boolean() });
const DEMO_FAST = process.env.NEXT_PUBLIC_DEMO_FAST_TIMER === "true";

// リクエストへの承諾 / 見送り。承諾ならルームを作る（双方の同意）
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400);

  try {
    const admin = getAdmin();
    const { data: request } = await admin
      .from("match_requests")
      .select("id,from_user,to_user,from_summary,to_summary,status,expires_at")
      .eq("id", id)
      .maybeSingle();
    if (!request || request.to_user !== userId) return jsonError(404);
    if (request.status !== "pending" || new Date(request.expires_at).getTime() <= Date.now()) {
      return jsonError(409, "このお願いは、すでに終わっています。");
    }

    // 辞退: 理由は聞かない。送り手には「今回は見送られました」とだけ伝わる
    if (!parsed.data.accept) {
      await admin.from("match_requests").update({ status: "declined" }).eq("id", id).eq("status", "pending");
      return NextResponse.json({ ok: true });
    }

    // 承諾する前に、いまも安全につなげる状態か確認する（ブロック・危機）
    const blocked = await loadBlockedIds(admin, userId);
    if (blocked.includes(request.from_user) || (await isRiskBlocked(admin, userId)) || (await isRiskBlocked(admin, request.from_user))) {
      return jsonError(409, "いまは、つなぐことができません。");
    }

    // 年代が互換であり、どちらも設定済みのときだけつなぐ（承諾の時点でも確認する）
    const ages = await loadAgeGroups(admin, [request.from_user, request.to_user]);
    const fromAge = ages.get(request.from_user);
    const toAge = ages.get(request.to_user);
    if (!fromAge || !toAge || !isAgeCompatible(fromAge, toAge)) return jsonError(409, "いまは、つなぐことができません。");

    // 先に pending → accepted にした1回だけがルームを作る
    const { data: claimed } = await admin
      .from("match_requests")
      .update({ status: "accepted" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) return jsonError(409, "このお願いは、すでに終わっています。");

    const now = Date.now();
    const { data: room, error: roomError } = await admin
      .from("rooms")
      .insert({
        started_at: new Date(now).toISOString(),
        ends_at: new Date(now + getFacilitatorConfig(DEMO_FAST).ROOM_LIMIT_MS).toISOString(),
      })
      .select("id")
      .single();
    if (roomError || !room) throw roomError ?? new Error("room");

    await admin.from("room_members").insert([
      { room_id: room.id, user_id: request.from_user, summary_id: request.from_summary },
      { room_id: room.id, user_id: request.to_user, summary_id: request.to_summary },
    ]);
    await admin.from("match_requests").update({ room_id: room.id }).eq("id", id);

    // 司会の最初のあいさつ（双方が共有に同意した要約だけを使う。失敗したら固定文）
    const opening = await composeFacilitatorText(admin, room.id, "opening");
    if (opening) await insertMessage(admin, room.id, { sender_id: null, sender_type: "ai", body: opening });

    return NextResponse.json({ room_id: room.id });
  } catch {
    console.warn("[match/respond] failed");
    return jsonError(500);
  }
}
