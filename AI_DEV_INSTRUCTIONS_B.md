# Bさん（安全ロジック・マッチング・プロンプト・テスト）開発指示書

このドキュメントは、3人チーム分担における **「Bさん（安全ロジック・マッチング・プロンプト・テスト担当）」** が、Aさん（バックエンド/DB/API/型）・Cさん（フロントエンド/画面/文言）と **ファイル衝突（コンフリクト）を100%起こさずに開発を進めるためのAI指示書** です。

---

## 1. Bさんの担当境界（スコープ）

### 編集可能（Bさん専任）
- `lib/safety/` （危機検知辞書・判定、個人情報マスク、窓口一覧）
- `lib/matching/` （マッチングスコア計算、共倒れ防止除外フィルタ）
- `lib/facilitator/` （ファシリテーター介入判定ロジック、設定定数）
- `prompts/` （システムプロンプト Markdown群）
- `tests/` （単体テストコード）

### 編集禁止（Aさん・Cさんの担当）
- `app/` （API Route Handlers、画面 P0〜P9）※Aさん/Cさん担当
- `components/` （UIコンポーネント）※Cさん担当
- `lib/supabase/`、`supabase/` （DB接続、マイグレーション、RLS）※Aさん担当
- `lib/llm/` （Claude API連携クライアント）※Aさん担当
- `types/` （共通型定義）※Aさん担当
- `package.json`、`package-lock.json`、各種設定ファイル ※Aさん担当
- `docs/`、`PROJECT.md`、`SPEC.md` ※Cさん担当

> [!IMPORTANT]
> **型定義（`types/`）が必要な場合**: 自分で `types/` を直接編集・作成せず、下記「2. 共通型・関数インターフェース契約」のシグネチャ案をAさんに共有し、Aさんに作成してもらいます。Aさんの作成前は、Bさんコード内で同等のローカル型またはインライン型で先行実装可能です。

---

## 2. 共通型・関数インターフェース契約（Contract）

AさんのAPIルートやCさんの画面が、Bさんのロジックを直接呼び出します。以下のインターフェースで合意します。

### Aさんに作成してもらう型定義（`types/`）の想定案
```ts
// types/safety.ts
export type RiskLevel = "none" | "caution" | "crisis";
export type RiskCategory = "self_harm" | "suicide" | "abuse" | "violence" | "other";

export interface RiskResult {
  level: RiskLevel;
  categories: RiskCategory[];
  matchedKeywords?: string[];
}

export type L2RiskResult = 
  | (RiskResult & { reason: string })
  | { level: "unknown"; reason?: string };

// types/matching.ts
export type Category = 
  | "relationships" | "career" | "study" | "family" 
  | "loneliness" | "health" | "other";

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
```

### Bさんが提供する関数・定数一覧
| ファイル | 提供する関数・定数 | 役割・仕様 |
| :--- | :--- | :--- |
| `lib/safety/hotlines.ts` | `HOTLINES` | 厚労省等の公的窓口リスト（名称、電話番号、受付時間、備考） |
| `lib/safety/crisisKeywords.ts` | `CRISIS_KEYWORDS`, `CRISIS_PATTERNS` | L1危機検知用キーワード・正規表現辞書 |
| `lib/safety/detectCrisis.ts` | `detectCrisisL1(text: string): RiskResult`<br>`mergeRiskResults(l1: RiskResult, l2: L2RiskResult): { finalLevel: RiskLevel; blocked: boolean }` | L1同期判定、L1とL2の二重判定統合（fail-closed: L2がunknownならblocked） |
| `lib/safety/piiMask.ts` | `maskPII(text: string): { text: string; masked: boolean }` | 電話番号・メアド・URL・SNS ID(@/LINE/インスタ/X)の `***` マスク |
| `lib/matching/score.ts` | `combineEnergy(self: number, estimated: number): number`<br>`calculateJaccard(tagsA: string[], tagsB: string[]): number`<br>`calculateStageBonus(stageA: Stage, stageB: Stage): number`<br>`calculateMatchScore(a: MatchSummary, b: MatchSummary): number`<br>`isEligibleCandidate(me: MatchSummary, candidate: MatchSummary, options?: { blockedUserIds?: string[]; activeMatchUserIds?: string[] }): boolean`<br>`rankCandidates(me: MatchSummary, candidates: MatchSummary[], options?: ...): { candidate: MatchSummary; score: number }[]` | SPEC.md §6.1, §6.2に準拠した純粋関数（スコア計算、共倒れ防止除外、ブロック除外等） |
| `lib/facilitator/config.ts` | `FACILITATOR_CONFIG` | 介入間隔（2分）、ルーム上限（30分）、予告（25分）、沈黙判定等の定数設定 |
| `lib/facilitator/decide.ts` | `decideIntervention(input: FacilitatorInput): FacilitatorAction` | 否定連続、反芻、攻撃性（2回で終了）、PII、時間経過の介入判定純粋関数 |

---

## 3. Phase別 AI指示プロンプト集

AIに各フェーズの開発を指示する際は、以下のプロンプトをそのままコピーして渡してください。

---

### 【Phase 1】プロンプト集と窓口一覧の作成

```markdown
AI_DEV_INSTRUCTIONS_B.md の【Phase 1】を実装してください。
あなたはBさん担当です。コンフリクトを防ぐため、以下のファイルのみを作成・編集してください。

【作成するファイル】
1. prompts/_common_safety.md
2. prompts/consult.md
3. prompts/risk.md
4. prompts/summarize.md
5. prompts/common_ground.md
6. prompts/facilitator.md
7. prompts/flow_analysis.md
8. lib/safety/hotlines.ts

【要件】
- プロンプト内容は SPEC.md §10 および AI_DEV_INSTRUCTIONS.md Part C の定義に従う。
- lib/safety/hotlines.ts には PROJECT.md / SPEC.md §5.3 の窓口（110/119, よりそいホットライン 0120-279-338, #いのちSOS 0120-061-338, いのちの電話 0570-783-556）を定義し、「公開前に公式サイトで確認すること」の注意コメントを記載する。
- 外部パッケージの追加や、app/, lib/llm/, types/ 等の他担当ファイルの編集は行わない。
- 既存の tests/phase0.test.ts（loadPrompt のテスト）がパスすることを確認する。
```

---

### 【Phase 2】L1危機検知辞書・判定関数と単体テスト

```markdown
AI_DEV_INSTRUCTIONS_B.md の【Phase 2】を実装してください。
あなたはBさん担当です。app/api/chat や P2, P3 画面には触れず、安全判定の純粋関数とテストのみを作成してください。

【作成するファイル】
1. lib/safety/crisisKeywords.ts
2. lib/safety/detectCrisis.ts
3. tests/safety/detectCrisis.test.ts

【要件】
- crisisKeywords.ts: 自傷・自殺・虐待・暴力を表す直接的・遠回しな表現辞書（ひらがな/カタカナ、全角半角正規化対応）。
- detectCrisis.ts:
  - detectCrisisL1(text: string): RiskResult (level: "none" | "caution" | "crisis", categories)
  - mergeRiskResults(l1: RiskResult, l2: L2RiskResult): { finalLevel: RiskLevel; blocked: boolean }
    ※fail-closed設計: l2が unknown の場合は blocked: true に倒す。
- tests/safety/detectCrisis.test.ts:
  - 危機表現（遠回し・ひらがな・絵文字混じり）20件以上がすべて crisis と判定されること。
  - 通常の悩み（友人関係、進路、勉強等）10件以上が none / caution であり誤検知しないこと。
  - mergeRiskResults の fail-closed 挙動テスト。
- vitest（npm test）を実行してすべてパスすることを確認する。
```

---

### 【Phase 3】個人情報マスク（PII Mask）と単体テスト

```markdown
AI_DEV_INSTRUCTIONS_B.md の【Phase 3】を実装してください。
あなたはBさん担当です。app/ 側の要約画面やAPIは編集せず、マスク純粋関数とテストを作成してください。

【作成するファイル】
1. lib/safety/piiMask.ts
2. tests/safety/piiMask.test.ts

【要件】
- maskPII(text: string): { text: string; masked: boolean }
- マスク対象（SPEC.md §5.7）:
  - 電話番号（固定・携帯・ハイフン有無）
  - メールアドレス
  - Web URL (http/https/短縮URL)
  - @ハンドル（SNSアカウント）
  - 「LINE」「インスタ」「X」「Twitter」「カカオ」などのID交換を促す表現・ID文字列
- マスク箇所は「***」に置換し、検知された場合は masked: true を返す。
- tests/safety/piiMask.test.ts で各種パターンのテストを行い、npm test をパスさせる。
```

---

### 【Phase 4】マッチングスコア計算・共倒れ防止除外フィルタと単体テスト

```markdown
AI_DEV_INSTRUCTIONS_B.md の【Phase 4】を実装してください。
あなたはBさん担当です。/api/match や画面 P5, P6 は触れず、マッチング計算の純粋関数とテストを作成してください。

【作成するファイル】
1. lib/matching/score.ts
2. tests/matching/score.test.ts

【要件】
- SPEC.md §6 の計算式・条件を忠実に純粋関数化:
  1. combineEnergy(self: number, estimated: number): round((self + estimated) / 2)
  2. calculateJaccard(tagsA: string[], tagsB: string[]): 和集合と積集合の比率 (0〜1)
  3. calculateStageBonus(stageA, stageB): 片方recovering & もう片方struggling/coping → 1.0, 同じstage → 0.6, それ以外 → 0.3
  4. calculateMatchScore(a, b): 0.5 * (category一致 ? 1 : 0) + 0.3 * Jaccard + 0.2 * stageBonus
  5. isEligibleCandidate:
     - shareConsent === true かつ 有効期限内
     - riskLevel !== "crisis"
     - 自身ではない、ブロックされていない、進行中の相手ではない
     - 【共倒れ防止】両者のエネルギーが共に2以下の場合は除外（falseを返す）
  6. rankCandidates: 条件を満たす候補をスコア降順でソートし、score >= 0.3 の上位3件を返す。
- tests/matching/score.test.ts で「共倒れ防止除外」「スコア0.3未満除外」「同カテゴリ優先」などの単体テストを網羅し、npm test をパスさせる。
```

---

### 【Phase 6】AIファシリテーター介入判定ロジックと設定

```markdown
AI_DEV_INSTRUCTIONS_B.md の【Phase 6】を実装してください。
あなたはBさん担当です。リアルタイム通信やRoute Handlerは触れず、介入判定の純粋関数・設定定数・テストを作成してください。

【作成するファイル】
1. lib/facilitator/config.ts
2. lib/facilitator/decide.ts
3. tests/facilitator/decide.test.ts

【要件】
- lib/facilitator/config.ts:
  - ANALYZE_EVERY_N = 3 (分析間隔)
  - MIN_INTERVENTION_INTERVAL_MS = 120_000 (最短介入間隔: 2分)
  - ROOM_LIMIT_MIN = 30 (制限時間: 30分)
  - TIME_WARNING_MIN = 25 (終了予告: 25分)
  - SILENCE_THRESHOLD_MS = 180_000 (沈黙判定: 3分)
- lib/facilitator/decide.ts:
  - SPEC.md §5.6 の介入条件表に基づき、トリガー（opening / negative_streak / hostility / pii_attempt / silence / time_warning / closing）を判定する純粋関数。
  - hostility が2回連続した場合はルーム終了（closeRoom: true）フラグを返す。
  - 前回の介入からの経過時間が MIN_INTERVENTION_INTERVAL_MS 未満の場合は介入を抑制する（ただし終了予告・時間切れ・重大な安全違反は除く）。
- tests/facilitator/decide.test.ts で介入条件を網羅するテストを書き、npm test をパスさせる。
```

---

## 4. Git運用・コンフリクト防止チェックリスト

Bさんが作業するときは、以下の手順を徹底してください。

1. **作業ブランチの分離**:
   - `main` ブランチで直接開発せず、`feature/b-safety-logic` などの専用ブランチを作成して作業する。
2. **Git差分のセルフチェック**:
   - コミット前に `git status` を実行し、`lib/safety/`, `lib/matching/`, `lib/facilitator/`, `prompts/`, `tests/` **以外のファイルが含まれていないこと** を確認する。
3. **テスト実行**:
   - コミット前に必ず `npm test` を実行し、全テストがグリーン（パス）であることを確認する。
4. **Pull Requestの作成**:
   - PRのタイトルと概要に、作成した関数・定数と、Aさん（API実装者）が利用するためのサンプルコードを記載する。

