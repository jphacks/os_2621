import type { RiskLevel } from "../safety/detectCrisis";

export type { RiskLevel };

export type Category =
  | "relationships"
  | "career"
  | "study"
  | "family"
  | "loneliness"
  | "health"
  | "other";

export type Stage = "struggling" | "coping" | "recovering";

export interface MatchSummary {
  id: string;
  userId: string;
  category: Category;
  tags: string[];
  energy: number; // 1〜5
  stage: Stage;
  riskLevel: RiskLevel;
  shareConsent: boolean;
  expiresAt: string; // ISO 8601
}

export interface CandidateFilterOptions {
  blockedUserIds?: string[];
  activeMatchUserIds?: string[];
  now?: Date | string | number;
}

export interface RankedCandidate {
  candidate: MatchSummary;
  score: number;
}

export const MIN_MATCH_SCORE = 0.3;
export const MAX_CANDIDATES = 3;

/**
 * 自己申告エネルギーとAI推定エネルギーを統合する純粋関数 (SPEC.md §6.2)
 * energy = round((自己申告のエネルギー + AIの推定) / 2) // 1〜5 にクランプ
 */
export function combineEnergy(self: number, estimated: number): number {
  const rounded = Math.round((self + estimated) / 2);
  return Math.min(5, Math.max(1, rounded));
}

/**
 * 2つのタグ配列のJaccard係数（積集合 / 和集合）を計算する純粋関数 (0〜1)
 * 前後の空白を除去し、空文字を除いたユニーク集合で比較する。
 * 両方とも空配列の場合は 0 を返す。
 */
export function calculateJaccard(tagsA: string[], tagsB: string[]): number {
  const setA = new Set(tagsA.map((t) => t.trim()).filter((t) => t.length > 0));
  const setB = new Set(tagsB.map((t) => t.trim()).filter((t) => t.length > 0));

  if (setA.size === 0 && setB.size === 0) {
    return 0;
  }

  let intersectionCount = 0;
  for (const tag of setA) {
    if (setB.has(tag)) {
      intersectionCount += 1;
    }
  }

  const unionCount = setA.size + setB.size - intersectionCount;
  if (unionCount === 0) {
    return 0;
  }

  return intersectionCount / unionCount;
}

/**
 * 回復段階（stage）の組み合わせによるボーナス値を計算する純粋関数 (SPEC.md §6.2)
 * - 片方が recovering で、もう片方が struggling または coping → 1.0（「少し先を行く人」とつなぐ）
 * - 同じ stage → 0.6
 * - それ以外（struggling と coping の組み合わせ） → 0.3
 */
export function calculateStageBonus(stageA: Stage, stageB: Stage): number {
  const isOneRecoveringAndOtherNot =
    (stageA === "recovering" &&
      (stageB === "struggling" || stageB === "coping")) ||
    (stageB === "recovering" &&
      (stageA === "struggling" || stageA === "coping"));

  if (isOneRecoveringAndOtherNot) {
    return 1.0;
  }

  if (stageA === stageB) {
    return 0.6;
  }

  return 0.3;
}

/**
 * 2つの要約データ間のマッチングスコアを計算する純粋関数 (SPEC.md §6.2)
 * score = 0.5 * (categoryが一致 ? 1 : 0)
 *       + 0.3 * Jaccard(tagsA, tagsB)
 *       + 0.2 * stageBonus
 */
export function calculateMatchScore(a: MatchSummary, b: MatchSummary): number {
  const categoryScore = a.category === b.category ? 1 : 0;
  const jaccardScore = calculateJaccard(a.tags, b.tags);
  const stageBonus = calculateStageBonus(a.stage, b.stage);

  const rawScore = 0.5 * categoryScore + 0.3 * jaccardScore + 0.2 * stageBonus;
  return Number(rawScore.toFixed(6));
}

/**
 * 候補ユーザーがマッチング対象として適格かを判定する純粋関数 (SPEC.md §6.1)
 *
 * 【条件】
 * 1. shareConsent === true かつ expiresAt が未来（有効期限内）
 * 2. riskLevel !== "crisis"（本人および候補の双方が危機状態ではない）
 * 3. 自分自身ではない・ブロック関係にない・すでにリクエスト中やルーム進行中の相手ではない
 * 4. 【共倒れ防止】両者のエネルギーがどちらも 2 以下の場合は除外（false）
 */
export function isEligibleCandidate(
  me: MatchSummary,
  candidate: MatchSummary,
  options?: CandidateFilterOptions
): boolean {
  // 1. 共有同意と有効期限チェック
  if (!candidate.shareConsent) {
    return false;
  }

  const nowMs =
    options?.now !== undefined
      ? new Date(options.now).getTime()
      : Date.now();
  const expiresMs = new Date(candidate.expiresAt).getTime();

  if (Number.isNaN(nowMs) || Number.isNaN(expiresMs) || expiresMs <= nowMs) {
    return false;
  }

  // 2. 危機判定除外（候補または本人が crisis の場合はマッチング不可）
  if (candidate.riskLevel === "crisis" || me.riskLevel === "crisis") {
    return false;
  }

  // 3. 自分自身・ブロック済み・進行中の相手を除外
  if (candidate.userId === me.userId || candidate.id === me.id) {
    return false;
  }

  if (options?.blockedUserIds?.includes(candidate.userId)) {
    return false;
  }

  if (options?.activeMatchUserIds?.includes(candidate.userId)) {
    return false;
  }

  // 4. 【共倒れ防止】両者のエネルギーが共に 2 以下の場合は除外
  if (me.energy <= 2 && candidate.energy <= 2) {
    return false;
  }

  return true;
}

/**
 * 適格な候補を抽出し、スコア降順で上位3件（score >= 0.3）を返す純粋関数 (SPEC.md §6.2)
 */
export function rankCandidates(
  me: MatchSummary,
  candidates: MatchSummary[],
  options?: CandidateFilterOptions
): RankedCandidate[] {
  return candidates
    .filter((candidate) => isEligibleCandidate(me, candidate, options))
    .map((candidate) => ({
      candidate,
      score: calculateMatchScore(me, candidate),
    }))
    .filter((item) => item.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);
}
