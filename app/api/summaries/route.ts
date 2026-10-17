import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";
import { isRiskBlocked, setRiskBlock } from "@/lib/api/risk";
import { combineEnergy } from "@/lib/matching/score";
import { detectCrisisL1 } from "@/lib/safety/detectCrisis";
import { maskPII } from "@/lib/safety/piiMask";

const bodySchema = z.object({
  share_text: z.string().trim().min(1).max(200),
  category: z.enum(["relationships", "career", "study", "family", "loneliness", "health", "other"]),
  tags: z.array(z.string().trim().min(1).max(20)).max(6),
  energy_estimate: z.number().int().min(1).max(5),
  stage_estimate: z.enum(["struggling", "coping", "recovering"]),
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
    const tags = body.tags.map((t) => maskPII(t).text);
    if ([text.text, ...tags].some((t) => detectCrisisL1(t).level === "crisis")) {
      await setRiskBlock(admin, userId, "crisis");
      return jsonError(403, BLOCKED_MESSAGE);
    }

    // energy = (直近のチェックインの energy + AIの推定) / 2 を四捨五入（なければ3）
    const { data: checkin } = await admin
      .from("checkins")
      .select("energy")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const energy = combineEnergy(checkin?.energy ?? 3, body.energy_estimate);

    // 共有している要約は最新の1件だけにする
    await admin.from("summaries").delete().eq("user_id", userId);
    const { data, error } = await admin
      .from("summaries")
      .insert({
        user_id: userId,
        share_text: text.text,
        category: body.category,
        tags,
        energy,
        stage: body.stage_estimate,
        risk_level: "none",
        share_consent: true,
        expires_at: new Date(Date.now() + EXPIRES_MS).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({ id: data.id, masked: text.masked });
  } catch {
    console.warn("[summaries] failed");
    return jsonError(500);
  }
}
