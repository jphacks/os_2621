import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/llm/claude";
import { loadPrompt } from "@/lib/llm/prompts";
import { detectCrisisL1 } from "@/lib/safety/detectCrisis";
import { FACILITATOR_CONFIG } from "@/lib/facilitator/config";
import {
  composeFacilitatorText,
  endRoom,
  insertMessage,
  msSinceLastAi,
  type Admin,
  type FacilitatorTrigger,
} from "@/lib/rooms/service";

const riskSchema = z.object({
  level: z.enum(["none", "caution", "crisis"]),
  categories: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

const flowSchema = z.object({
  negative_streak: z.boolean(),
  rumination: z.boolean(),
  hostility: z.boolean(),
  pii_attempt: z.boolean(),
});

/**
 * メッセージ配信後に非同期で行う処理（L2の危機判定 → 流れの分析 → 必要なら司会が発言）。
 * 失敗しても、ルームの進行は止めない（ログにはIDだけ出す。本文は出さない）。
 */
export async function afterMessage(admin: Admin, roomId: string, messageId: string, userId: string) {
  try {
    const { data: recent } = await admin
      .from("room_messages")
      .select("id,sender_type,body")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(8);
    const ordered = (recent ?? []).slice().reverse().filter((m) => m.sender_type !== "system");
    const transcript = ordered
      .map((m) => `${m.sender_type === "ai" ? "司会" : "ユーザー"}: ${m.body}`)
      .join("\n");
    const latest = ordered.find((m) => m.id === messageId);

    // L2: 危機判定
    if (latest) {
      const risk = await generateJson({
        systemPrompt: await loadPrompt("risk"),
        messages: [{ role: "user", content: `${transcript}\n\n最新の発言: ${latest.body}` }],
        modelTier: "fast",
        timeoutMs: 5000,
        schema: riskSchema,
      }).catch(() => null);

      if (risk?.level === "crisis") {
        // 配信済みの発言を取り消し、相手には理由を伏せてルームを終える
        await admin.from("room_messages").delete().eq("id", messageId);
        await endRoom(admin, roomId, "safety", "ルームが終了しました");
        console.warn("[room] L2 crisis", { roomId, userId });
        return;
      }
    }

    // 流れの分析（3件ごと）と、司会の介入（最短間隔あり）
    const { count } = await admin
      .from("room_messages")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("sender_type", "user");
    if (!count || count % FACILITATOR_CONFIG.analyzeEveryMessages !== 0) return;
    if ((await msSinceLastAi(admin, roomId)) < FACILITATOR_CONFIG.minInterventionIntervalMs) return;

    const flow = await generateJson({
      systemPrompt: await loadPrompt("flow_analysis"),
      messages: [{ role: "user", content: transcript }],
      modelTier: "fast",
      timeoutMs: 5000,
      schema: flowSchema,
    }).catch(() => null);
    if (!flow) return;

    const trigger: FacilitatorTrigger | null = flow.hostility
      ? "hostility"
      : flow.pii_attempt
        ? "pii_attempt"
        : flow.rumination
          ? "rumination"
          : flow.negative_streak
            ? "negative_streak"
            : null;
    if (!trigger) return;

    const text = await composeFacilitatorText(admin, roomId, trigger);
    // 司会の発言も、危機を表す語を含んでいないか念のため確認する
    if (text && detectCrisisL1(text).level !== "crisis") {
      await insertMessage(admin, roomId, { sender_id: null, sender_type: "ai", body: text });
    }
  } catch {
    console.warn("[room] afterMessage failed", { roomId });
  }
}
