import type { ModelTier } from "@/lib/llm/claude";

// Google Gemini（無料枠あり）用のアダプタ。LLM_PROVIDER=gemini のときに claude.ts から呼ばれる。
// SDKは使わず、REST を fetch で呼ぶ（依存を増やさない）。
// 注意: 無料枠に送った内容は、Google が製品の改善に使うことがある。デモではダミーの文だけを使うこと。

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type Msg = { role: "user" | "assistant"; content: string };

export function getGeminiModel(tier: ModelTier): string {
  const fromEnv = tier === "main" ? process.env.GEMINI_MODEL_MAIN : process.env.GEMINI_MODEL_FAST;
  return fromEnv || (tier === "main" ? "gemini-3.8-flash" : "gemini-3.5-flash-lite");
}

// 混雑（503）・回数制限（429）・モデルが見つからない（404）のときに、順に試すモデル。
// モデルごとに無料枠の回数が別なので、止まったときの逃げ道になる。
export function getGeminiCandidates(tier: ModelTier): string[] {
  const all = [getGeminiModel(tier), "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
  return [...new Set(all)];
}

const RETRYABLE = new Set([429, 503, 404]);

function requestBody(systemPrompt: string, messages: Msg[], maxTokens: number, json: boolean) {
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: {
      // 「考える」トークンも出力枠を使うことがあるので、余裕を持たせる（応答の長さはプロンプトで決まる）
      maxOutputTokens: Math.max(maxTokens * 4, 2048),
      ...(json ? { responseMimeType: "application/json" } : {}),
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
  let lastStatus = 0;
  for (const model of getGeminiCandidates(opts.tier)) {
    const res = await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
      body: JSON.stringify(requestBody(opts.systemPrompt, opts.messages, opts.maxTokens, !!opts.json)),
      signal: opts.signal,
    });
    if (!res.ok) {
      lastStatus = res.status;
      if (RETRYABLE.has(res.status)) {
        console.warn("[gemini] fallback", { model, status: res.status });
        continue;
      }
      throw new Error(`Gemini API error ${res.status}`);
    }
    const text = textOf(await res.json());
    // 安全フィルターなどで空のとき。呼び出し側は失敗として扱う（fail-closed）
    if (!text) throw new Error("Gemini API returned no text.");
    return text;
  }
  throw new Error(`Gemini API error ${lastStatus}`);
}

export async function* geminiStream(opts: {
  systemPrompt: string;
  messages: Msg[];
  tier: ModelTier;
  maxTokens: number;
  signal: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  let lastStatus = 0;
  for (const model of getGeminiCandidates(opts.tier)) {
    const res = await fetch(`${BASE}/${model}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
      body: JSON.stringify(requestBody(opts.systemPrompt, opts.messages, opts.maxTokens, false)),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      lastStatus = res.status;
      if (RETRYABLE.has(res.status)) {
        console.warn("[gemini] fallback", { model, status: res.status });
        continue;
      }
      throw new Error(`Gemini API error ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let any = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(String.fromCharCode(10));
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
    return;
  }
  throw new Error(`Gemini API error ${lastStatus}`);
}
