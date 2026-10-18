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

/**
 * ピアマッチング対象の年代区分
 * - junior_high: 中学生（未成年保護: 中学生同士のみ）
 * - high_school: 高校生（未成年保護: 高校生同士のみ）
 * - university: 大学生（短期大学・専門学校・高専等含む）
 * - graduate: 大学院生
 * ※ 未成年と成人（大学生・大学院生）は絶対にマッチングしない。
 * ※ 社会人 (working)・その他 (other) は対象外として除外。
 */
export type AgeGroup =
  | "junior_high"
  | "high_school"
  | "university"
  | "graduate";

export const AGE_GROUPS: readonly AgeGroup[] = [
  "junior_high",
  "high_school",
  "university",
  "graduate",
] as const;

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  junior_high: "中学生",
  high_school: "高校生",
  university: "大学生（専門生含む）",
  graduate: "大学院生",
};

/**
 * 与えられた値がピアマッチング対象の有効な年代区分かを判定する純粋関数
 */
export function isValidAgeGroup(value: unknown): value is AgeGroup {
  return (
    typeof value === "string" &&
    (AGE_GROUPS as readonly string[]).includes(value)
  );
}

/**
 * 2つの年代区分がマッチング可能（互換性あり）かを判定する純粋関数
 *
 * 【安全原則・未成年保護】
 * 1. どちらかが未設定（undefined/null）または無効値（working/other含む）なら除外 (fail-closed)
 * 2. 中学生 (junior_high) は中学生同士のみ
 * 3. 高校生 (high_school) は高校生同士のみ
 * 4. 未成年と成人（大学生・大学院生）は絶対にマッチしない
 *
 * 【大学生・大学院生の近接年代間マッチング】
 * - 大学生 (university) ⇄ 大学院生 (graduate)
 * - 同年代同士は常に互換あり
 */
export function isAgeCompatible(a?: unknown, b?: unknown): boolean {
  if (!isValidAgeGroup(a) || !isValidAgeGroup(b)) {
    return false;
  }
  if (a === b) {
    return true;
  }

  // 未成年保護: 中学生・高校生は同年代以外一切不可（中学生×高校生も不可）
  if (a === "junior_high" || b === "junior_high") {
    return false;
  }
  if (a === "high_school" || b === "high_school") {
    return false;
  }

  // 大学生・大学院生の近接年代ペア（双方向）
  const compatiblePairs: ReadonlyArray<readonly [AgeGroup, AgeGroup]> = [
    ["university", "graduate"],
    ["graduate", "university"],
  ];

  return compatiblePairs.some(([x, y]) => a === x && b === y);
}

/**
 * 年代の組み合わせによる親和性スコアボーナス係数を計算する純粋関数 (0〜1.0)
 * - 同年代 (a === b): 1.0 (最優先)
 * - 近接年代 (isAgeCompatible): 0.85
 * - それ以外 / 未設定: 0.0
 */
export function calculateAgeBonus(ageA?: unknown, ageB?: unknown): number {
  if (!isValidAgeGroup(ageA) || !isValidAgeGroup(ageB)) {
    return 0.0;
  }
  if (ageA === ageB) {
    return 1.0;
  }
  if (isAgeCompatible(ageA, ageB)) {
    return 0.85;
  }
  return 0.0;
}

export interface MatchSummary {
  id: string;
  userId: string;
  ageGroup?: AgeGroup;
  isDemo?: boolean;
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
 *
 * 【バイアス補正（任意引数 mood 指定時）】
 * 悩み相談の入り口では「気分（mood）は落ち着いている（3〜5）のに、エネルギーは謙遜や疲労感から低く（1〜2）選ぶ」傾向がある。
 * そのため mood が 4 以上（または mood が 3 以上かつ AI対話後の推定 readiness が 3 以上）の場合は、
 * 初期自己申告の下方バイアスを +1（最大3まで）緩和してから統合する。
 */
export function combineEnergy(
  self: number,
  estimated: number,
  mood?: number
): number {
  let effectiveSelf = self;
  if (
    mood !== undefined &&
    self <= 2 &&
    (mood >= 4 || (mood >= 3 && estimated >= 3))
  ) {
    effectiveSelf = Math.min(3, self + 1);
  }
  const rounded = Math.round((effectiveSelf + estimated) / 2);
  return Math.min(5, Math.max(1, rounded));
}

const TAG_SYNONYM_MAP: Readonly<Record<string, string>> = {
  人間関係: "友人関係",
  友達関係: "友人関係",
  対人関係: "友人関係",
  友達: "友人関係",
  友人: "友人関係",
  クラスメイト: "友人関係",
  孤立: "孤立感",
  孤独: "孤立感",
  孤独感: "孤立感",
  ひとりぼっち: "孤立感",
  浮いている: "孤立感",
  なじめていない: "孤立感",
  なじめない: "新生活",
  環境変化: "新生活",
  新環境: "新生活",
  大学生活: "新生活",
  部活: "サークル",
  部活動: "サークル",
  寂しさ: "さみしさ",
  寂しい: "さみしさ",
  さみしい: "さみしさ",
  就職活動: "就活",
  就職: "就活",
  あせり: "焦り",
  キャリア: "進路",
  将来: "進路",
  学業: "勉強",
  授業: "勉強",
  試験: "勉強",
  テスト: "勉強",
  睡眠: "生活リズム",
  不眠: "生活リズム",
  夜更かし: "生活リズム",
};

/**
 * タグの表記揺れ（類義語・全半角・空白）を正規化する純粋関数
 */
export function normalizeTag(raw: string): string {
  const cleaned = raw.normalize("NFKC").trim();
  if (!cleaned) return "";
  return TAG_SYNONYM_MAP[cleaned] ?? cleaned;
}

/**
 * 2つのタグ配列のJaccard係数（積集合 / 和集合）を計算する純粋関数 (0〜1)
 * 前後の空白や表記揺れを正規化し、空文字を除いたユニーク集合で比較する。
 * 両方とも空配列の場合は 0 を返す。
 */
export function calculateJaccard(tagsA: string[], tagsB: string[]): number {
  const setA = new Set(tagsA.map(normalizeTag).filter((t) => t.length > 0));
  const setB = new Set(tagsB.map(normalizeTag).filter((t) => t.length > 0));

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
 * baseScore = 0.5 * (categoryが一致 ? 1 : 0)
 *           + 0.3 * Jaccard(tagsA, tagsB)
 *           + 0.2 * stageBonus
 *
 * 同年代を最優先しつつ、近接年代（大学×大学院等）でもボーナス係数（0.85）を乗じてスコアを算出。
 * 年代未設定時は baseScore そのまま（後方互換）。
 */
export function calculateMatchScore(a: MatchSummary, b: MatchSummary): number {
  const categoryScore = a.category === b.category ? 1 : 0;
  const jaccardScore = calculateJaccard(a.tags, b.tags);
  const stageBonus = calculateStageBonus(a.stage, b.stage);

  const baseScore = 0.5 * categoryScore + 0.3 * jaccardScore + 0.2 * stageBonus;

  let ageFactor = 1.0;
  if (a.ageGroup && b.ageGroup) {
    if (a.ageGroup === b.ageGroup) {
      ageFactor = 1.0;
    } else if (isAgeCompatible(a.ageGroup, b.ageGroup)) {
      ageFactor = 0.85;
    } else {
      ageFactor = 0.0;
    }
  }

  return Number((baseScore * ageFactor).toFixed(6));
}

/**
 * 候補ユーザーがマッチング対象として適格かを判定する純粋関数 (SPEC.md §6.1)
 *
 * 【条件】
 * 1. shareConsent === true かつ expiresAt が未来（有効期限内）
 * 2. riskLevel !== "crisis"（本人および候補の双方が危機状態ではない）
 * 3. 自分自身ではない・ブロック関係にない・すでにリクエスト中やルーム進行中の相手ではない
 * 4. 【共倒れ防止】両者のエネルギーがどちらも 2 以下の場合は除外（false）
 * 5. 【年代別マッチング（未成年保護・世代間ギャップ防止）】
 *    ageGroup が指定されている場合は有効な年代区分かつ互換性があること（fail-closed）。
 *    未成年（中学生・高校生）は完全一致のみ、成人層は同年代または近接年代のみ許可。
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

  // 5. 【年代別マッチング】ageGroup が指定されている場合は互換性チェック（fail-closed）
  if (me.ageGroup !== undefined || candidate.ageGroup !== undefined) {
    if (!isAgeCompatible(me.ageGroup, candidate.ageGroup)) {
      return false;
    }
  }

  return true;
}

/**
 * 適格な候補を抽出し、実在ユーザー（!isDemo）をデモ用シードより優先した上でスコア降順で上位3件（score >= 0.3）を返す純粋関数 (SPEC.md §6.2)
 * スコアが同点の場合は、より心のゆとり（energy）が高い候補を優先して上位に並べる（共倒れリスクのさらなる低減）。
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
    .sort((a, b) => {
      const aDemo = a.candidate.isDemo === true ? 1 : 0;
      const bDemo = b.candidate.isDemo === true ? 1 : 0;
      if (aDemo !== bDemo) {
        return aDemo - bDemo;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.candidate.energy - a.candidate.energy;
    })
    .slice(0, MAX_CANDIDATES);
}
