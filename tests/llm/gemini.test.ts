import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiGenerate, getGeminiCandidates } from "@/lib/llm/gemini";

const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

describe("gemini フォールバック", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const call = () =>
    geminiGenerate({
      systemPrompt: "s",
      messages: [{ role: "user", content: "こんにちは" }],
      tier: "main",
      maxTokens: 100,
      signal: new AbortController().signal,
    });

  it("候補のモデルは重複せず、最初は指定のモデル", () => {
    vi.stubEnv("GEMINI_MODEL_MAIN", "gemini-3.5-flash-lite");
    const list = getGeminiCandidates("main");
    expect(list[0]).toBe("gemini-3.5-flash-lite");
    expect(new Set(list).size).toBe(list.length);
  });

  it("503 のとき、次のモデルで成功すれば返事を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(ok("返事"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(call()).resolves.toBe("返事");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("429 のときも次のモデルを試す", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("quota", { status: 429 })).mockResolvedValueOnce(ok("返事"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(call()).resolves.toBe("返事");
  });

  it("401 のようなキーの問題は、切り替えずにすぐ失敗にする", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad key", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(call()).rejects.toThrow("401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("すべてのモデルが止まっていたら失敗にする（fail-closed）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 503 })));
    await expect(call()).rejects.toThrow("503");
  });

  it("本文が空（安全フィルターなど）なら失敗にする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("")));
    await expect(call()).rejects.toThrow();
  });
});
