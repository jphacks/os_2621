import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

export type ModelTier = "main" | "fast";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamTextOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  modelTier?: ModelTier;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface GenerateJsonOptions<T = unknown> {
  systemPrompt: string;
  messages: ChatMessage[];
  modelTier?: ModelTier;
  maxTokens?: number;
  timeoutMs?: number;
  schema?: z.ZodType<T>;
  signal?: AbortSignal;
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  return new Anthropic({ apiKey });
}

export function getModelId(tier: ModelTier): string {
  const modelId =
    tier === "main"
      ? process.env.ANTHROPIC_MODEL_MAIN
      : process.env.ANTHROPIC_MODEL_FAST;

  if (!modelId) {
    throw new Error(
      `Environment variable ${
        tier === "main" ? "ANTHROPIC_MODEL_MAIN" : "ANTHROPIC_MODEL_FAST"
      } is not configured.`
    );
  }
  return modelId;
}

function createTimeoutController(
  timeoutMs: number,
  externalSignal?: AbortSignal
): { controller: AbortController; clear: () => void } {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort(new Error(`Claude API timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  return {
    controller,
    clear: () => {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }
    },
  };
}

/**
 * ストリーミングでテキストを生成する関数
 */
export async function* streamText(
  options: StreamTextOptions
): AsyncGenerator<string, void, unknown> {
  const {
    systemPrompt,
    messages,
    modelTier = "main",
    maxTokens = 1024,
    timeoutMs = 30000,
    signal,
  } = options;

  const client = getAnthropicClient();
  const model = getModelId(modelTier);
  const { controller, clear } = createTimeoutController(timeoutMs, signal);

  try {
    const stream = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        stream: true,
      },
      {
        signal: controller.signal,
        timeout: timeoutMs,
      }
    );

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  } finally {
    clear();
  }
}

/**
 * 文字列からJSON部分を抽出してパースするヘルパー（テスト可能）
 */
export function parseJsonResponse<T = unknown>(
  rawText: string,
  schema?: z.ZodType<T>
): T {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonCandidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    throw new Error("Failed to parse JSON response from Claude API.");
  }

  if (schema) {
    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      throw new Error("JSON response from Claude API did not match schema.");
    }
    return validated.data;
  }

  return parsed as T;
}

/**
 * JSONを生成してパースする関数（タイムアウト指定可、JSON解析失敗時は例外を投げる）
 */
export async function generateJson<T = unknown>(
  options: GenerateJsonOptions<T>
): Promise<T> {
  const {
    systemPrompt,
    messages,
    modelTier = "fast",
    maxTokens = 512,
    timeoutMs = 5000,
    schema,
    signal,
  } = options;

  const client = getAnthropicClient();
  const model = getModelId(modelTier);
  const { controller, clear } = createTimeoutController(timeoutMs, signal);

  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        stream: false,
      },
      {
        signal: controller.signal,
        timeout: timeoutMs,
      }
    );

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude API returned no text content for JSON generation.");
    }

    return parseJsonResponse(textBlock.text, schema);
  } finally {
    clear();
  }
}
