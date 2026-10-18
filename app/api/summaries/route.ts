import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";
import { isRiskBlocked, setRiskBlock } from "@/lib/api/risk";
import { combineEnergy, isValidAgeGroup } from "@/lib/matching/score";
import { detectCrisisL1 } from "@/lib/safety/detectCrisis";
import { maskPII } from "@/lib/safety/piiMask";

const bodySchema = z.object({
  share_text: z.string().trim().min(1).max(200),
  category: z.enum(["relationships", "career", "study", "family", "loneliness", "health", "other"]),
  tags: z.array(z.string().trim().min(1).max(20)).max(6),
  energy_estimate: z.number().int().min(1).max(5),
  stage_estimate: z.enum(["struggling", "coping", "recovering"]),
  checkin: z
    .object({
      mood: z.number().int().min(1).max(5).optional(),
      energy: z.number().int().min(1).max(5).optional(),
    })
    .nullish(),
  age_group: z.string().optional(),
});

const EXPIRES_MS = 24 * 60 * 60 * 1000; // 共有した要約は24時間（SPEC §5.4）
const BLOCKED_MESSAGE = "今は、人とつながる手順には進めません。";

// 本人が確認・編集した要約を、共有に同意したものとして保存する
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "要約の内容を確認してください。");
  const body = parsed.data;

  try {
    const admin = getAdmin();

    // crisis や判定失敗のセッションからは、APIを直接叩いても保存できない
    if (await isRiskBlocked(admin, userId)) return jsonError(403, BLOCKED_MESSAGE);

    // 個人情報のマスクを再適用し、L1でも再チェックする
    const text = maskPII(body.share_text);
    const tagResults = body.tags.map((t) => maskPII(t));
    const tags = tagResults.map((t) => t.text);
    const checks = [text.text, ...tags].map((t) => detectCrisisL1(t));
    if (checks.some((c) => c.level === "crisis")) {
      await setRiskBlock(admin, userId, "crisis");
      return jsonError(403, BLOCKED_MESSAGE);
    }
    const riskLevel = checks.some((c) => c.level === "caution") ? "caution" : "none";

    // energy = (直近のチェックインまたはP4再確認の energy + AIの推定) / 2 を四捨五入（気分が高い場合の補正つき）
    const { data: checkin } = await admin
      .from("checkins")
      .select("mood, energy")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const selfEnergy = body.checkin?.energy ?? checkin?.energy ?? 3;
    const selfMood = body.checkin?.mood ?? checkin?.mood;
    const energy = combineEnergy(selfEnergy, body.energy_estimate, selfMood);

    // 年代が渡されていて、未設定の場合は profiles に保存する
    if (isValidAgeGroup(body.age_group)) {
      const { data: profile } = await admin.from("profiles").select("age_group").eq("id", userId).maybeSingle();
      if (profile && !profile.age_group) {
        const { error: ageErr } = await admin
          .from("profiles")
          .update({ age_group: body.age_group })
          .eq("id", userId);
        if (ageErr && body.age_group === "graduate") {
          await admin.from("profiles").update({ age_group: "university" }).eq("id", userId);
        }
      }
    }

    // 新しい要約を先に挿入し、既存のリクエストやルームメンバーの参照を付け替えてから古い要約を削除する
    // （DELETE を先に行うと ON DELETE SET NULL により送信済みリクエストの share_text が消えてしまうため）
    const { data, error } = await admin
      .from("summaries")
      .insert({
        user_id: userId,
        share_text: text.text,
        category: body.category,
        tags,
        energy,
        stage: body.stage_estimate,
        risk_level: riskLevel,
        share_consent: true,
        expires_at: new Date(Date.now() + EXPIRES_MS).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    await Promise.all([
      admin.from("match_requests").update({ from_summary: data.id }).eq("from_user", userId).eq("status", "pending"),
      admin.from("match_requests").update({ to_summary: data.id }).eq("to_user", userId).eq("status", "pending"),
      admin.from("room_members").update({ summary_id: data.id }).eq("user_id", userId),
    ]);
    await admin.from("summaries").delete().eq("user_id", userId).neq("id", data.id);

    const masked = text.masked || tagResults.some((t) => t.masked);
    return NextResponse.json({ id: data.id, masked });
  } catch {
    console.warn("[summaries] failed");
    return jsonError(500);
  }
}
