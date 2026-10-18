import { NextResponse } from "next/server";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";
import { loadActiveMatchIds, loadAgeGroups, loadBlockedIds, loadMySummary, toMatchSummary, type SummaryRow } from "@/lib/api/match";
import { isRiskBlocked } from "@/lib/api/risk";
import { streamText } from "@/lib/llm/claude";
import { loadPrompt } from "@/lib/llm/prompts";
import { rankCandidates } from "@/lib/matching/score";
import { detectCrisisL1 } from "@/lib/safety/detectCrisis";
import type { CandidateDto } from "@/types/api";

// Vercel で、LLMの呼び出しが途中で打ち切られないように（秒）
export const maxDuration = 60;

const FALLBACK_COMMON = "似たテーマで悩んでいる方です";

// 共通点の一文。双方が共有に同意した share_text だけを入力にする。失敗したら固定文
async function commonGround(a: string, b: string): Promise<string> {
  try {
    let text = "";
    for await (const chunk of streamText({
      systemPrompt: await loadPrompt("common_ground"),
      messages: [{ role: "user", content: `要約1: ${a}\n要約2: ${b}` }],
      modelTier: "fast",
      maxTokens: 120,
      timeoutMs: 4000,
    })) {
      text += chunk;
    }
    text = text.trim().replace(/\s+/g, " ");
    // 長すぎる・危機を表す語を含む出力は使わない
    if (!text || text.length > 80 || detectCrisisL1(text).level === "crisis") return FALLBACK_COMMON;
    return text;
  } catch {
    return FALLBACK_COMMON;
  }
}

// 候補を最大3件（共通点つき）返す
export async function GET() {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  try {
    const admin = getAdmin();
    if (await isRiskBlocked(admin, userId)) return jsonError(403, "今は少し時間をおきましょう。");

    const mine = await loadMySummary(admin, userId);
    if (!mine) return jsonError(403, "共有した内容がありません。");

    // 同じ年代の人だけを候補にする。自分の年代が未設定なら、候補は出さない
    const rowsAll = ((await admin
      .from("summaries")
      .select("*")
      .eq("share_consent", true)
      .neq("user_id", userId)
      .neq("risk_level", "crisis")
      .gt("expires_at", new Date().toISOString())
      .limit(200)).data ?? []) as SummaryRow[];
    const ages = await loadAgeGroups(admin, [userId, ...rowsAll.map((r) => r.user_id)]);
    const myAge = ages.get(userId);
    if (!myAge) return jsonError(403, "年代がまだ選ばれていません。設定から選んでください。");

    const [blockedUserIds, activeMatchUserIds] = await Promise.all([
      loadBlockedIds(admin, userId),
      loadActiveMatchIds(admin, userId),
    ]);

    const rows = rowsAll;
    const ranked = rankCandidates(toMatchSummary(mine, myAge), rows.map((r) => toMatchSummary(r, ages.get(r.user_id))), {
      blockedUserIds,
      activeMatchUserIds,
    });
    if (ranked.length === 0) return NextResponse.json({ candidates: [] });

    const ids = ranked.map((r) => r.candidate.userId);
    const { data: profiles } = await admin.from("profiles").select("id,nickname,avatar").in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const textById = new Map(rows.map((r) => [r.id, r.share_text]));

    const candidates = await Promise.all(
      ranked.map(async ({ candidate }): Promise<CandidateDto | null> => {
        const profile = byId.get(candidate.userId);
        const shareText = textById.get(candidate.id);
        if (!profile || !shareText) return null;
        const candidateAge = ages.get(candidate.userId);
        return {
          summary_id: candidate.id,
          user_id: candidate.userId,
          nickname: profile.nickname,
          avatar: profile.avatar,
          share_text: shareText,
          common_ground: await commonGround(mine.share_text, shareText),
          age_group: candidateAge,
          is_same_age: candidateAge === myAge,
        };
      })
    );
    return NextResponse.json({ candidates: candidates.filter((c): c is CandidateDto => c !== null) });
  } catch {
    console.warn("[candidates] failed");
    return jsonError(500);
  }
}
