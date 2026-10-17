import { describe, expect, it } from "vitest";
import {
  AGE_GROUP_LABELS,
  AGE_GROUPS,
  calculateJaccard,
  calculateMatchScore,
  calculateStageBonus,
  combineEnergy,
  isEligibleCandidate,
  isValidAgeGroup,
  rankCandidates,
  type AgeGroup,
  type MatchSummary,
} from "../../lib/matching/score";

const FUTURE_ISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const PAST_ISO = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function createDummySummary(
  overrides: Partial<MatchSummary> = {}
): MatchSummary {
  return {
    id: "summary-default",
    userId: "user-default",
    ageGroup: "university",
    category: "relationships",
    tags: ["友人関係", "孤立感"],
    energy: 3,
    stage: "coping",
    riskLevel: "none",
    shareConsent: true,
    expiresAt: FUTURE_ISO,
    ...overrides,
  };
}

describe("combineEnergy (エネルギー統合)", () => {
  it("自己申告とAI推定の平均を四捨五入する", () => {
    expect(combineEnergy(3, 3)).toBe(3);
    expect(combineEnergy(2, 3)).toBe(3); // 2.5 -> 3
    expect(combineEnergy(1, 2)).toBe(2); // 1.5 -> 2
    expect(combineEnergy(4, 5)).toBe(5); // 4.5 -> 5
    expect(combineEnergy(1, 4)).toBe(3); // 2.5 -> 3
  });

  it("範囲外の入力でも 1〜5 にクランプされる", () => {
    expect(combineEnergy(0, 0)).toBe(1);
    expect(combineEnergy(6, 6)).toBe(5);
  });
});

describe("calculateJaccard (タグのJaccard係数)", () => {
  it("完全一致のときは 1 を返す", () => {
    expect(calculateJaccard(["友人関係", "孤立感"], ["孤立感", "友人関係"])).toBe(
      1
    );
  });

  it("共通タグがないときは 0 を返す", () => {
    expect(calculateJaccard(["友人関係"], ["就活", "進路"])).toBe(0);
  });

  it("和集合と積集合の比率 (0〜1) を正しく計算する", () => {
    // 積集合: ["孤立感"] (1), 和集合: ["友人関係", "孤立感", "新生活", "サークル"] (4) => 0.25
    expect(
      calculateJaccard(
        ["友人関係", "孤立感"],
        ["孤立感", "新生活", "サークル"]
      )
    ).toBeCloseTo(0.25, 5);
  });

  it("両方とも空配列の場合は 0 を返す", () => {
    expect(calculateJaccard([], [])).toBe(0);
  });

  it("重複タグや前後の空白を正規化して計算する", () => {
    expect(
      calculateJaccard([" 友人関係 ", "友人関係"], ["友人関係"])
    ).toBe(1);
  });
});

describe("calculateStageBonus (回復段階ボーナス)", () => {
  it("片方が recovering、もう片方が struggling または coping のとき 1.0 を返す", () => {
    expect(calculateStageBonus("recovering", "struggling")).toBe(1.0);
    expect(calculateStageBonus("struggling", "recovering")).toBe(1.0);
    expect(calculateStageBonus("recovering", "coping")).toBe(1.0);
    expect(calculateStageBonus("coping", "recovering")).toBe(1.0);
  });

  it("同じ stage 同士のとき 0.6 を返す", () => {
    expect(calculateStageBonus("struggling", "struggling")).toBe(0.6);
    expect(calculateStageBonus("coping", "coping")).toBe(0.6);
    expect(calculateStageBonus("recovering", "recovering")).toBe(0.6);
  });

  it("それ以外（struggling と coping）のとき 0.3 を返す", () => {
    expect(calculateStageBonus("struggling", "coping")).toBe(0.3);
    expect(calculateStageBonus("coping", "struggling")).toBe(0.3);
  });
});

describe("calculateMatchScore (マッチングスコア計算)", () => {
  it("SPEC.md §6.2 の式 0.5*category + 0.3*Jaccard + 0.2*stageBonus に従って計算する", () => {
    const me = createDummySummary({
      category: "relationships",
      tags: ["友人関係", "孤立感"],
      stage: "struggling",
    });

    // 同カテゴリ(1) * 0.5 + Jaccard(1.0) * 0.3 + stageBonus(recovering & struggling = 1.0) * 0.2 = 1.0
    const perfectPartner = createDummySummary({
      category: "relationships",
      tags: ["友人関係", "孤立感"],
      stage: "recovering",
    });
    expect(calculateMatchScore(me, perfectPartner)).toBeCloseTo(1.0, 5);

    // 異カテゴリ(0) * 0.5 + Jaccard(0) * 0.3 + stageBonus(struggling & coping = 0.3) * 0.2 = 0.06
    const lowPartner = createDummySummary({
      category: "career",
      tags: ["就活"],
      stage: "coping",
    });
    expect(calculateMatchScore(me, lowPartner)).toBeCloseTo(0.06, 5);
  });
});

describe("isEligibleCandidate (候補フィルタ条件・共倒れ防止)", () => {
  const me = createDummySummary({
    id: "sum-me",
    userId: "user-me",
    energy: 3,
  });

  it("すべての条件を満たす候補は true を返す", () => {
    const candidate = createDummySummary({
      id: "sum-cand-1",
      userId: "user-cand-1",
      energy: 2,
    });
    expect(isEligibleCandidate(me, candidate)).toBe(true);
  });

  it("【共倒れ防止】両者のエネルギーが共に 2 以下の場合は false を返す", () => {
    const lowMe = createDummySummary({
      id: "sum-me-low",
      userId: "user-me",
      energy: 2,
    });
    const lowCandidate1 = createDummySummary({
      id: "sum-cand-low1",
      userId: "user-cand-1",
      energy: 2,
    });
    const lowCandidate2 = createDummySummary({
      id: "sum-cand-low2",
      userId: "user-cand-2",
      energy: 1,
    });
    const okCandidate = createDummySummary({
      id: "sum-cand-ok",
      userId: "user-cand-3",
      energy: 3,
    });

    // 2 と 2 -> 除外
    expect(isEligibleCandidate(lowMe, lowCandidate1)).toBe(false);
    // 2 と 1 -> 除外
    expect(isEligibleCandidate(lowMe, lowCandidate2)).toBe(false);
    // 1 と 1 -> 除外
    expect(
      isEligibleCandidate(
        createDummySummary({ id: "m1", userId: "u1", energy: 1 }),
        lowCandidate2
      )
    ).toBe(false);
    // 2 と 3 -> 片方が3以上なので許可
    expect(isEligibleCandidate(lowMe, okCandidate)).toBe(true);
  });

  it("shareConsent が false または有効期限切れの候補は除外する", () => {
    const noConsent = createDummySummary({
      id: "sum-no-consent",
      userId: "user-2",
      shareConsent: false,
    });
    const expired = createDummySummary({
      id: "sum-expired",
      userId: "user-3",
      expiresAt: PAST_ISO,
    });

    expect(isEligibleCandidate(me, noConsent)).toBe(false);
    expect(isEligibleCandidate(me, expired)).toBe(false);
  });

  it("riskLevel が crisis の候補（または本人）は除外する", () => {
    const crisisCandidate = createDummySummary({
      id: "sum-crisis",
      userId: "user-crisis",
      riskLevel: "crisis",
    });
    const cautionCandidate = createDummySummary({
      id: "sum-caution",
      userId: "user-caution",
      riskLevel: "caution",
    });
    const crisisMe = createDummySummary({
      id: "sum-me-crisis",
      userId: "user-me",
      riskLevel: "crisis",
    });

    expect(isEligibleCandidate(me, crisisCandidate)).toBe(false);
    expect(isEligibleCandidate(me, cautionCandidate)).toBe(true);
    expect(isEligibleCandidate(crisisMe, cautionCandidate)).toBe(false);
  });

  it("自分自身・ブロック済みの相手・進行中の相手は除外する", () => {
    const sameUser = createDummySummary({
      id: "sum-other",
      userId: "user-me",
    });
    const blockedUser = createDummySummary({
      id: "sum-blocked",
      userId: "user-blocked",
    });
    const activeMatchUser = createDummySummary({
      id: "sum-active",
      userId: "user-active",
    });

    expect(isEligibleCandidate(me, sameUser)).toBe(false);
    expect(
      isEligibleCandidate(me, blockedUser, {
        blockedUserIds: ["user-blocked"],
      })
    ).toBe(false);
    expect(
      isEligibleCandidate(me, activeMatchUser, {
        activeMatchUserIds: ["user-active"],
      })
    ).toBe(false);
  });

  it("【同年代マッチング】中学生・高校生・大学生（専門・院生含む）の同じ年代区分同士のみ true を返す", () => {
    const groups: AgeGroup[] = ["junior_high", "high_school", "university"];

    for (const myGroup of groups) {
      for (const candidateGroup of groups) {
        const mySummary = createDummySummary({
          id: `me-${myGroup}`,
          userId: `user-me-${myGroup}`,
          ageGroup: myGroup,
          energy: 3,
        });
        const candidateSummary = createDummySummary({
          id: `cand-${candidateGroup}`,
          userId: `user-cand-${candidateGroup}`,
          ageGroup: candidateGroup,
          energy: 3,
        });

        if (myGroup === candidateGroup) {
          expect(isEligibleCandidate(mySummary, candidateSummary)).toBe(true);
        } else {
          expect(isEligibleCandidate(mySummary, candidateSummary)).toBe(false);
        }
      }
    }
  });

  it("【fail-closed】対象外の年代区分（社会人・小学生など）や片方のみ ageGroup 未設定の場合は false を返す", () => {
    const validHighSchool = createDummySummary({
      id: "sum-hs",
      userId: "user-hs",
      ageGroup: "high_school",
    });
    const missingAgeGroup = createDummySummary({
      id: "sum-missing-age",
      userId: "user-missing",
      ageGroup: undefined,
    });
    const invalidAdult = createDummySummary({
      id: "sum-adult",
      userId: "user-adult",
      ageGroup: "adult" as unknown as AgeGroup,
    });
    const invalidElementary = createDummySummary({
      id: "sum-elementary",
      userId: "user-elementary",
      ageGroup: "elementary" as unknown as AgeGroup,
    });

    expect(isEligibleCandidate(validHighSchool, missingAgeGroup)).toBe(false);
    expect(isEligibleCandidate(missingAgeGroup, validHighSchool)).toBe(false);
    expect(isEligibleCandidate(validHighSchool, invalidAdult)).toBe(false);
    expect(isEligibleCandidate(invalidAdult, invalidAdult)).toBe(false);
    expect(isEligibleCandidate(validHighSchool, invalidElementary)).toBe(false);
  });
});

describe("isValidAgeGroup / AGE_GROUPS (対象年代区分の定義と検証)", () => {
  it("中学生・高校生・大学生（専門・院生含む）の3区分のみ有効と判定する", () => {
    expect(AGE_GROUPS).toEqual(["junior_high", "high_school", "university"]);
    expect(AGE_GROUP_LABELS).toEqual({
      junior_high: "中学生",
      high_school: "高校生",
      university: "大学生（専門・院生含む）",
    });

    expect(isValidAgeGroup("junior_high")).toBe(true);
    expect(isValidAgeGroup("high_school")).toBe(true);
    expect(isValidAgeGroup("university")).toBe(true);

    expect(isValidAgeGroup("elementary")).toBe(false);
    expect(isValidAgeGroup("adult")).toBe(false);
    expect(isValidAgeGroup("")).toBe(false);
    expect(isValidAgeGroup(undefined)).toBe(false);
    expect(isValidAgeGroup(null)).toBe(false);
  });
});

describe("rankCandidates (候補ランキング・スコア0.3未満除外・同カテゴリ優先・最大3件)", () => {
  const me = createDummySummary({
    id: "sum-me",
    userId: "user-me",
    category: "relationships",
    tags: ["友人関係", "孤立感"],
    energy: 2,
    stage: "struggling",
  });

  it("スコア 0.3 未満の候補を除外する", () => {
    // 異カテゴリ(0) + タグ一致なし(0) + struggling/coping(0.3*0.2=0.06) => 0.06 (< 0.3)
    const belowThreshold1 = createDummySummary({
      id: "sum-low-1",
      userId: "user-low-1",
      category: "career",
      tags: ["就活"],
      energy: 4,
      stage: "coping",
    });
    // 異カテゴリ(0) + タグ一致なし(0) + recovering(1.0*0.2=0.2) => 0.2 (< 0.3)
    const belowThreshold2 = createDummySummary({
      id: "sum-low-2",
      userId: "user-low-2",
      category: "study",
      tags: ["単位"],
      energy: 4,
      stage: "recovering",
    });

    const ranked = rankCandidates(me, [belowThreshold1, belowThreshold2]);
    expect(ranked).toHaveLength(0);
  });

  it("同カテゴリを優先し、異世代・共倒れ候補・crisis候補を除外した上で上位3件のみをスコア降順で返す", () => {
    // 候補1: 同年代 + 同カテゴリ + 全タグ一致 + recovering => score = 0.5 + 0.3 + 0.2 = 1.0
    const cand1 = createDummySummary({
      id: "sum-1",
      userId: "user-1",
      ageGroup: "university",
      category: "relationships",
      tags: ["友人関係", "孤立感"],
      energy: 4,
      stage: "recovering",
    });

    // 候補2: 同年代 + 同カテゴリ + 片方タグ一致(1/2=0.5) + 同stage(0.6) => score = 0.5 + 0.15 + 0.12 = 0.77
    const cand2 = createDummySummary({
      id: "sum-2",
      userId: "user-2",
      ageGroup: "university",
      category: "relationships",
      tags: ["友人関係"],
      energy: 3,
      stage: "struggling",
    });

    // 候補3: 同年代 + 同カテゴリ + タグ一致なし(0) + coping(0.3) => score = 0.5 + 0 + 0.06 = 0.56
    const cand3 = createDummySummary({
      id: "sum-3",
      userId: "user-3",
      ageGroup: "university",
      category: "relationships",
      tags: ["サークル"],
      energy: 3,
      stage: "coping",
    });

    // 候補4: 同年代 + 異カテゴリ + 全タグ一致(1.0) + recovering(1.0) => score = 0 + 0.3 + 0.2 = 0.50
    const cand4 = createDummySummary({
      id: "sum-4",
      userId: "user-4",
      ageGroup: "university",
      category: "loneliness",
      tags: ["友人関係", "孤立感"],
      energy: 4,
      stage: "recovering",
    });

    // 候補5 (共倒れ除外): 同カテゴリ・高スコアだが energy=2 で me(energy=2) と共倒れになるため除外
    const candLowEnergy = createDummySummary({
      id: "sum-low-energy",
      userId: "user-low-energy",
      ageGroup: "university",
      category: "relationships",
      tags: ["友人関係", "孤立感"],
      energy: 2,
      stage: "recovering",
    });

    // 候補6 (crisis除外)
    const candCrisis = createDummySummary({
      id: "sum-crisis",
      userId: "user-crisis",
      ageGroup: "university",
      category: "relationships",
      tags: ["友人関係", "孤立感"],
      energy: 5,
      stage: "recovering",
      riskLevel: "crisis",
    });

    // 候補7 (異世代除外): スコア1.0相当だが ageGroup が high_school のため除外
    const candDiffAgeGroup = createDummySummary({
      id: "sum-diff-age",
      userId: "user-diff-age",
      ageGroup: "high_school",
      category: "relationships",
      tags: ["友人関係", "孤立感"],
      energy: 5,
      stage: "recovering",
    });

    const ranked = rankCandidates(me, [
      cand4,
      candLowEnergy,
      candDiffAgeGroup,
      cand2,
      candCrisis,
      cand3,
      cand1,
    ]);

    expect(ranked).toHaveLength(3);
    expect(ranked.map((r) => r.candidate.id)).toEqual([
      "sum-1",
      "sum-2",
      "sum-3",
    ]);
    expect(ranked[0].score).toBeCloseTo(1.0, 5);
    expect(ranked[1].score).toBeCloseTo(0.77, 5);
    expect(ranked[2].score).toBeCloseTo(0.56, 5);
  });
});

