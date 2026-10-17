import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPrompt } from "@/lib/llm/prompts";
import { streamText } from "@/lib/llm/claude";
import type { EndReason } from "@/types/room";

export type Admin = SupabaseClient;

export type RoomRow = {
  id: string;
  status: "active" | "ended";
  end_reason: EndReason | null;
  started_at: string;
  ends_at: string;
};

export const FRIENDLY_ERROR = "うまく処理できませんでした。少し時間をおいて、もう一度ためしてください。";

export function jsonError(status: number, message = FRIENDLY_ERROR) {
  return NextResponse.json({ error: message }, { status });
}

/** ログイン中のユーザーID（Cookieのセッションから）。未ログインなら null */
export async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export function getAdmin(): Admin {
  return createAdminClient();
}

/** ルームを取得し、本人がメンバーか確認する。メンバーでなければ null */
export async function loadRoomAsMember(admin: Admin, roomId: string, userId: string) {
  const { data: member } = await admin
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;
  const { data: room } = await admin
    .from("rooms")
    .select("id,status,end_reason,started_at,ends_at")
    .eq("id", roomId)
    .single();
  return (room as RoomRow | null) ?? null;
}

export async function insertMessage(
  admin: Admin,
  roomId: string,
  m: { sender_id: string | null; sender_type: "user" | "ai" | "system"; body: string; masked?: boolean }
) {
  const { data, error } = await admin
    .from("room_messages")
    .insert({ room_id: roomId, masked: false, ...m })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * ルームを終了する。active のときだけ更新するので、同時に呼ばれても1回しか終わらない。
 * 実際に終了させたら true。
 */
export async function endRoom(admin: Admin, roomId: string, reason: EndReason, systemText: string | null) {
  const { data } = await admin
    .from("rooms")
    .update({ status: "ended", end_reason: reason })
    .eq("id", roomId)
    .eq("status", "active")
    .select("id");
  const ended = (data?.length ?? 0) > 0;
  if (ended && systemText) {
    await insertMessage(admin, roomId, { sender_id: null, sender_type: "system", body: systemText });
  }
  return ended;
}

export async function markLeft(admin: Admin, roomId: string, userId: string) {
  await admin
    .from("room_members")
    .update({ left_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", userId);
}

export type FacilitatorTrigger =
  | "opening"
  | "negative_streak"
  | "rumination"
  | "hostility"
  | "pii_attempt"
  | "silence"
  | "time_warning"
  | "closing";

const FALLBACK_TEXT: Partial<Record<FacilitatorTrigger, string>> = {
  time_warning: "あと5分です。今日話してよかったことを、よければひとことずつ教えてください。",
  closing:
    "お話ししてくれてありがとうございました。ここでルームを終えます。つらいときは、いつでも相談窓口も頼ってくださいね。",
};

/** ファシリテーターの発言を作る。NO_INTERVENTION や失敗のときは null（定型の2つだけ固定文で代替） */
export async function composeFacilitatorText(
  admin: Admin,
  roomId: string,
  trigger: FacilitatorTrigger
): Promise<string | null> {
  try {
    const [{ data: members }, { data: recent }] = await Promise.all([
      admin.from("room_members").select("summary_id").eq("room_id", roomId),
      admin
        .from("room_messages")
        .select("sender_type,body")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    const summaryIds = (members ?? []).map((m) => m.summary_id).filter(Boolean);
    // 2人が共有に同意した要約（share_text）だけを使う
    const { data: summaries } = summaryIds.length
      ? await admin.from("summaries").select("share_text").in("id", summaryIds)
      : { data: [] as { share_text: string }[] };

    const system = await loadPrompt("facilitator", {
      summaries: (summaries ?? []).map((s, i) => `${i + 1}. ${s.share_text}`).join("\n"),
      recent_messages: (recent ?? [])
        .slice()
        .reverse()
        .filter((m) => m.sender_type !== "system")
        .map((m) => `${m.sender_type === "ai" ? "司会" : "ユーザー"}: ${m.body}`)
        .join("\n"),
      trigger,
    });

    let text = "";
    for await (const chunk of streamText({
      systemPrompt: system,
      messages: [{ role: "user", content: "介入の理由に合わせて、司会の発言を作ってください。" }],
      modelTier: "main",
      maxTokens: 250,
      timeoutMs: 10_000,
    })) {
      text += chunk;
    }
    text = text.trim();
    if (!text || text.includes("NO_INTERVENTION")) return FALLBACK_TEXT[trigger] ?? null;
    return text;
  } catch {
    return FALLBACK_TEXT[trigger] ?? null;
  }
}

/** 直近のAI（司会）の発言からの経過時間（ミリ秒）。発言がなければ Infinity */
export async function msSinceLastAi(admin: Admin, roomId: string): Promise<number> {
  const { data } = await admin
    .from("room_messages")
    .select("created_at")
    .eq("room_id", roomId)
    .eq("sender_type", "ai")
    .order("created_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.created_at;
  return last ? Date.now() - new Date(last).getTime() : Number.POSITIVE_INFINITY;
}
