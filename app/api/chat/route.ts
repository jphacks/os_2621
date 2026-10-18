import { z } from "zod";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";
import { clearUnknownRiskBlock, isRiskBlocked, setRiskBlock } from "@/lib/api/risk";
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
  age_group: z.string().optional(),
  isCrisisCare: z.boolean().optional(),
});

const AGE_GROUP_LABEL_MAP: Record<string, string> = {
  junior_high: "中学生",
  high_school: "高校生",
  university: "大学生",
  graduate: "大学院生",
  中学生: "中学生",
  高校生: "高校生",
  大学生: "大学生",
  大学院生: "大学院生",
};

function resolveAgeGroupLabel(raw?: string | null): string {
  if (!raw) return "大学生";
  return AGE_GROUP_LABEL_MAP[raw] || "大学生";
}

const riskSchema = z.object({
  level: z.enum(["none", "caution", "crisis"]),
  categories: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

const line = (ev: ChatEvent) => `${JSON.stringify(ev)}\n`;

const FALLBACK_CRISIS_CARE_MESSAGE =
  "ここまで話してくれて、本当にありがとうございます。いま一人で抱えきれないほど、つらく苦しいお気持ちなのですね。あなたは決して一人ではありません。画面のすぐ下にある相談窓口で、専門の相談員さんと一緒にあなたのペースでお話ししてみませんか。もちろん、このままここで私にお話ししてくれても大丈夫ですよ。";

// AI相談（ストリーミング）。危機時は温かく受容する対話的誘導を行い、通常時は並列L2判定を行う。
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
    return jsonError(400, "メッセージを確認して、もう一度送ってください。");
  }
  const { messages, checkin, isCrisisCare } = parsed.data;
  const latest = messages[messages.length - 1].content;

  let admin;
  try {
    admin = getAdmin();
  } catch {
    return jsonError(500);
  }

  // ユーザープロファイルから年代を取得（未設定時はリクエストボディまたはフォールバック）
  let profileAgeGroup: string | undefined;
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("age_group")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.age_group) {
      profileAgeGroup = profile.age_group;
    }
  } catch {
    // DB未接続時や取得失敗時はリクエストボディを参照
  }
  const effectiveAgeGroup =
    profileAgeGroup === "university" && parsed.data.age_group === "graduate"
      ? "graduate"
      : (profileAgeGroup ?? parsed.data.age_group);
  const ageGroupLabel = resolveAgeGroupLabel(effectiveAgeGroup);

  // L1判定
  const l1 = detectCrisisL1(latest);
  const isCrisisMode = l1.level === "crisis" || isCrisisCare === true;

  const encoder = new TextEncoder();

  // 危機検知時（L1または継続危機対話）: 安全設計としてマッチングは即座に停止するが、
  // 機械的に会話を打ち切らず、温かい寄り添い応答（crisis_care）をストリーミングで届ける
  if (isCrisisMode) {
    await setRiskBlock(admin, userId, "crisis").catch(() => {});
    console.warn("[chat] Crisis care mode activated", {
      userId,
      l1: l1.level,
      isCrisisCare,
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (ev: ChatEvent) => controller.enqueue(encoder.encode(line(ev)));
        let streamedChars = 0;

        try {
          const system = await loadPrompt("crisis_care", {
            mood: checkin?.mood ?? 1,
            energy: checkin?.energy ?? 1,
            age_group: ageGroupLabel,
          });

          for await (const text of streamText({
            systemPrompt: system,
            messages,
            modelTier: "main",
            maxTokens: 500,
            timeoutMs: 30000,
          })) {
            streamedChars += text.length;
            send({ type: "delta", text });
          }
        } catch (e) {
          console.warn("[chat] crisis_care llm stream failed, using warm fallback", {
            userId,
            error: e instanceof Error ? e.message : "unknown",
          });
          if (streamedChars === 0) {
            send({ type: "delta", text: FALLBACK_CRISIS_CARE_MESSAGE });
          }
        }

        send({ type: "crisis" });
        send({ type: "done", matchingBlocked: true });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  // 通常フロー: L2 は応答の生成と並列で走らせる。失敗・タイムアウト（5秒）は unknown（fail-closed）
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
      console.warn("[chat] L2 failed", { userId, error: e instanceof Error ? e.message : "unknown" });
      return { level: "unknown" };
    }
  })();

  const abort = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: ChatEvent) => controller.enqueue(encoder.encode(line(ev)));

      try {
        const system = await loadPrompt("consult", {
          mood: checkin?.mood ?? 3,
          energy: checkin?.energy ?? 3,
          age_group: ageGroupLabel,
        });
        for await (const text of streamText({
          systemPrompt: system,
          messages,
          modelTier: "main",
          maxTokens: 700,
          timeoutMs: 30000,
          signal: abort.signal,
        })) {
          send({ type: "delta", text });
        }
      } catch (e) {
        console.warn("[chat] reply failed", { userId, error: e instanceof Error ? e.message : "unknown" });
        await setRiskBlock(admin, userId, "unknown").catch(() => {});
        send({ type: "done", matchingBlocked: true });
        controller.close();
        return;
      }

      // 応答ストリームが完了した後に、L2の判定結果を評価
      // （途中でAIの言葉をぶつ切りにせず、最後まで届けてから危機イベントやブロックを送出する）
      const l2 = await l2Promise;
      const merged = mergeRiskResults(l1, l2);
      if (merged.finalLevel === "crisis") {
        await setRiskBlock(admin, userId, "crisis").catch(() => {});
        console.warn("[chat] L2 crisis detected", { userId });
        send({ type: "crisis" });
        send({ type: "done", matchingBlocked: true });
      } else {
        if (l2.level === "unknown") {
          await setRiskBlock(admin, userId, "unknown").catch(() => {});
        } else if (!messages.some((m) => m.role === "user" && detectCrisisL1(m.content).level === "crisis")) {
          // 今回の会話が L1・L2 ともに安全と確認できた場合は、過去の一時的な通信不調（unknown）のみ解除する（crisis は維持）
          await clearUnknownRiskBlock(admin, userId).catch(() => {});
        }
        const stillBlocked = await isRiskBlocked(admin, userId);
        const blocked = merged.blocked || stillBlocked;
        if (blocked) {
          console.warn("[chat] matching blocked", { userId, previousRecord: stillBlocked, l2: l2.level });
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
