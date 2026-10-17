import { describe, expect, it } from "vitest";
import {
  detectCrisisL1,
  mergeRiskResults,
  type L2RiskResult,
  type RiskResult,
} from "@/lib/safety/detectCrisis";

describe("lib/safety/detectCrisis - detectCrisisL1", () => {
  describe("危機表現（直接・遠回し・ひらがな・カタカナ・全角半角・絵文字混じり）20件以上の検出テスト", () => {
    const crisisSamples: Array<{
      id: number;
      text: string;
      expectedCategory: "suicide" | "self_harm" | "abuse" | "violence";
    }> = [
      // 1〜8: 直接的・ひらがな・カタカナ・全角半角・絵文字混じりの希死念慮
      { id: 1, text: "もうつらい、死にたいです", expectedCategory: "suicide" },
      { id: 2, text: "しにたいってずっと考えてしまう", expectedCategory: "suicide" },
      { id: 3, text: "シニタイ…もう無理かも", expectedCategory: "suicide" },
      { id: 4, text: "ｼﾆﾀｲ、誰にも言えない", expectedCategory: "suicide" },
      { id: 5, text: "死😭に😭た😭い😭", expectedCategory: "suicide" },
      { id: 6, text: "し　に　た　い", expectedCategory: "suicide" },
      { id: 7, text: "生きていたくない、全部投げ出したい", expectedCategory: "suicide" },
      { id: 8, text: "死んだほうがマシなんじゃないかって思う", expectedCategory: "suicide" },

      // 9〜15: 遠回しな希死念慮・消滅願望
      { id: 9, text: "このまま消えてなくなりたい😔", expectedCategory: "suicide" },
      { id: 10, text: "もう終わりにしたい、疲れちゃった", expectedCategory: "suicide" },
      { id: 11, text: "ぜんぶおわりにしたいな…", expectedCategory: "suicide" },
      { id: 12, text: "自分がいなくなればみんな丸く収まるのに", expectedCategory: "suicide" },
      { id: 13, text: "いなくなったほうが楽だよね", expectedCategory: "suicide" },
      { id: 14, text: "永遠に眠りたい、二度と目覚めたくない", expectedCategory: "suicide" },
      { id: 15, text: "生まれてこなければよかったと毎日思う", expectedCategory: "suicide" },

      // 16〜19: 自傷行為・過量服薬（全角英数・カタカナ含む）
      { id: 16, text: "むしゃくしゃしてリスカしてしまった", expectedCategory: "self_harm" },
      { id: 17, text: "りすとかっとがやめられない", expectedCategory: "self_harm" },
      { id: 18, text: "市販薬でＯＤしたい気分", expectedCategory: "self_harm" },
      { id: 19, text: "薬を大量に飲んでしまいたい", expectedCategory: "self_harm" },

      // 20〜22: 虐待・DV被害
      { id: 20, text: "家に帰ると親に殴られるから帰りたくない", expectedCategory: "abuse" },
      { id: 21, text: "おやからぼうりょくをうけています", expectedCategory: "abuse" },
      { id: 22, text: "彼氏からＤＶを受けていて怖い", expectedCategory: "abuse" },

      // 23〜24: 他害・暴力衝動
      { id: 23, text: "あいつを殺してやりたいくらい憎い", expectedCategory: "violence" },
      { id: 24, text: "誰でもいいからころしたい", expectedCategory: "violence" },
    ];

    it("サンプルが20件以上定義されていること", () => {
      expect(crisisSamples.length).toBeGreaterThanOrEqual(20);
    });

    it.each(crisisSamples)(
      "危機表現 #$id ($expectedCategory): 「$text」がすべて crisis と判定されること",
      ({ text, expectedCategory }) => {
        const result = detectCrisisL1(text);
        expect(result.level).toBe("crisis");
        expect(result.categories).toContain(expectedCategory);
        expect(result.matchedKeywords?.length).toBeGreaterThan(0);
      }
    );
  });

  describe("通常の悩み（友人関係、進路、勉強、サークル等）10件以上の非誤検知テスト", () => {
    const normalConsultationSamples: Array<{ id: number; text: string }> = [
      { id: 1, text: "新しいサークルに入ったけど、周りの輪に入れなくて孤立しています。" },
      { id: 2, text: "大学の授業についていけず、単位を落とさないか不安でたまらないです。" },
      { id: 3, text: "就活の面接でうまく話せなくて、自分の将来がどうなるのか心配です。" },
      { id: 4, text: "仲良かった友達とちょっとしたことで気まずくなってしまい、どう話しかければいいかわかりません。" },
      { id: 5, text: "一人暮らしを始めてから、家に帰っても誰もいなくて寂しいと感じることが増えました。" },
      { id: 6, text: "親と進路のことで意見が合わず、話し合うたびに言い合いになって疲れます。" },
      { id: 7, text: "バイト先でミスをしてしまい、明日のシフトに行くのが憂鬱です。" },
      { id: 8, text: "周りの友達がみんな充実して見えて、SNSを見るたびに焦ってしまいます。" },
      { id: 9, text: "テスト期間中でレポートの締め切りが重なっていて、必死に勉強しています。" },
      { id: 10, text: "ゼミの発表準備がなかなか進まず、グループメンバーに申し訳ない気持ちです。" },
      { id: 11, text: "最近生活リズムが崩れていて、朝起きるのがつらくて授業に遅刻しがちです。" },
      { id: 12, text: "自分のやりたいことが見つからなくて、周りと比べて落ち込むことがあります。" },
    ];

    it("通常の悩みサンプルが10件以上定義されていること", () => {
      expect(normalConsultationSamples.length).toBeGreaterThanOrEqual(10);
    });

    it.each(normalConsultationSamples)(
      "通常の悩み #$id: 「$text」が crisis と誤検知されず none になること",
      ({ text }) => {
        const result = detectCrisisL1(text);
        expect(result.level).not.toBe("crisis");
        expect(result.level).toBe("none");
        expect(result.categories).toEqual([]);
      }
    );

    it("強い落ち込み表現は crisis ではなく caution と判定されること", () => {
      const result = detectCrisisL1("何日も眠れていないし、涙が止まらないです。");
      expect(result.level).toBe("caution");
      expect(result.categories).toContain("other");
    });

    it("空文字や空白のみの入力は none になること", () => {
      expect(detectCrisisL1("")).toEqual({
        level: "none",
        categories: [],
        matchedKeywords: [],
      });
      expect(detectCrisisL1("   \n\t  ")).toEqual({
        level: "none",
        categories: [],
        matchedKeywords: [],
      });
    });
  });
});

describe("lib/safety/detectCrisis - mergeRiskResults (二重判定とfail-closed)", () => {
  const noneL1: RiskResult = { level: "none", categories: [] };
  const cautionL1: RiskResult = { level: "caution", categories: ["other"] };
  const crisisL1: RiskResult = { level: "crisis", categories: ["suicide"] };

  it("L1がcrisisなら、L2がnoneやunknownであっても finalLevel: 'crisis', blocked: true になる", () => {
    const l2None: L2RiskResult = {
      level: "none",
      categories: [],
      reason: "問題なし",
    };
    const l2Unknown: L2RiskResult = {
      level: "unknown",
      reason: "timeout",
    };

    expect(mergeRiskResults(crisisL1, l2None)).toEqual({
      finalLevel: "crisis",
      blocked: true,
    });
    expect(mergeRiskResults(crisisL1, l2Unknown)).toEqual({
      finalLevel: "crisis",
      blocked: true,
    });
  });

  it("L1がnoneでも、L2がcrisisなら finalLevel: 'crisis', blocked: true になる", () => {
    const l2Crisis: L2RiskResult = {
      level: "crisis",
      categories: ["suicide"],
      reason: "遠回しな希死念慮",
    };

    expect(mergeRiskResults(noneL1, l2Crisis)).toEqual({
      finalLevel: "crisis",
      blocked: true,
    });
  });

  it("【fail-closed】L2が unknown（タイムアウト・APIエラー等）の場合、L1がnone/cautionでも blocked: true になる", () => {
    const l2Unknown: L2RiskResult = {
      level: "unknown",
      reason: "API timeout after 5000ms",
    };

    expect(mergeRiskResults(noneL1, l2Unknown)).toEqual({
      finalLevel: "none",
      blocked: true,
    });
    expect(mergeRiskResults(cautionL1, l2Unknown)).toEqual({
      finalLevel: "caution",
      blocked: true,
    });
  });

  it("L1・L2ともにnoneの場合は finalLevel: 'none', blocked: false になる", () => {
    const l2None: L2RiskResult = {
      level: "none",
      categories: [],
      reason: "通常の進路相談",
    };

    expect(mergeRiskResults(noneL1, l2None)).toEqual({
      finalLevel: "none",
      blocked: false,
    });
  });

  it("片方がnone、もう片方がcautionの場合は finalLevel: 'caution', blocked: false になる", () => {
    const l2Caution: L2RiskResult = {
      level: "caution",
      categories: ["other"],
      reason: "強い疲労感",
    };
    const l2None: L2RiskResult = {
      level: "none",
      categories: [],
      reason: "問題なし",
    };

    expect(mergeRiskResults(noneL1, l2Caution)).toEqual({
      finalLevel: "caution",
      blocked: false,
    });
    expect(mergeRiskResults(cautionL1, l2None)).toEqual({
      finalLevel: "caution",
      blocked: false,
    });
  });
});
