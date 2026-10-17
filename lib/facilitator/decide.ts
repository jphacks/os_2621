import type { RiskLevel } from "../safety/detectCrisis";
import {
  ANALYZE_EVERY_N,
  FACILITATOR_CONFIG,
  type FacilitatorConfig,
} from "./config";

/**
 * SPEC.md §5.6 の介入トリガー種別
 */
export type FacilitatorTrigger =
  | "opening"
  | "negative_streak"
  | "hostility"
  | "pii_attempt"
  | "silence"
  | "time_warning"
  | "closing";

/**
 * prompts/flow_analysis.md のJSON出力スキーマに対応する型
 */
export interface FlowAnalysisResult {
  negative_streak?: boolean;
  rumination?: boolean;
  hostility?: boolean;
  pii_attempt?: boolean;
}

/**
 * ファシリテーター介入判定への入力データ
 */
export interface FacilitatorInput {
  /** ルーム開始時の初回挨拶かどうか */
  isOpening?: boolean;

  /** ルーム開始からの経過時間（ミリ秒） */
  elapsedMs?: number;
  /** ルーム開始からの経過時間（分）※elapsedMs が未指定の場合に使用 */
  elapsedMinutes?: number;

  /** 25分経過時の終了予告（time_warning）をすでに送信済みかどうか */
  timeWarningAlreadySent?: boolean;

  /** 最後のメッセージからの無言経過時間（ミリ秒） */
  silenceMs?: number;

  /** 前回のファシリテーター介入からの経過時間（ミリ秒）。未介入の場合は null または undefined */
  msSinceLastIntervention?: number | null;

  /** 直近メッセージに対する L2 のリスク判定リスト（時系列順または直近順） */
  recentRiskLevels?: RiskLevel[];
  /** 直近6件のうち caution だった件数（直接件数を渡す場合） */
  recentCautionCount?: number;

  /** prompts/flow_analysis.md による会話の流れの分析結果 */
  flowAnalysis?: FlowAnalysisResult;

  /** 今回のメッセージで PII（個人情報・SNS ID等）がマスクされたかどうか */
  piiMasked?: boolean;

  /**
   * 前回までの連続 hostility（攻撃的発言）回数。
   * 今回も hostility が検知された場合、`previousHostilityCount + 1` となり、2回以上で `closeRoom: true` となる。
   */
  previousHostilityCount?: number;

  /**
   * 今回の判定を含めた連続 hostility 回数を直接渡す場合のフィールド（省略可）。
   */
  consecutiveHostilityCount?: number;

  /** カスタム設定（デモ高速モード時などに差し替え可能） */
  config?: Partial<FacilitatorConfig>;
}

/**
 * ファシリテーター介入判定の結果
 */
export interface FacilitatorAction {
  /** ファシリテーターが発言・介入すべきかどうか */
  shouldIntervene: boolean;
  /** 介入の理由トリガー（介入しない場合は null） */
  trigger: FacilitatorTrigger | null;
  /** ルームを終了すべきかどうか（30分経過 または hostility 2回連続） */
  closeRoom: boolean;
  /** ルームを終了する場合の理由（rooms.end_reason 用） */
  endReason?: "timeout" | "safety";
  /** 更新後の連続 hostility 回数 */
  nextHostilityCount: number;
  /** 最短介入間隔（MIN_INTERVENTION_INTERVAL_MS）によって介入が抑制されたかどうか */
  suppressedByInterval: boolean;
}

/**
 * メッセージ件数から flow_analysis を実行すべきタイミング（ANALYZE_EVERY_N = 3件ごと）かを判定する純粋関数
 */
export function shouldAnalyzeFlow(
  messageCount: number,
  analyzeEveryN: number = ANALYZE_EVERY_N
): boolean {
  if (messageCount <= 0 || analyzeEveryN <= 0) {
    return false;
  }
  return messageCount % analyzeEveryN === 0;
}

/**
 * 直近メッセージの RiskLevel 配列から、直近6件中4件以上が否定的（caution または crisis）かを判定するヘルパー
 */
function hasNegativeRiskStreak(
  recentRiskLevels: RiskLevel[] | undefined,
  windowSize: number,
  threshold: number
): boolean {
  if (!recentRiskLevels || recentRiskLevels.length === 0) {
    return false;
  }
  const recentWindow = recentRiskLevels.slice(-windowSize);
  const negativeCount = recentWindow.filter(
    (level) => level === "caution" || level === "crisis"
  ).length;
  return negativeCount >= threshold;
}

/**
 * SPEC.md §5.6 の介入条件表に基づき、AIファシリテーターの介入有無・トリガー・ルーム終了を判定する純粋関数
 *
 * 【優先順位とルール】
 * 1. 時間切れ（closing: 30分以上経過） → 最優先で介入＆ルーム終了（closeRoom: true, endReason: "timeout"）。間隔抑制の対象外。
 * 2. 攻撃的発言（hostility） → 重大な安全違反のため間隔抑制の対象外。2回連続でルーム終了（closeRoom: true, endReason: "safety"）。
 * 3. 個人情報・外部SNS誘導（pii_attempt） → 安全違反のため間隔抑制の対象外。
 * 4. 終了予告（time_warning: 25分以上経過・未送信） → 間隔抑制の対象外。
 * 5. ルーム開始時（opening） → 初回挨拶のため間隔抑制の対象外。
 * 6. 否定の連続・反芻（negative_streak）/ 沈黙（silence: 3分以上） →
 *    前回の介入から MIN_INTERVENTION_INTERVAL_MS（2分）未満の場合は介入を抑制する。
 */
export function decideIntervention(input: FacilitatorInput): FacilitatorAction {
  const cfg: FacilitatorConfig = {
    ...FACILITATOR_CONFIG,
    ...input.config,
  };

  // 経過時間（ミリ秒）の算出
  const elapsedMs =
    input.elapsedMs !== undefined
      ? input.elapsedMs
      : input.elapsedMinutes !== undefined
        ? input.elapsedMinutes * 60 * 1000
        : 0;

  // 連続 hostility 回数の算出
  const isHostileNow = Boolean(input.flowAnalysis?.hostility);
  let nextHostilityCount: number;

  if (input.consecutiveHostilityCount !== undefined) {
    nextHostilityCount = isHostileNow
      ? Math.max(input.consecutiveHostilityCount, (input.previousHostilityCount ?? 0) + 1)
      : input.consecutiveHostilityCount;
  } else if (isHostileNow) {
    nextHostilityCount = (input.previousHostilityCount ?? 0) + 1;
  } else if (input.flowAnalysis !== undefined) {
    // flowAnalysis が実行され hostility が false だった場合は連続カウントをリセット
    nextHostilityCount = 0;
  } else {
    nextHostilityCount = input.previousHostilityCount ?? 0;
  }

  // 1. 制限時間（30分）到達による closing（間隔抑制の対象外）
  if (elapsedMs >= cfg.ROOM_LIMIT_MS) {
    return {
      shouldIntervene: true,
      trigger: "closing",
      closeRoom: true,
      endReason: "timeout",
      nextHostilityCount,
      suppressedByInterval: false,
    };
  }

  // 2. 攻撃的・否定的な発言（hostility）（重大な安全違反・間隔抑制の対象外）
  if (isHostileNow || (input.consecutiveHostilityCount ?? 0) >= cfg.HOSTILITY_CLOSE_THRESHOLD) {
    const shouldClose = nextHostilityCount >= cfg.HOSTILITY_CLOSE_THRESHOLD;
    return {
      shouldIntervene: true,
      trigger: "hostility",
      closeRoom: shouldClose,
      ...(shouldClose ? { endReason: "safety" as const } : {}),
      nextHostilityCount,
      suppressedByInterval: false,
    };
  }

  // 3. 個人情報・外部SNSへの誘導（pii_attempt）（安全違反・間隔抑制の対象外）
  const isPiiAttempt = Boolean(input.piiMasked || input.flowAnalysis?.pii_attempt);
  if (isPiiAttempt) {
    return {
      shouldIntervene: true,
      trigger: "pii_attempt",
      closeRoom: false,
      nextHostilityCount,
      suppressedByInterval: false,
    };
  }

  // 4. 開始から25分の終了予告（time_warning）（間隔抑制の対象外）
  if (elapsedMs >= cfg.TIME_WARNING_MS && !input.timeWarningAlreadySent) {
    return {
      shouldIntervene: true,
      trigger: "time_warning",
      closeRoom: false,
      nextHostilityCount,
      suppressedByInterval: false,
    };
  }

  // 5. ルーム開始時の挨拶（opening）（間隔抑制の対象外）
  if (input.isOpening) {
    return {
      shouldIntervene: true,
      trigger: "opening",
      closeRoom: false,
      nextHostilityCount,
      suppressedByInterval: false,
    };
  }

  // 6. 通常介入トリガー（negative_streak / silence）の判定
  const isNegativeStreak =
    Boolean(input.flowAnalysis?.negative_streak) ||
    Boolean(input.flowAnalysis?.rumination) ||
    (input.recentCautionCount !== undefined &&
      input.recentCautionCount >= cfg.NEGATIVE_STREAK_THRESHOLD) ||
    hasNegativeRiskStreak(
      input.recentRiskLevels,
      cfg.NEGATIVE_STREAK_WINDOW,
      cfg.NEGATIVE_STREAK_THRESHOLD
    );

  const isSilence =
    input.silenceMs !== undefined && input.silenceMs >= cfg.SILENCE_THRESHOLD_MS;

  const candidateTrigger: FacilitatorTrigger | null = isNegativeStreak
    ? "negative_streak"
    : isSilence
      ? "silence"
      : null;

  if (!candidateTrigger) {
    return {
      shouldIntervene: false,
      trigger: null,
      closeRoom: false,
      nextHostilityCount,
      suppressedByInterval: false,
    };
  }

  // 前回の介入からの経過時間チェック（MIN_INTERVENTION_INTERVAL_MS 未満なら抑制）
  if (
    input.msSinceLastIntervention !== undefined &&
    input.msSinceLastIntervention !== null &&
    input.msSinceLastIntervention < cfg.MIN_INTERVENTION_INTERVAL_MS
  ) {
    return {
      shouldIntervene: false,
      trigger: null,
      closeRoom: false,
      nextHostilityCount,
      suppressedByInterval: true,
    };
  }

  return {
    shouldIntervene: true,
    trigger: candidateTrigger,
    closeRoom: false,
    nextHostilityCount,
    suppressedByInterval: false,
  };
}
