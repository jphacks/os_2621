// ファシリテーターの介入の間隔など（デモで短くできるよう定数にまとめる）
const FAST = process.env.NEXT_PUBLIC_DEMO_FAST_TIMER === "true";

export const FACILITATOR_CONFIG = {
  /** 何件ごとに流れの分析を行うか */
  analyzeEveryMessages: 3,
  /** 介入の最短間隔（ミリ秒） */
  minInterventionIntervalMs: FAST ? 12_000 : 2 * 60_000,
  /** ルームの長さ（ミリ秒）。ルーム作成側（respond API）と合わせる */
  roomDurationMs: FAST ? 3 * 60_000 : 30 * 60_000,
  /** 同じイベントを2人が送ったときの重複を無視する時間 */
  dedupeWindowMs: 30_000,
} as const;
