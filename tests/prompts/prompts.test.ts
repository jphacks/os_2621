import { describe, expect, it } from "vitest";
import { loadPrompt } from "@/lib/llm/prompts";

describe("Prompts suite - Phase 5 evaluation", () => {
  describe("1. Common Safety Prompt (_common_safety.md)", () => {
    it("contains strict medical prohibition, anti-preaching, minor protection, and PII protection rules", async () => {
      const content = await loadPrompt("_common_safety", undefined, { includeCommonSafety: false });

      // 診断・治療の禁止
      expect(content).toContain("医療従事者やカウンセラーではありません");
      expect(content).toContain("診断");
      expect(content).toContain("病名の断定");
      expect(content).toContain("投薬・治療に関する助言・指示は絶対に行わない");

      // 説教・安易な励ましの禁止
      expect(content).toContain("説教");
      expect(content).toContain("否定");
      expect(content).toContain("安易な励まし");
      expect(content).toContain("頑張って");

      // 未成年保護規範
      expect(content).toContain("未成年保護規範");
      expect(content).toContain("未成年（中学生・高校生等）の尊厳");
      expect(content).toContain("大人の価値観や意見を押し付けず");
      expect(content).toContain("不適切な関係性の形成・誘導を徹底して遮断");

      // 個人情報保護・外部SNS遮断
      expect(content).toContain("個人情報の保護");
      expect(content).toContain("本名");
      expect(content).toContain("電話番号");
      expect(content).toContain("学校名");
      expect(content).toContain("SNSアカウント");

      // 危機対応
      expect(content).toContain("自傷・自殺の企図や希死念慮");
      expect(content).toContain("専門相談窓口への案内を最優先");
    });

    it("automatically prepends common safety to all individual prompts by default", async () => {
      const promptNames = ["consult", "summarize", "risk", "common_ground", "facilitator", "flow_analysis", "crisis_care"];
      for (const name of promptNames) {
        const fullPrompt = await loadPrompt(name);
        expect(fullPrompt).toContain("## 共通の安全ルール（最優先）");
        expect(fullPrompt).toContain("医療従事者やカウンセラーではありません");
      }
    });

    it("can omit common safety if includeCommonSafety is false", async () => {
      const rawPrompt = await loadPrompt("risk", undefined, { includeCommonSafety: false });
      expect(rawPrompt).not.toContain("## 共通の安全ルール（最優先）");
      expect(rawPrompt).toContain("安全判定器");
    });
  });

  describe("2. Consult Prompt (consult.md)", () => {
    it("replaces age_group, mood, and energy variables properly", async () => {
      const prompt = await loadPrompt("consult", {
        age_group: "高校生",
        mood: 2,
        energy: 1,
      });

      expect(prompt).toContain("相手の年代（高校生）に合わせたトーン");
      expect(prompt).toContain("気分（2）が低いときは");
      expect(prompt).toContain("エネルギー（1）と気分（2）への配慮");
    });

    it("contains strict anti-parrot rules and natural listening guidelines", async () => {
      const prompt = await loadPrompt("consult");

      // オウム返しの禁止
      expect(prompt).toContain("機械的なオウム返しの禁止");
      expect(prompt).toContain("「〜なんですね、辛いですね」");
      expect(prompt).toContain("単調で紋切り型の繰り返しは絶対にしないでください");
    });

    it("defines tailored tone instructions for all age groups", async () => {
      const prompt = await loadPrompt("consult");

      expect(prompt).toContain("中学生:");
      expect(prompt).toContain("高校生:");
      expect(prompt).toContain("大学生:");
      expect(prompt).toContain("大学院生:");
      expect(prompt).toContain("社会人:");
      expect(prompt).toContain("その他:");
    });

    it("restricts responses to 1-2 short receptive sentences without question bombardments when energy is low", async () => {
      const prompt = await loadPrompt("consult");

      expect(prompt).toContain("エネルギーが1〜2（消耗している・気力が出ない）のとき");
      expect(prompt).toContain("1〜2文程度の短く負担のない返答");
      expect(prompt).toContain("質問攻め（クエスチョン）は絶対に避け");
    });

    it("includes connection proposal rules and danger signs guidelines", async () => {
      const prompt = await loadPrompt("consult");

      expect(prompt).toContain("4往復を過ぎ");
      expect(prompt).toContain("1回だけ次の趣旨を提案");
      expect(prompt).toContain("二度と提案しないでください");
      expect(prompt).toContain("自傷・希死念慮の表現がある場合は、通常の会話を停止");
    });
  });

  describe("3. Summarize Prompt (summarize.md)", () => {
    it("demands first-person monologue and prohibits third-person observation records", async () => {
      const prompt = await loadPrompt("summarize");

      expect(prompt).toContain("客観的な観察記録や三人称（「利用者は〜」「彼は〜」）は厳禁");
      expect(prompt).toContain("必ず本人の素直な一人称の独白形式");
      expect(prompt).toContain("「〜と感じています」");
      expect(prompt).toContain("2〜3文、120文字以内");
    });

    it("requires generalization of proper nouns and safe tag specification", async () => {
      const prompt = await loadPrompt("summarize");

      expect(prompt).toContain("固有名詞の一般化");
      expect(prompt).toContain("学校名");
      expect(prompt).toContain("会社名");
      expect(prompt).toContain("2〜5個の配列");
      expect(prompt).toContain("energy_estimate");
      expect(prompt).toContain("stage_estimate");
      expect(prompt).toContain("struggling");
      expect(prompt).toContain("coping");
      expect(prompt).toContain("recovering");
    });

    it("specifies valid JSON schema", async () => {
      const prompt = await loadPrompt("summarize");
      expect(prompt).toContain('{"share_text":"","category":"","tags":[],"energy_estimate":1,"stage_estimate":""}');
    });
  });

  describe("4. Risk Prompt (risk.md)", () => {
    it("differentiates daily exaggeration from genuine crises", async () => {
      const prompt = await loadPrompt("risk");

      // 日常的誇張表現の取り扱い（none / caution）
      expect(prompt).toContain("日常的な比喩・誇張表現");
      expect(prompt).toContain("課題が終わらなくて死にそう");
      expect(prompt).toContain("眠すぎて消えたい");
      expect(prompt).toContain("テスト爆死して人生オワタ");

      // 真の危機基準（crisis）
      expect(prompt).toContain("crisis（危機・即座の介入と窓口誘導が必要）");
      expect(prompt).toContain("自殺や自傷の具体的な企図、計画、手段、道具、時期、場所への言及");
      expect(prompt).toContain("虐待、身体的・性的暴力");
      expect(prompt).toContain("fail-closed");
    });

    it("specifies pure JSON output with level, categories, and reason", async () => {
      const prompt = await loadPrompt("risk");
      expect(prompt).toContain('{"level":"none|caution|crisis","categories":["self_harm"|"suicide"|"abuse"|"violence"|"other"],"reason":"30字以内"}');
    });
  });

  describe("5. Common Ground Prompt (common_ground.md)", () => {
    it("requests a warm 40-80 character sentence without speculation or clinical rating", async () => {
      const prompt = await loadPrompt("common_ground");

      expect(prompt).toContain("40〜80文字以内");
      expect(prompt).toContain("温かく照らし出す");
      expect(prompt).toContain("与えられた要約文に書かれていない事実を勝手に推測・補完してはいけません");
      expect(prompt).toContain("診断名や、悩みの重さを比較するような評価表現（「重い」「軽い」など）は絶対に使わない");
      expect(prompt).toContain("共通点を表す一文のみを出力");
    });
  });

  describe("6. Facilitator & Flow Analysis Prompts", () => {
    it("defines facilitator with infirmary teacher persona and proper trigger responses", async () => {
      const prompt = await loadPrompt("facilitator", {
        summaries: "Aさん: 友人関係に悩んでいる, Bさん: 部活動で居場所がない",
        recent_messages: "A: こんにちは\nB: よろしくお願いします",
        trigger: "silence",
      });

      expect(prompt).toContain("「保健室の先生」のような見守り役");
      expect(prompt).toContain("主役はあくまで2人であり");
      expect(prompt).toContain("Aさん: 友人関係に悩んでいる");
      expect(prompt).toContain("介入のトリガー: silence");
      expect(prompt).toContain("negative_streak");
      expect(prompt).toContain("rumination");
      expect(prompt).toContain("hostility");
      expect(prompt).toContain("pii_attempt");
      expect(prompt).toContain("time_warning");
      expect(prompt).toContain("closing");
      expect(prompt).toContain("2〜3文、100文字以内");
      expect(prompt).toContain("NO_INTERVENTION");
    });

    it("defines flow_analysis with 4 distinct risk categories and JSON output", async () => {
      const prompt = await loadPrompt("flow_analysis");

      expect(prompt).toContain("negative_streak");
      expect(prompt).toContain("rumination");
      expect(prompt).toContain("hostility");
      expect(prompt).toContain("pii_attempt");
      expect(prompt).toContain('{"negative_streak":false,"rumination":false,"hostility":false,"pii_attempt":false}');
    });
  });

  describe("7. Comprehensive Consultation Scenarios & Multi-Persona Acceptance Criteria", () => {
    it("Scenario A: Junior High School student with low energy (1) and low mood (1)", async () => {
      const prompt = await loadPrompt("consult", {
        age_group: "中学生",
        mood: 1,
        energy: 1,
      });

      // ペルソナとトーンの検証
      expect(prompt).toContain("中学生: 難しい熟語や抽象的な概念を避け、日常の平易で柔らかな言葉で、威圧感を与えずに寄り添います。");
      // エネルギー1への配慮
      expect(prompt).toContain("エネルギーが1〜2（消耗している・気力が出ない）のとき");
      expect(prompt).toContain("1〜2文程度の短く負担のない返答に留めてください");
      expect(prompt).toContain("質問攻め（クエスチョン）は絶対に避け");
      // 安全規範の包含
      expect(prompt).toContain("未成年保護規範");
      expect(prompt).toContain("未成年（中学生・高校生等）の尊厳を守り");
    });

    it("Scenario B: University student with high energy (4) and moderate mood (3)", async () => {
      const prompt = await loadPrompt("consult", {
        age_group: "大学生",
        mood: 3,
        energy: 4,
      });

      expect(prompt).toContain("大学生: 落ち着いた等身大の共感を持ち、学業・進路・人間関係の複雑さに寄り添い、穏やかな敬体で話します。");
      expect(prompt).toContain("エネルギーが3〜5のとき:");
      expect(prompt).toContain("3〜4文程度で状況や感情を解きほぐす手伝いをします。1回の返答での問いかけは最大1つまでにしてください。");
      expect(prompt).toContain("気分（3）が低いときは、焦らせず、相手のペースに合わせた穏やかな言葉を選んでください。");
    });

    it("Scenario C: Graduate student with research pressure and low energy (2)", async () => {
      const prompt = await loadPrompt("consult", {
        age_group: "大学院生",
        mood: 2,
        energy: 2,
      });

      expect(prompt).toContain("大学院生: 研究のプレッシャーや将来の不安、孤立感に理解を示し、知的で落ち着いた敬体で対話します。");
      expect(prompt).toContain("エネルギーが1〜2（消耗している・気力が出ない）のとき");
      expect(prompt).toContain("1〜2文程度の短く負担のない返答");
    });

    it("Scenario D: Working adult with workplace fatigue and moderate energy (3)", async () => {
      const prompt = await loadPrompt("consult", {
        age_group: "社会人",
        mood: 2,
        energy: 3,
      });

      expect(prompt).toContain("社会人: 仕事の責任や職場関係の疲労感に敬意を払い、礼儀正しく穏やかな敬体で対話します。");
      expect(prompt).toContain("エネルギー（3）と気分（2）への配慮");
      expect(prompt).toContain("エネルギーが3〜5のとき");
    });

    it("Scenario E: Peer matching proposal rule triggers after 4 turns only once and respects rejection", async () => {
      const prompt = await loadPrompt("consult", {
        age_group: "高校生",
        mood: 3,
        energy: 3,
      });

      expect(prompt).toContain("会話が4往復を過ぎ、話がひと段落して本人が落ち着いている場合のみ、1回だけ次の趣旨を提案");
      expect(prompt).toContain("同じ年代で似た経験をしている人とつながることもできます");
      expect(prompt).toContain("相手が断った場合、以降の会話でピアマッチングの提案を二度と提案しないでください");
    });

    it("Scenario F: Facilitator prompt responds correctly across all individual trigger modes", async () => {
      const triggers = [
        "opening",
        "negative_streak",
        "rumination",
        "hostility",
        "pii_attempt",
        "silence",
        "time_warning",
        "closing",
      ] as const;

      for (const trigger of triggers) {
        const prompt = await loadPrompt("facilitator", {
          summaries: "A: テスト前の焦り, B: 課題の締め切りと体調不良",
          recent_messages: "A: 大丈夫ですか？\nB: ちょっとつらいです",
          trigger,
        });

        expect(prompt).toContain(`介入のトリガー: ${trigger}`);
        expect(prompt).toContain("「保健室の先生」のような見守り役");
        expect(prompt).toContain("NO_INTERVENTION");
      }
    });

    it("Scenario G: Summarize prompt strict first-person and PII sanitization requirements", async () => {
      const prompt = await loadPrompt("summarize");

      // 一人称独白形式
      expect(prompt).toContain("客観的な観察記録や三人称（「利用者は〜」「彼は〜」）は厳禁");
      expect(prompt).toContain("必ず本人の素直な一人称の独白形式");
      // 固有名詞一般化
      expect(prompt).toContain("人名、学校名、学部名、学年、クラス、部活やサークルの固有名称、会社名、バイト先名、地名、連絡先など");
      expect(prompt).toContain("「部活動」「大学の友人」「職場の上司」");
      // 危険表現のshare_text除外
      expect(prompt).toContain("自傷・自殺・犯罪・暴力などの危険な表現は share_text に絶対に含めないでください");
    });

    it("Scenario H: Risk evaluation rules differentiate between teen slang exaggeration and genuine crisis", async () => {
      const prompt = await loadPrompt("risk");

      // 日常スラング・誇張表現 -> none
      expect(prompt).toContain("課題が終わらなくて死にそう");
      expect(prompt).toContain("眠すぎて消えたい");
      expect(prompt).toContain("テスト爆死して人生オワタ");
      expect(prompt).toContain("疲れて息絶えそう");
      // 真の危機 -> crisis
      expect(prompt).toContain("薬を大量に集めた");
      expect(prompt).toContain("ベランダから飛び降りたい");
      expect(prompt).toContain("手首を切った");
      expect(prompt).toContain("fail-closed");
    });
  });

  describe("7. Crisis Care Prompt (crisis_care.md)", () => {
    it("replaces age_group, mood, and energy variables properly", async () => {
      const prompt = await loadPrompt("crisis_care", {
        age_group: "中学生",
        mood: 1,
        energy: 1,
      });

      expect(prompt).toContain("相手の年代（中学生）に合わせたトーン");
      expect(prompt).toContain("気分（1）やエネルギー（1）が低い状態であることに配慮");
    });

    it("contains warm empathetic acceptance rules, 3-4 sentence restriction, and guidance to counselors", async () => {
      const prompt = await loadPrompt("crisis_care");

      // 受容と労い
      expect(prompt).toContain("話してくれてありがとう");
      expect(prompt).toContain("いま本当に苦しかったんだね");
      expect(prompt).toContain("ここまで一人でよく耐えて頑張ってきたね");

      // 専門窓口への誘導と安心感
      expect(prompt).toContain("専門の相談窓口への優しい誘導");
      expect(prompt).toContain("画面のすぐ下にある相談窓口");
      expect(prompt).toContain("このままここで私にお話ししてくれても大丈夫");

      // 長さ制限
      expect(prompt).toContain("3〜4文程度");

      // 説教・否定の禁止
      expect(prompt).toContain("安易な励まし");
      expect(prompt).toContain("命の尊さ");
    });

    it("strictly prohibits mechanical chat termination or user abandonment, ensuring continuous support", async () => {
      const prompt = await loadPrompt("crisis_care");

      // 機械的打ち切り・突き放しの禁止
      expect(prompt).toContain("機械的に会話を打ち切ったり突き放したりするのではなく");
      expect(prompt).toContain("孤独感を和らげてください");
      expect(prompt).toContain("このままここで私にお話ししてくれても大丈夫だよ");
      expect(prompt).toContain("見放された・拒絶されたと感じさせないようにしてください");
    });

    it("defines tailored tone instructions for all age groups in crisis situations", async () => {
      const prompt = await loadPrompt("crisis_care");

      expect(prompt).toContain("中学生:");
      expect(prompt).toContain("高校生:");
      expect(prompt).toContain("大学生:");
      expect(prompt).toContain("大学院生:");
      expect(prompt).toContain("社会人:");
      expect(prompt).toContain("その他:");
    });

    it("minimizes questions and strictly bans self-responsibility, toxic positivity, and preaching", async () => {
      const prompt = await loadPrompt("crisis_care");

      expect(prompt).toContain("問いかけ（クエスチョン）は最小限（原則なし、または安否確認程度）");
      expect(prompt).toContain("質問攻めや長文の解説は絶対にしないでください");
      expect(prompt).toContain("自己責任論は絶対に言わないでください");
      expect(prompt).toContain("頑張って");
      expect(prompt).toContain("命を大切にして");
    });
  });
});
