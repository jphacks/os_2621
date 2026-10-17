import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";
import { isRiskBlocked, setRiskBlock } from "@/lib/api/risk";
import { generateJson, streamText } from "@/lib/llm/claude";
import { loadPrompt } from "@/lib/llm/prompts";
import { detectCrisisL1, mergeRiskResults, type L2RiskResult } from "@/lib/safety/detectCrisis";
import type { ChatEvent } from "@/types/api";

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .min(1)
    .max(40), // 直近20往復
  checkin: z.object({ mood: z.number().min(1).max(5), energy: z.number().min(1).max(5) }).nullish(),
});

const riskSchema = z.object({
  level: z.enum(["none", "caution", "crisis"]),
  categories: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

const line = (ev: ChatEvent) => `${JSON.stringify(ev)}\n`;

// AI相談（ストリーミング）。L1（ルール）で止めるか、応答の生成とL2（LLM判定）を並列に走らせる。
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
    return jsonError(400, "メッセージを確認して、もう一度送ってください。");
  }
  const { messages, checkin } = parsed.data;
  const latest = messages[messages.length - 1].content;

  let admin;
  try {
    admin = getAdmin();
  } catch {
    return jsonError(500);
  }

  // L1: 危機なら、LLMを呼ばずに即座に切り替える
  const l1 = detectCrisisL1(latest);
  if (l1.level === "crisis") {
    await setRiskBlock(admin, userId, "crisis").catch(() => {});
    console.warn("[chat] L1 crisis", { userId });
    return NextResponse.json<ChatEvent>({ type: "crisis" });
  }

  const alreadyBlocked = await isRiskBlocked(admin, userId);

  // L2 は応答の生成と並列で走らせる。失敗・タイムアウト（5秒）は unknown（fail-closed）
  const l2Promise: Promise<L2RiskResult> = (async () => {
    try {
      const transcript = messages
        .slice(-6)
        .map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content}`)
        .join("\n");
      const r = await generateJson({
        systemPrompt: await loadPrompt("risk"),
        messages: [{ role: "user", content: `${transcript}\n\n最新のユーザー発言: ${latest}` }],
        modelTier: "fast",
        timeoutMs: 5000,
        schema: riskSchema,
      });
      return { level: r.level, categories: [], reason: r.reason ?? "" } as L2RiskResult;
    } catch (e) {
      // 原因の調査用（エラーの種類だけ。会話の本文は出さない）
      console.warn("[chat] L2 failed", { userId, error: e instanceof Error ? e.message : "unknown" });
      return { level: "unknown" };
    }
  })();

  const abort = new AbortController();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: ChatEvent) => controller.enqueue(encoder.encode(line(ev)));
      let crisis = false;

      // L2 が途中で crisis と分かったら、応答を打ち切って crisis を送る
      void l2Promise.then(async (l2) => {
        if (l2.level === "crisis" && !crisis) {
          crisis = true;
          abort.abort();
          await setRiskBlock(admin, userId, "crisis").catch(() => {});
          console.warn("[chat] L2 crisis", { userId });
          send({ type: "crisis" });
          controller.close();
        }
      });

      try {
        const system = await loadPrompt("consult", {
          mood: checkin?.mood ?? 3,
          energy: checkin?.energy ?? 3,
        });
        for await (const text of streamText({
          systemPrompt: system,
          messages,
          modelTier: "main",
          maxTokens: 700,
          timeoutMs: 30000,
          signal: abort.signal,
        })) {
          if (crisis) return;
          send({ type: "delta", text });
        }
      } catch (e) {
        if (crisis) return;
        console.warn("[chat] reply failed", { userId, error: e instanceof Error ? e.message : "unknown" });
        // 応答の生成に失敗したら、安全側に倒してマッチングを止める
        await setRiskBlock(admin, userId, "unknown").catch(() => {});
        send({ type: "done", matchingBlocked: true });
        controller.close();
        return;
      }

      const l2 = await l2Promise;
      if (crisis) return;
      const merged = mergeRiskResults(l1, l2);
      if (merged.finalLevel === "crisis") {
        crisis = true;
        await setRiskBlock(admin, userId, "crisis").catch(() => {});
        send({ type: "crisis" });
      } else {
        if (l2.level === "unknown") await setRiskBlock(admin, userId, "unknown").catch(() => {});
        const blocked = merged.blocked || alreadyBlocked;
        if (blocked) {
          // 止めた理由（調査用。会話の本文は出さない）
          console.warn("[chat] matching blocked", { userId, previousRecord: alreadyBlocked, l2: l2.level });
        }
        send({ type: "done", matchingBlocked: blocked });
      }
      controller.close();
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
