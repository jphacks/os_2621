/**
 * AIファシリテーターの設定定数 (SPEC.md §5.6 / AI_DEV_INSTRUCTIONS.md Phase 6)
 */

/** 流れの分析（flow_analysis）を実行するメッセージ間隔（3件ごと） */
export const ANALYZE_EVERY_N = 3;

/** ファシリテーターの最短介入間隔（ミリ秒: 2分 = 120,000ms） */
export const MIN_INTERVENTION_INTERVAL_MS = 120_000;

/** チャットルームの制限時間（分: 30分） */
export const ROOM_LIMIT_MIN = 30;

/** チャットルーム終了予告のタイミング（分: 開始から25分） */
export const TIME_WARNING_MIN = 25;

/** 沈黙と判定するまでの経過時間（ミリ秒: 3分 = 180,000ms） */
export const SILENCE_THRESHOLD_MS = 180_000;

/** チャットルームの制限時間（ミリ秒: 30分 = 1,800,000ms） */
export const ROOM_LIMIT_MS = ROOM_LIMIT_MIN * 60 * 1000;

/** チャットルーム終了予告のタイミング（ミリ秒: 25分 = 1,500,000ms） */
export const TIME_WARNING_MS = TIME_WARNING_MIN * 60 * 1000;

/** ルーム強制終了となる連続 hostility（攻撃的発言）回数 */
export const HOSTILITY_CLOSE_THRESHOLD = 2;

/** 直近メッセージのうち negative_streak と判定するウィンドウ件数と閾値 (SPEC.md §5.6: 直近6件中4件以上) */
export const NEGATIVE_STREAK_WINDOW = 6;
export const NEGATIVE_STREAK_THRESHOLD = 4;

export interface FacilitatorConfig {
  ANALYZE_EVERY_N: number;
  MIN_INTERVENTION_INTERVAL_MS: number;
  ROOM_LIMIT_MIN: number;
  TIME_WARNING_MIN: number;
  SILENCE_THRESHOLD_MS: number;
  ROOM_LIMIT_MS: number;
  TIME_WARNING_MS: number;
  HOSTILITY_CLOSE_THRESHOLD: number;
  NEGATIVE_STREAK_WINDOW: number;
  NEGATIVE_STREAK_THRESHOLD: number;
}

export const FACILITATOR_CONFIG: FacilitatorConfig = {
  ANALYZE_EVERY_N,
  MIN_INTERVENTION_INTERVAL_MS,
  ROOM_LIMIT_MIN,
  TIME_WARNING_MIN,
  SILENCE_THRESHOLD_MS,
  ROOM_LIMIT_MS,
  TIME_WARNING_MS,
  HOSTILITY_CLOSE_THRESHOLD,
  NEGATIVE_STREAK_WINDOW,
  NEGATIVE_STREAK_THRESHOLD,
};

/**
 * デモ用高速タイマー（NEXT_PUBLIC_DEMO_FAST_TIMER=true のとき時間を 1/10 に短縮）に対応した設定取得関数
 */
export function getFacilitatorConfig(demoFastTimer = false): FacilitatorConfig {
  const scale = demoFastTimer ? 0.1 : 1;
  return {
    ...FACILITATOR_CONFIG,
    MIN_INTERVENTION_INTERVAL_MS: Math.round(MIN_INTERVENTION_INTERVAL_MS * scale),
    ROOM_LIMIT_MIN: ROOM_LIMIT_MIN * scale,
    TIME_WARNING_MIN: TIME_WARNING_MIN * scale,
    SILENCE_THRESHOLD_MS: Math.round(SILENCE_THRESHOLD_MS * scale),
    ROOM_LIMIT_MS: Math.round(ROOM_LIMIT_MS * scale),
    TIME_WARNING_MS: Math.round(TIME_WARNING_MS * scale),
  };
}
