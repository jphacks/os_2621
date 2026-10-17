import { describe, it, expect } from "vitest";
import {
  ANALYZE_EVERY_N,
  MIN_INTERVENTION_INTERVAL_MS,
  ROOM_LIMIT_MIN,
  TIME_WARNING_MIN,
  SILENCE_THRESHOLD_MS,
  ROOM_LIMIT_MS,
  TIME_WARNING_MS,
  FACILITATOR_CONFIG,
  getFacilitatorConfig,
} from "../../lib/facilitator/config";
import {
  decideIntervention,
  shouldAnalyzeFlow,
} from "../../lib/facilitator/decide";

describe("facilitator config", () => {
  it("SPEC.md §5.6 の定数値が正しく定義されている", () => {
    expect(ANALYZE_EVERY_N).toBe(3);
    expect(MIN_INTERVENTION_INTERVAL_MS).toBe(120_000);
    expect(ROOM_LIMIT_MIN).toBe(30);
    expect(TIME_WARNING_MIN).toBe(25);
    expect(SILENCE_THRESHOLD_MS).toBe(180_000);
    expect(FACILITATOR_CONFIG.ANALYZE_EVERY_N).toBe(3);
    expect(FACILITATOR_CONFIG.MIN_INTERVENTION_INTERVAL_MS).toBe(120_000);
  });

  it("デモ高速モード（getFacilitatorConfig(true)）で時間系定数が1/10になる", () => {
    const fast = getFacilitatorConfig(true);
    expect(fast.MIN_INTERVENTION_INTERVAL_MS).toBe(12_000);
    expect(fast.ROOM_LIMIT_MIN).toBe(3);
    expect(fast.TIME_WARNING_MIN).toBe(2.5);
    expect(fast.SILENCE_THRESHOLD_MS).toBe(18_000);
  });

  it("shouldAnalyzeFlow は3件ごとに true を返す", () => {
    expect(shouldAnalyzeFlow(0)).toBe(false);
    expect(shouldAnalyzeFlow(1)).toBe(false);
    expect(shouldAnalyzeFlow(2)).toBe(false);
    expect(shouldAnalyzeFlow(3)).toBe(true);
    expect(shouldAnalyzeFlow(4)).toBe(false);
    expect(shouldAnalyzeFlow(6)).toBe(true);
  });
});

describe("decideIntervention", () => {
  it("1. opening: ルーム開始時は opening トリガーで介入する", () => {
    const result = decideIntervention({ isOpening: true });
    expect(result.shouldIntervene).toBe(true);
    expect(result.trigger).toBe("opening");
    expect(result.closeRoom).toBe(false);
  });

  it("2. negative_streak: flowAnalysis.negative_streak または rumination が true のとき介入する", () => {
    const res1 = decideIntervention({
      flowAnalysis: { negative_streak: true },
    });
    expect(res1.shouldIntervene).toBe(true);
    expect(res1.trigger).toBe("negative_streak");
    expect(res1.closeRoom).toBe(false);

    const res2 = decideIntervention({
      flowAnalysis: { rumination: true },
    });
    expect(res2.shouldIntervene).toBe(true);
    expect(res2.trigger).toBe("negative_streak");
    expect(res2.closeRoom).toBe(false);
  });

  it("2b. negative_streak: 直近6件のうち4件以上が L2 caution のとき介入する", () => {
    const res = decideIntervention({
      recentRiskLevels: ["none", "caution", "caution", "none", "caution", "caution"],
    });
    expect(res.shouldIntervene).toBe(true);
    expect(res.trigger).toBe("negative_streak");

    const resNotEnough = decideIntervention({
      recentRiskLevels: ["none", "caution", "caution", "none", "caution", "none"],
    });
    expect(resNotEnough.shouldIntervene).toBe(false);
    expect(resNotEnough.trigger).toBeNull();
  });

  it("3. hostility: 1回目の攻撃的発言では介入し、ルームはまだ閉じない（closeRoom: false）", () => {
    const res = decideIntervention({
      flowAnalysis: { hostility: true },
      previousHostilityCount: 0,
    });
    expect(res.shouldIntervene).toBe(true);
    expect(res.trigger).toBe("hostility");
    expect(res.closeRoom).toBe(false);
    expect(res.nextHostilityCount).toBe(1);
  });

  it("3b. hostility: 2回連続で攻撃的発言が検知された場合はルーム終了（closeRoom: true, endReason: 'safety'）", () => {
    const res = decideIntervention({
      flowAnalysis: { hostility: true },
      previousHostilityCount: 1,
    });
    expect(res.shouldIntervene).toBe(true);
    expect(res.trigger).toBe("hostility");
    expect(res.closeRoom).toBe(true);
    expect(res.endReason).toBe("safety");
    expect(res.nextHostilityCount).toBe(2);
  });

  it("3c. hostility: 間に穏やかな会話（hostility: false）を挟んだら連続カウントがリセットされる", () => {
    const afterNormal = decideIntervention({
      flowAnalysis: { hostility: false },
      previousHostilityCount: 1,
    });
    expect(afterNormal.nextHostilityCount).toBe(0);
    expect(afterNormal.closeRoom).toBe(false);
  });

  it("4. pii_attempt: 個人情報マスク検知時または flowAnalysis.pii_attempt 時に介入する", () => {
    const resMasked = decideIntervention({ piiMasked: true });
    expect(resMasked.shouldIntervene).toBe(true);
    expect(resMasked.trigger).toBe("pii_attempt");
    expect(resMasked.closeRoom).toBe(false);

    const resFlow = decideIntervention({
      flowAnalysis: { pii_attempt: true },
    });
    expect(resFlow.shouldIntervene).toBe(true);
    expect(resFlow.trigger).toBe("pii_attempt");
  });

  it("5. silence: 沈黙が SILENCE_THRESHOLD_MS（3分）以上続いたときに介入する", () => {
    const underSilence = decideIntervention({
      silenceMs: SILENCE_THRESHOLD_MS - 1,
    });
    expect(underSilence.shouldIntervene).toBe(false);

    const atSilence = decideIntervention({
      silenceMs: SILENCE_THRESHOLD_MS,
    });
    expect(atSilence.shouldIntervene).toBe(true);
    expect(atSilence.trigger).toBe("silence");
    expect(atSilence.closeRoom).toBe(false);
  });

  it("6. time_warning: 開始から25分（TIME_WARNING_MIN）経過時に介入し、送信済みなら再介入しない", () => {
    const res = decideIntervention({
      elapsedMs: TIME_WARNING_MS,
      timeWarningAlreadySent: false,
    });
    expect(res.shouldIntervene).toBe(true);
    expect(res.trigger).toBe("time_warning");
    expect(res.closeRoom).toBe(false);

    const alreadySent = decideIntervention({
      elapsedMs: TIME_WARNING_MS + 10_000,
      timeWarningAlreadySent: true,
    });
    expect(alreadySent.shouldIntervene).toBe(false);
    expect(alreadySent.trigger).toBeNull();
  });

  it("7. closing: 開始から30分（ROOM_LIMIT_MIN）経過時に介入し、closeRoom: true を返す", () => {
    const res = decideIntervention({
      elapsedMs: ROOM_LIMIT_MS,
    });
    expect(res.shouldIntervene).toBe(true);
    expect(res.trigger).toBe("closing");
    expect(res.closeRoom).toBe(true);
    expect(res.endReason).toBe("timeout");
  });

  describe("最短介入間隔（MIN_INTERVENTION_INTERVAL_MS）による抑制と例外", () => {
    it("前回の介入から2分未満の場合、negative_streak や silence は抑制される", () => {
      const suppressedNegative = decideIntervention({
        flowAnalysis: { negative_streak: true },
        msSinceLastIntervention: MIN_INTERVENTION_INTERVAL_MS - 1_000,
      });
      expect(suppressedNegative.shouldIntervene).toBe(false);
      expect(suppressedNegative.trigger).toBeNull();
      expect(suppressedNegative.suppressedByInterval).toBe(true);

      const suppressedSilence = decideIntervention({
        silenceMs: SILENCE_THRESHOLD_MS + 10_000,
        msSinceLastIntervention: 30_000,
      });
      expect(suppressedSilence.shouldIntervene).toBe(false);
      expect(suppressedSilence.trigger).toBeNull();
      expect(suppressedSilence.suppressedByInterval).toBe(true);
    });

    it("前回の介入から2分以上経過していれば、negative_streak や silence で介入する", () => {
      const allowedNegative = decideIntervention({
        flowAnalysis: { negative_streak: true },
        msSinceLastIntervention: MIN_INTERVENTION_INTERVAL_MS,
      });
      expect(allowedNegative.shouldIntervene).toBe(true);
      expect(allowedNegative.trigger).toBe("negative_streak");
      expect(allowedNegative.suppressedByInterval).toBe(false);
    });

    it("前回の介入から2分未満でも、終了予告・時間切れ・重大な安全違反（hostility / pii_attempt）は抑制されない", () => {
      const shortInterval = 10_000; // 10秒前

      const hostilityRes = decideIntervention({
        flowAnalysis: { hostility: true },
        previousHostilityCount: 0,
        msSinceLastIntervention: shortInterval,
      });
      expect(hostilityRes.shouldIntervene).toBe(true);
      expect(hostilityRes.trigger).toBe("hostility");

      const piiRes = decideIntervention({
        piiMasked: true,
        msSinceLastIntervention: shortInterval,
      });
      expect(piiRes.shouldIntervene).toBe(true);
      expect(piiRes.trigger).toBe("pii_attempt");

      const warningRes = decideIntervention({
        elapsedMinutes: TIME_WARNING_MIN,
        msSinceLastIntervention: shortInterval,
      });
      expect(warningRes.shouldIntervene).toBe(true);
      expect(warningRes.trigger).toBe("time_warning");

      const closingRes = decideIntervention({
        elapsedMinutes: ROOM_LIMIT_MIN,
        msSinceLastIntervention: shortInterval,
      });
      expect(closingRes.shouldIntervene).toBe(true);
      expect(closingRes.trigger).toBe("closing");
      expect(closingRes.closeRoom).toBe(true);
    });
  });
});
