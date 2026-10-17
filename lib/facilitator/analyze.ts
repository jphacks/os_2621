import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/llm/claude";
import { loadPrompt } from "@/lib/llm/prompts";
import { getFacilitatorConfig } from "@/lib/facilitator/config";
import { decideIntervention, shouldAnalyzeFlow, type FlowAnalysisResult } from "@/lib/facilitator/decide";
import { detectCrisisL1 } from "@/lib/safety/detectCrisis";
import {
  composeFacilitatorText,
  endRoom,
  insertMessage,
  msSinceLastAi,
  type Admin,
  type RoomRow,
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

const DEMO_FAST = process.env.NEXT_PUBLIC_DEMO_FAST_TIMER === "true";

/**
 * メッセージ配信後に非同期で行う処理（L2の危機判定 → 流れの分析 → 介入の判定 → 司会の発言）。
 * 判定のルールは lib/facilitator/decide.ts（Bさん）に任せる。
 * 失敗してもルームの進行は止めない（ログにはIDだけ出す。本文は出さない）。
 */
export async function afterMessage(
  admin: Admin,
  roomId: string,
  messageId: string,
  userId: string,
  opts: { piiMasked: boolean }
) {
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

    // L2: 危機判定。crisis なら、配信済みの発言を取り消し、相手には理由を伏せてルームを終える
    if (latest) {
      const risk = await generateJson({
        systemPrompt: await loadPrompt("risk"),
        messages: [{ role: "user", content: `${transcript}\n\n最新の発言: ${latest.body}` }],
        modelTier: "fast",
        timeoutMs: 5000,
        schema: riskSchema,
      }).catch(() => null);

      if (risk?.level === "crisis") {
        await admin.from("room_messages").delete().eq("id", messageId);
        await endRoom(admin, roomId, "safety", "ルームが終了しました");
        console.warn("[room] L2 crisis", { roomId, userId });
        return;
      }
    }

    const cfg = getFacilitatorConfig(DEMO_FAST);

    // 流れの分析は N 件ごと（個人情報のマスクがあったときは、すぐ判定に回す）
    const { count } = await admin
      .from("room_messages")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("sender_type", "user");
    let flow: FlowAnalysisResult | undefined;
    if (shouldAnalyzeFlow(count ?? 0, cfg.ANALYZE_EVERY_N)) {
      flow =
        (await generateJson({
          systemPrompt: await loadPrompt("flow_analysis"),
          messages: [{ role: "user", content: transcript }],
          modelTier: "fast",
          timeoutMs: 5000,
          schema: flowSchema,
        }).catch(() => null)) ?? undefined;
    }
    if (!flow && !opts.piiMasked) return;

    const { data: roomData } = await admin.from("rooms").select("*").eq("id", roomId).single();
    const room = roomData as RoomRow | null;
    if (!room || room.status !== "active") return;

    const sinceAi = await msSinceLastAi(admin, roomId);
    const action = decideIntervention({
      elapsedMs: Date.now() - new Date(room.started_at).getTime(),
      timeWarningAlreadySent: true, // 25分の予告は /facilitate が担当する
      msSinceLastIntervention: Number.isFinite(sinceAi) ? sinceAi : null,
      flowAnalysis: flow,
      piiMasked: opts.piiMasked,
      previousHostilityCount: room.hostility_count ?? 0,
      config: cfg,
    });

    if (flow) {
      // 列が無いDBでは失敗するが、ルームの進行には影響させない
      await admin.from("rooms").update({ hostility_count: action.nextHostilityCount }).eq("id", roomId);
    }
    if (!action.shouldIntervene || !action.trigger) return;

    const text = await composeFacilitatorText(admin, roomId, action.trigger);
    // 司会の発言も、危機を表す語を含んでいないか念のため確認する
    if (text && detectCrisisL1(text).level !== "crisis") {
      await insertMessage(admin, roomId, { sender_id: null, sender_type: "ai", body: text });
    }
    if (action.closeRoom) {
      await endRoom(admin, roomId, action.endReason ?? "safety", null);
    }
  } catch {
    console.warn("[room] afterMessage failed", { roomId });
  }
}
