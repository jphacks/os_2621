import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";
import { loadActiveMatchIds, loadAgeGroups, loadBlockedIds, loadMySummary, toMatchSummary, type SummaryRow } from "@/lib/api/match";
import { isRiskBlocked } from "@/lib/api/risk";
import { isEligibleCandidate } from "@/lib/matching/score";
import type { ReceivedRequestDto, SentRequestDto } from "@/types/api";

const MAX_PENDING_SENT = 3; // 同時に送れるのは3件まで（SPEC §5.5）
const EXPIRES_MS = 24 * 60 * 60 * 1000;

const bodySchema = z.object({ to_user: z.string().uuid(), to_summary: z.string().uuid() });

// リクエストを送る
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
    const { count } = await admin
      .from("match_requests")
      .select("id", { count: "exact", head: true })
      .eq("from_user", userId)
      .eq("status", "pending")
      .gt("expires_at", nowIso);
    if ((count ?? 0) >= MAX_PENDING_SENT) return jsonError(429, "同時にお願いできるのは3人までです。");

    // 相手の要約が、いまも候補にしてよいものか（同意・期限・crisis・ブロック・共倒れ防止）をサーバーで確認する
    const { data: target } = await admin.from("summaries").select("*").eq("id", to_summary).eq("user_id", to_user).maybeSingle();
    if (!target) return jsonError(404, "この方には、いまはお願いできません。");
    const [blockedUserIds, activeMatchUserIds] = await Promise.all([
      loadBlockedIds(admin, userId),
      loadActiveMatchIds(admin, userId),
    ]);
    const ages = await loadAgeGroups(admin, [userId, to_user]);
    if (!ages.get(userId)) return jsonError(403, "年代がまだ選ばれていません。設定から選んでください。");
    if (
      !isEligibleCandidate(toMatchSummary(mine, ages.get(userId)), toMatchSummary(target as SummaryRow, ages.get(to_user)), {
        blockedUserIds,
        activeMatchUserIds,
      })
    ) {
      return jsonError(409, "この方には、いまはお願いできません。");
    }
    // 相手が危機の状態なら、理由は伏せて同じ表示にする
    if (await isRiskBlocked(admin, to_user)) return jsonError(409, "この方には、いまはお願いできません。");

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
    const summaryIds = list.filter((r) => r.to_user === userId && r.from_summary).map((r) => r.from_summary as string);
    const [{ data: profiles }, { data: summaries }] = await Promise.all([
      otherIds.length ? admin.from("profiles").select("id,nickname,avatar").in("id", otherIds) : { data: [] },
      summaryIds.length ? admin.from("summaries").select("id,share_text").in("id", summaryIds) : { data: [] },
    ]);
    const profileOf = new Map((profiles ?? []).map((p) => [p.id, p]));
    const textOf = new Map((summaries ?? []).map((s) => [s.id, s.share_text]));

    const received: ReceivedRequestDto[] = list
      .filter((r) => r.to_user === userId)
      .map((r) => ({
        id: r.id,
        from_nickname: profileOf.get(r.from_user)?.nickname ?? "",
        from_avatar: profileOf.get(r.from_user)?.avatar ?? "",
        share_text: textOf.get(r.from_summary ?? "") ?? "",
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
