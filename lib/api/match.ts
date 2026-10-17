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

export function toMatchSummary(r: SummaryRow, ageGroup?: AgeGroup): MatchSummary {
  return {
    ageGroup,
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

/** すでにリクエスト中、またはルームが進行中の相手のID */
export async function loadActiveMatchIds(admin: AdminClient, userId: string): Promise<string[]> {
  const ids = new Set<string>();

  const { data: reqs } = await admin
    .from("match_requests")
    .select("from_user,to_user")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .or(`from_user.eq.${userId},to_user.eq.${userId}`);
  (reqs ?? []).forEach((r) => ids.add(r.from_user === userId ? r.to_user : r.from_user));

  const { data: mine } = await admin.from("room_members").select("room_id").eq("user_id", userId);
  const roomIds = (mine ?? []).map((m) => m.room_id);
  if (roomIds.length > 0) {
    const { data: active } = await admin.from("rooms").select("id").in("id", roomIds).eq("status", "active");
    const activeIds = (active ?? []).map((r) => r.id);
    if (activeIds.length > 0) {
      const { data: others } = await admin.from("room_members").select("user_id").in("room_id", activeIds);
      (others ?? []).forEach((o) => o.user_id !== userId && ids.add(o.user_id));
    }
  }
  return [...ids];
}

/** ユーザーの年代区分。未設定・不正な値は含めない（= 候補にしない。fail-closed） */
export async function loadAgeGroups(admin: AdminClient, userIds: string[]): Promise<Map<string, AgeGroup>> {
  const map = new Map<string, AgeGroup>();
  if (userIds.length === 0) return map;
  const { data } = await admin.from("profiles").select("id,age_group").in("id", userIds);
  (data ?? []).forEach((p) => isValidAgeGroup(p.age_group) && map.set(p.id, p.age_group));
  return map;
}
