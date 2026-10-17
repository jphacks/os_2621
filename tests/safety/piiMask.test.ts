import { describe, expect, it } from "vitest";
import { maskPii } from "@/lib/safety/piiMask";

describe("maskPii", () => {
  it.each([
    ["電話は090-1234-5678です", "090-1234-5678"],
    ["09012345678 にかけて", "09012345678"],
    ["メールは test.user@example.com です", "test.user@example.com"],
    ["https://example.com/abc を見て", "https://example.com/abc"],
    ["LINEのID: hidamari_01 です", "hidamari_01"],
    ["インスタは hina.0101 だよ", "hina.0101"],
    ["Xのidは tarou_x です", "tarou_x"],
    ["フォローして @hinata_01", "@hinata_01"],
  ])("マスクする: %s", (input, secret) => {
    const r = maskPii(input);
    expect(r.masked).toBe(true);
    expect(r.text).not.toContain(secret);
    expect(r.text).toContain("***");
  });

  it.each(["最近、サークルで居場所がなくて", "今日は3時間くらいしか寝ていません", "Xday は来週です", "LINEは苦手です"])(
    "普通の文は変えない: %s",
    (input) => {
      expect(maskPii(input)).toEqual({ text: input, masked: false });
    }
  );
});
