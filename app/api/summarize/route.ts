import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";
import { isRiskBlocked, setRiskBlock } from "@/lib/api/risk";
import { generateJson } from "@/lib/llm/claude";
import { loadPrompt } from "@/lib/llm/prompts";
import { detectCrisisL1 } from "@/lib/safety/detectCrisis";
import { maskPII } from "@/lib/safety/piiMask";
import type { SummaryDraft } from "@/types/api";

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .min(1)
    .max(40),
});

const draftSchema = z.object({
  share_text: z.string().min(1).max(300),
  category: z.enum(["relationships", "career", "study", "family", "loneliness", "health", "other"]),
  tags: z.array(z.string().min(1).max(20)).min(1).max(6),
  energy_estimate: z.number().int().min(1).max(5),
  stage_estimate: z.enum(["struggling", "coping", "recovering"]),
});

// 会話から要約の下書きを作る（まだ保存しない）
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400);
  const { messages } = parsed.data;

  try {
    const admin = getAdmin();

    // 危機・判定失敗のセッションは、要約に進めない（UIの無効化だけに頼らない）
    if (await isRiskBlocked(admin, userId)) return jsonError(403, "今は、人とつながる手順には進めません。");
    if (messages.some((m) => m.role === "user" && detectCrisisL1(m.content).level === "crisis")) {
      await setRiskBlock(admin, userId, "crisis");
      return jsonError(403, "今は、人とつながる手順には進めません。");
    }

    const transcript = messages.map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content}`).join("\n");
    const draft = await generateJson({
      systemPrompt: await loadPrompt("summarize"),
      messages: [{ role: "user", content: transcript }],
      modelTier: "main",
      maxTokens: 600,
      timeoutMs: 20000,
      schema: draftSchema,
    });

    const masked = maskPII(draft.share_text);
    // 要約の文にも危機を表す語が混ざっていないか確認する
    if (detectCrisisL1(masked.text).level === "crisis") return jsonError(403, "今は、人とつながる手順には進めません。");

    return NextResponse.json<SummaryDraft>({
      share_text: masked.text,
      category: draft.category,
      tags: draft.tags.map((t) => maskPII(t).text),
      energy_estimate: draft.energy_estimate,
      stage_estimate: draft.stage_estimate,
    });
  } catch {
    console.warn("[summarize] failed");
    return jsonError(500, "整理がうまくいきませんでした。もう一度ためしてください。");
  }
}
