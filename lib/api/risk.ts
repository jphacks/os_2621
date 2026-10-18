import "server-only";
import type { AdminClient } from "@/lib/api/common";

// AI相談で「危機」または「判定失敗」になったユーザーを、サーバー側で覚えておく。
// UIの無効化だけに頼らず、要約の保存・候補の表示もAPI側で拒否するため（安全設計 3）。
// チェックインでは解除しない（解除できると、危機のあとにやり直して迂回できてしまうため）。

const CRISIS_BLOCK_MS = 24 * 60 * 60 * 1000;
// 判定の失敗（通信の一時的な不調など）は、短い時間だけ止める。危機（crisis）とは分けて扱う
const UNKNOWN_BLOCK_MS = 5 * 60 * 1000;

export async function setRiskBlock(admin: AdminClient, userId: string, level: "crisis" | "unknown") {
  const until = new Date(Date.now() + (level === "crisis" ? CRISIS_BLOCK_MS : UNKNOWN_BLOCK_MS)).toISOString();
  const { data: current } = await admin.from("session_risk").select("level,blocked_until").eq("user_id", userId).maybeSingle();
  // crisis の止め期間を、短い unknown で上書きしない
  if (current?.level === "crisis" && new Date(current.blocked_until).getTime() > Date.now() && level === "unknown") return;
  await admin.from("session_risk").upsert({ user_id: userId, level, blocked_until: until, updated_at: new Date().toISOString() });
}

/**
 * 一時的な通信不調等による unknown ブロックのみを解除する（新しい相談で L1・L2 ともに安全と確認できたとき用）。
 * ※ crisis によるブロック（24時間）は絶対に解除しない。
 */
export async function clearUnknownRiskBlock(admin: AdminClient, userId: string) {
  await admin.from("session_risk").delete().eq("user_id", userId).eq("level", "unknown");
}

/** 今、マッチングに進めない状態か。確認に失敗したときも「止める」側に倒す（fail-closed） */
export async function isRiskBlocked(admin: AdminClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.from("session_risk").select("blocked_until").eq("user_id", userId).maybeSingle();
  if (error) return true;
  return !!data && new Date(data.blocked_until).getTime() > Date.now();
}
