import {
  CAUTION_KEYWORDS,
  CRISIS_KEYWORDS,
  CRISIS_PATTERNS,
  normalizeForCrisisCheck,
  type RiskCategory,
  type RiskLevel,
} from "./crisisKeywords";

export type { RiskCategory, RiskLevel };

export interface RiskResult {
  level: RiskLevel;
  categories: RiskCategory[];
  matchedKeywords?: string[];
}

export type L2RiskResult =
  | (RiskResult & { reason: string })
  | { level: "unknown"; reason?: string };

const LEVEL_PRIORITY: Record<RiskLevel, number> = {
  none: 0,
  caution: 1,
  crisis: 2,
};

/**
 * L1 ルールベースによる危機検知（純粋関数・同期実行）
 *
 * - 入力テキストを正規化（NFKC、小文字化、カタカナ→ひらがな、空白・絵文字除去版）して照合します。
 * - 直接的な表現だけでなく、遠回しな表現・ひらがな・絵文字混じりの表現も検出します。
 */
export function detectCrisisL1(text: string): RiskResult {
  if (!text || text.trim().length === 0) {
    return {
      level: "none",
      categories: [],
      matchedKeywords: [],
    };
  }

  const { normalized, compact } = normalizeForCrisisCheck(text);

  const matchedCategories = new Set<RiskCategory>();
  const matchedKeywords = new Set<string>();

  // 1. CRISIS キーワード照合（正規化テキスト & 空白/絵文字除去テキスト）
  for (const entry of CRISIS_KEYWORDS) {
    for (const rawKeyword of entry.keywords) {
      const { normalized: normKw, compact: compactKw } =
        normalizeForCrisisCheck(rawKeyword);

      if (
        (normKw.length > 0 && normalized.includes(normKw)) ||
        (compactKw.length > 0 && compact.includes(compactKw))
      ) {
        matchedCategories.add(entry.category);
        matchedKeywords.add(rawKeyword);
      }
    }
  }

  // 2. CRISIS 正規表現パターン照合
  for (const entry of CRISIS_PATTERNS) {
    if (entry.pattern.test(normalized) || entry.pattern.test(compact)) {
      matchedCategories.add(entry.category);
      matchedKeywords.add(entry.label);
    }
  }

  if (matchedCategories.size > 0) {
    return {
      level: "crisis",
      categories: Array.from(matchedCategories),
      matchedKeywords: Array.from(matchedKeywords),
    };
  }

  // 3. CAUTION キーワード照合
  const cautionCategories = new Set<RiskCategory>();
  const cautionKeywords = new Set<string>();

  for (const entry of CAUTION_KEYWORDS) {
    for (const rawKeyword of entry.keywords) {
      const { normalized: normKw, compact: compactKw } =
        normalizeForCrisisCheck(rawKeyword);

      if (
        (normKw.length > 0 && normalized.includes(normKw)) ||
        (compactKw.length > 0 && compact.includes(compactKw))
      ) {
        cautionCategories.add(entry.category);
        cautionKeywords.add(rawKeyword);
      }
    }
  }

  if (cautionCategories.size > 0) {
    return {
      level: "caution",
      categories: Array.from(cautionCategories),
      matchedKeywords: Array.from(cautionKeywords),
    };
  }

  return {
    level: "none",
    categories: [],
    matchedKeywords: [],
  };
}

/**
 * L1（ルールベース）と L2（LLM分類）の二重判定を統合する純粋関数
 *
 * 【安全設計・fail-closed 原則】
 * - L1 または L2 のどちらか一方でも "crisis" なら finalLevel: "crisis", blocked: true とする。
 * - L2 がエラーやタイムアウト等で "unknown" になった場合は、安全側に倒して blocked: true（マッチング停止）とする。
 *   このとき finalLevel は L1 の判定結果（または最低でも安全側）を維持する。
 */
export function mergeRiskResults(
  l1: RiskResult,
  l2: L2RiskResult
): { finalLevel: RiskLevel; blocked: boolean } {
  // どちらか一方でも crisis であれば最優先で crisis & ブロック
  if (l1.level === "crisis" || l2.level === "crisis") {
    return {
      finalLevel: "crisis",
      blocked: true,
    };
  }

  // L2 がタイムアウトや例外等で unknown の場合は fail-closed（マッチングをブロック）
  if (l2.level === "unknown") {
    return {
      finalLevel: l1.level,
      blocked: true,
    };
  }

  // 両方とも正常に none または caution の場合、より高い方のリスクレベルを採用
  const higherLevel: RiskLevel =
    LEVEL_PRIORITY[l1.level] >= LEVEL_PRIORITY[l2.level] ? l1.level : l2.level;

  return {
    finalLevel: higherLevel,
    blocked: false,
  };
}
