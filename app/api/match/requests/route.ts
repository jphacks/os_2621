import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";
import {
  loadActiveMatchIds,
  loadAgeGroups,
  loadBlockedIds,
  loadDemoUserIds,
  loadMySummary,
  toMatchSummary,
  type SummaryRow,
} from "@/lib/api/match";
import { isRiskBlocked } from "@/lib/api/risk";
import { getFacilitatorConfig } from "@/lib/facilitator/config";
import { isAgeCompatible, isEligibleCandidate } from "@/lib/matching/score";
import { composeFacilitatorText, insertMessage } from "@/lib/rooms/service";
import type { ReceivedRequestDto, SentRequestDto } from "@/types/api";

const MAX_PENDING_SENT = 3; // 同時に送れるのは3件まで（SPEC §5.5）
const EXPIRES_MS = 24 * 60 * 60 * 1000;
const DEMO_FAST = process.env.NEXT_PUBLIC_DEMO_FAST_TIMER === "true";

const bodySchema = z.object({ to_user: z.string().uuid(), to_summary: z.string().uuid() });
const cancelSchema = z.object({ id: z.string().uuid() });

// リクエストを送る（相手からすでに自分宛ての有効なリクエストが届いている場合は、双方同意として即座にルームを作成する）
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400);
  const { to_user, to_summary } = parsed.data;
  if (to_user === userId) return jsonError(400);

  try {
    const admin = getAdmin();
    if (await isRiskBlocked(admin, userId)) return jsonError(403, "今は少し時間をおきましょう。");

    const mine = await loadMySummary(admin, userId);
    if (!mine) return jsonError(403, "共有した内容がありません。");

    const nowIso = new Date().toISOString();

    // 相手の要約が、いまも候補にしてよいものか（同意・期限・crisis・ブロック・共倒れ防止）をサーバーで確認する
    const { data: target } = await admin.from("summaries").select("*").eq("id", to_summary).eq("user_id", to_user).maybeSingle();
    if (!target) return jsonError(404, "この方には、いまはお願いできません。");
    const [blockedUserIds, activeMatchUserIds, ages] = await Promise.all([
      loadBlockedIds(admin, userId),
      loadActiveMatchIds(admin, userId),
      loadAgeGroups(admin, [userId, to_user]),
    ]);
    const myAge = ages.get(userId);
    const targetAge = ages.get(to_user);
    if (!myAge) return jsonError(403, "年代がまだ選ばれていません。設定から選んでください。");
    if (
      !isEligibleCandidate(toMatchSummary(mine, myAge), toMatchSummary(target as SummaryRow, targetAge), {
        blockedUserIds,
        activeMatchUserIds,
      })
    ) {
      return jsonError(409, "この方には、いまはお願いできません。");
    }
    // 相手が危機の状態なら、理由は伏せて同じ表示にする
    if (await isRiskBlocked(admin, to_user)) return jsonError(409, "この方には、いまはお願いできません。");

    // すでに相手（to_user）から自分（userId）へ pending リクエストが届いている場合は、双方の同意成立として即時ルームを作成する
    const { data: reverseReq } = await admin
      .from("match_requests")
      .select("id,from_user,to_user,from_summary,to_summary,status,expires_at")
      .eq("from_user", to_user)
      .eq("to_user", userId)
      .eq("status", "pending")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reverseReq && targetAge && isAgeCompatible(myAge, targetAge)) {
      const { data: claimed } = await admin
        .from("match_requests")
        .update({ status: "accepted", to_summary: mine.id })
        .eq("id", reverseReq.id)
        .eq("status", "pending")
        .select("id");

      if (claimed?.length) {
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
          { room_id: room.id, user_id: reverseReq.from_user, summary_id: reverseReq.from_summary ?? to_summary },
          { room_id: room.id, user_id: userId, summary_id: mine.id },
        ]);
        await admin.from("match_requests").update({ room_id: room.id }).eq("id", reverseReq.id);

        const opening = await composeFacilitatorText(admin, room.id, "opening");
        if (opening) await insertMessage(admin, room.id, { sender_id: null, sender_type: "ai", body: opening });

        return NextResponse.json({ id: reverseReq.id, room_id: room.id, matched: true });
      }
    }

    // 同時に送れるリクエスト上限（3件）の確認。
    // デモ用シードユーザー（ログイン不可で承諾されない）へのリクエストが上限を塞いでいる場合は、古いデモ宛てリクエストを自動的に整理して実在ユーザーへの送信を優先する。
    const { data: pendingReqs } = await admin
      .from("match_requests")
      .select("id,to_user,created_at")
      .eq("from_user", userId)
      .eq("status", "pending")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: true });
    const pendingList = pendingReqs ?? [];
    if (pendingList.length >= MAX_PENDING_SENT) {
      const demoIds = await loadDemoUserIds(admin, pendingList.map((r) => r.to_user));
      const oldestDemoReq = pendingList.find((r) => demoIds.has(r.to_user));
      if (oldestDemoReq) {
        await admin.from("match_requests").update({ status: "expired" }).eq("id", oldestDemoReq.id);
      } else {
        return jsonError(429, "同時にお願いできるのは3人までです。");
      }
    }

    const { data, error } = await admin
      .from("match_requests")
      .insert({
        from_user: userId,
        to_user,
        from_summary: mine.id,
        to_summary,
        expires_at: new Date(Date.now() + EXPIRES_MS).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch {
    console.warn("[match/requests] create failed");
    return jsonError(500);
  }
}

// 送った / 届いたリクエスト
export async function GET() {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  try {
    const admin = getAdmin();
    const nowIso = new Date().toISOString();

    // 期限切れは、アクセス時に expired にする
    await admin
      .from("match_requests")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", nowIso)
      .or(`from_user.eq.${userId},to_user.eq.${userId}`);

    const { data: rows } = await admin
      .from("match_requests")
      .select("id,from_user,to_user,from_summary,status,expires_at,room_id")
      .or(`from_user.eq.${userId},to_user.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50);
    const list = rows ?? [];

    const otherIds = [...new Set(list.map((r) => (r.from_user === userId ? r.to_user : r.from_user)))];
    const incomingSenders = [...new Set(list.filter((r) => r.to_user === userId).map((r) => r.from_user))];
    const summaryIds = list.filter((r) => r.to_user === userId && r.from_summary).map((r) => r.from_summary as string);
    const [{ data: profiles }, { data: summariesById }, { data: summariesByUser }] = await Promise.all([
      otherIds.length ? admin.from("profiles").select("id,nickname,avatar").in("id", otherIds) : { data: [] },
      summaryIds.length ? admin.from("summaries").select("id,share_text").in("id", summaryIds) : { data: [] },
      incomingSenders.length
        ? admin.from("summaries").select("user_id,share_text").in("user_id", incomingSenders).eq("share_consent", true)
        : { data: [] },
    ]);
    const profileOf = new Map((profiles ?? []).map((p) => [p.id, p]));
    const textOf = new Map((summariesById ?? []).map((s) => [s.id, s.share_text]));
    const textByUserOf = new Map((summariesByUser ?? []).map((s) => [s.user_id, s.share_text]));

    const received: ReceivedRequestDto[] = list
      .filter((r) => r.to_user === userId)
      .map((r) => ({
        id: r.id,
        from_nickname: profileOf.get(r.from_user)?.nickname ?? "",
        from_avatar: profileOf.get(r.from_user)?.avatar ?? "",
        share_text: (r.from_summary ? textOf.get(r.from_summary) : undefined) ?? textByUserOf.get(r.from_user) ?? "",
        status: r.status,
        expires_at: r.expires_at,
      }));
    const sent: SentRequestDto[] = list
      .filter((r) => r.from_user === userId)
      .map((r) => ({
        id: r.id,
        to_nickname: profileOf.get(r.to_user)?.nickname ?? "",
        to_avatar: profileOf.get(r.to_user)?.avatar ?? "",
        status: r.status,
        expires_at: r.expires_at,
        room_id: r.room_id,
      }));
    return NextResponse.json({ received, sent });
  } catch {
    console.warn("[match/requests] list failed");
    return jsonError(500);
  }
}

// 送った pending リクエストを取り消す
export async function DELETE(req: Request) {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const urlId = new URL(req.url).searchParams.get("id");
  const body = await req.json().catch(() => null);
  const parsed = cancelSchema.safeParse(urlId ? { id: urlId } : body);
  if (!parsed.success) return jsonError(400);

  try {
    const admin = getAdmin();
    await admin
      .from("match_requests")
      .delete()
      .eq("id", parsed.data.id)
      .eq("from_user", userId)
      .eq("status", "pending");
    return NextResponse.json({ ok: true });
  } catch {
    console.warn("[match/requests] cancel failed");
    return jsonError(500);
  }
}
