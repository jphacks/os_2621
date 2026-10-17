import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { z } from "zod";
import { parseJsonResponse } from "@/lib/llm/claude";
import { loadPrompt } from "@/lib/llm/prompts";

describe("lib/llm/claude - parseJsonResponse", () => {
  it("parses valid JSON and validates with zod schema", () => {
    const schema = z.object({
      level: z.enum(["none", "caution", "crisis"]),
      reason: z.string(),
    });
    const result = parseJsonResponse(
      '```json\n{"level":"none","reason":"問題なし"}\n```',
      schema
    );
    expect(result).toEqual({ level: "none", reason: "問題なし" });
  });

  it("throws when JSON is malformed", () => {
    expect(() => parseJsonResponse("not-a-json")).toThrow(
      "Failed to parse JSON response from Claude API."
    );
  });
});

describe("lib/llm/prompts - loadPrompt", () => {
  it("loads markdown prompt file and replaces template variables", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hidamari-prompts-"));
    await fs.writeFile(
      path.join(tmpDir, "_common_safety.md"),
      "## 共通安全ルール",
      "utf-8"
    );
    await fs.writeFile(
      path.join(tmpDir, "consult.md"),
      "気分は {{mood}} です。",
      "utf-8"
    );

    const content = await loadPrompt(
      "consult",
      { mood: 3 },
      { promptsDir: tmpDir }
    );
    expect(content).toContain("## 共通安全ルール");
    expect(content).toContain("気分は 3 です。");
  });
});
