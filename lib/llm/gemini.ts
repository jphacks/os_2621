import type { ModelTier } from "@/lib/llm/claude";

// Google Gemini（無料枠あり）用のアダプタ。LLM_PROVIDER=gemini のときに claude.ts から呼ばれる。
// SDKは使わず、REST を fetch で呼ぶ（依存を増やさない）。
// 注意: 無料枠に送った内容は、Google が製品の改善に使うことがある。デモではダミーの文だけを使うこと。

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type Msg = { role: "user" | "assistant"; content: string };

export function getGeminiModel(tier: ModelTier): string {
  const fromEnv = tier === "main" ? process.env.GEMINI_MODEL_MAIN : process.env.GEMINI_MODEL_FAST;
  return fromEnv || (tier === "main" ? "gemini-2.5-flash" : "gemini-2.5-flash-lite");
}

function requestBody(systemPrompt: string, messages: Msg[], maxTokens: number, model: string, json: boolean) {
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(json ? { responseMimeType: "application/json" } : {}),
      // 2.5 の flash 系は「考える」トークンが出力枠を使うので、短い応答では切る
      ...(model.includes("pro") ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
    },
  };
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  return key;
}

function textOf(data: unknown): string {
  const parts = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts;
  return (parts ?? []).map((p) => p.text ?? "").join("");
}

export async function geminiGenerate(opts: {
  systemPrompt: string;
  messages: Msg[];
  tier: ModelTier;
  maxTokens: number;
  signal: AbortSignal;
  json?: boolean;
}): Promise<string> {
  const model = getGeminiModel(opts.tier);
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify(requestBody(opts.systemPrompt, opts.messages, opts.maxTokens, model, !!opts.json)),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const text = textOf(await res.json());
  // 安全フィルターなどで空のとき。呼び出し側は失敗として扱う（fail-closed）
  if (!text) throw new Error("Gemini API returned no text.");
  return text;
}

export async function* geminiStream(opts: {
  systemPrompt: string;
  messages: Msg[];
  tier: ModelTier;
  maxTokens: number;
  signal: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  const model = getGeminiModel(opts.tier);
  const res = await fetch(`${BASE}/${model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
    body: JSON.stringify(requestBody(opts.systemPrompt, opts.messages, opts.maxTokens, model, false)),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`Gemini API error ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let any = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const text = textOf(JSON.parse(line.slice(5).trim()));
        if (text) {
          any = true;
          yield text;
        }
      } catch {
        // 壊れた行は無視
      }
    }
  }
  if (!any) throw new Error("Gemini API returned no text.");
}
