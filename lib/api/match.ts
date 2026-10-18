import "server-only";
import type { AdminClient } from "@/lib/api/common";
import { isValidAgeGroup, type AgeGroup, type MatchSummary } from "@/lib/matching/score";

export type SummaryRow = {
  id: string;
  user_id: string;
  share_text: string;
  category: MatchSummary["category"];
  tags: string[];
  energy: number;
  stage: MatchSummary["stage"];
  risk_level: MatchSummary["riskLevel"];
  share_consent: boolean;
  expires_at: string;
};

export function toMatchSummary(r: SummaryRow, ageGroup?: AgeGroup, isDemo?: boolean): MatchSummary {
  return {
    ageGroup,
    isDemo,
    id: r.id,
    userId: r.user_id,
    category: r.category,
    tags: r.tags,
    energy: r.energy,
    stage: r.stage,
    riskLevel: r.risk_level,
    shareConsent: r.share_consent,
    expiresAt: r.expires_at,
  };
}

/** 本人の、共有中で有効な最新の要約 */
export async function loadMySummary(admin: AdminClient, userId: string): Promise<SummaryRow | null> {
  const { data } = await admin
    .from("summaries")
    .select("*")
    .eq("user_id", userId)
    .eq("share_consent", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SummaryRow | null) ?? null;
}

/** どちらかがブロックしている相手のID（双方向） */
export async function loadBlockedIds(admin: AdminClient, userId: string): Promise<string[]> {
  const { data } = await admin.from("blocks").select("blocker,blocked").or(`blocker.eq.${userId},blocked.eq.${userId}`);
  return (data ?? []).map((b) => (b.blocker === userId ? b.blocked : b.blocker));
}

/**
 * すでに自分がリクエスト送信済み、または現在有効なルームが進行中の相手のID
 * ※ 相手から自分に届いている pending リクエスト（to_user = userId）は除外しない
 *   （候補一覧にも表示し、双方がリクエストボタンを押した際に相互合意として即マッチング成立させるため）
 */
export async function loadActiveMatchIds(admin: AdminClient, userId: string): Promise<string[]> {
  const ids = new Set<string>();
  const nowIso = new Date().toISOString();

  const { data: reqs } = await admin
    .from("match_requests")
    .select("to_user")
    .eq("from_user", userId)
    .eq("status", "pending")
    .gt("expires_at", nowIso);
  (reqs ?? []).forEach((r) => ids.add(r.to_user));

  const { data: mine } = await admin.from("room_members").select("room_id").eq("user_id", userId);
  const roomIds = (mine ?? []).map((m) => m.room_id);
  if (roomIds.length > 0) {
    // 期限（ends_at）を過ぎたまま active で残っている古いルームは自動終了する
    await admin
      .from("rooms")
      .update({ status: "ended", end_reason: "timeout" })
      .in("id", roomIds)
      .eq("status", "active")
      .lte("ends_at", nowIso);

    const { data: active } = await admin
      .from("rooms")
      .select("id")
      .in("id", roomIds)
      .eq("status", "active")
      .gt("ends_at", nowIso);
    const activeIds = (active ?? []).map((r) => r.id);
    if (activeIds.length > 0) {
      const { data: others } = await admin.from("room_members").select("user_id").in("room_id", activeIds);
      (others ?? []).forEach((o) => o.user_id !== userId && ids.add(o.user_id));
    }
  }
  return [...ids];
}

/** 自分宛てに届いている有効な pending リクエストの Map<from_user, request_id> */
export async function loadIncomingRequestMap(admin: AdminClient, userId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data } = await admin
    .from("match_requests")
    .select("id,from_user")
    .eq("to_user", userId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());
  (data ?? []).forEach((r) => map.set(r.from_user, r.id));
  return map;
}

/** ユーザーの年代区分。未設定・不正な値は含めない（= 候補にしない。fail-closed。ただしデモ用シードで未設定の場合は university に補完） */
export async function loadAgeGroups(admin: AdminClient, userIds: string[]): Promise<Map<string, AgeGroup>> {
  const map = new Map<string, AgeGroup>();
  if (userIds.length === 0) return map;
  const { data } = await admin.from("profiles").select("id,age_group,is_demo").in("id", userIds);
  (data ?? []).forEach((p) => {
    if (isValidAgeGroup(p.age_group)) {
      map.set(p.id, p.age_group);
    } else if (p.is_demo) {
      map.set(p.id, "university");
    }
  });
  return map;
}

/** デモ用シードユーザー（is_demo = true）のID集合を取得する */
export async function loadDemoUserIds(admin: AdminClient, userIds: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (userIds.length === 0) return set;
  const { data } = await admin.from("profiles").select("id,is_demo").in("id", userIds);
  (data ?? []).forEach((p) => {
    if (p.is_demo) set.add(p.id);
  });
  return set;
}
