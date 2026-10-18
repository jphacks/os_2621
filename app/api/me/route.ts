import { NextResponse } from "next/server";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";
import { loadMySummary } from "@/lib/api/match";

// サーバー上の進行状態を取得する（別タブ・リロード・再チェックイン時の FlowGuard 復元用）
export async function GET() {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  try {
    const admin = getAdmin();
    const [
      { data: profile },
      { data: checkin },
      summary,
      { data: members },
      { data: risk },
      { data: pendingReceived },
    ] = await Promise.all([
      admin.from("profiles").select("nickname,avatar,age_group").eq("id", userId).maybeSingle(),
      admin
        .from("checkins")
        .select("mood,energy")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadMySummary(admin, userId),
      admin.from("room_members").select("room_id,left_at").eq("user_id", userId),
      admin.from("session_risk").select("level,blocked_until").eq("user_id", userId).maybeSingle(),
      admin
        .from("match_requests")
        .select("id")
        .eq("to_user", userId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString()),
    ]);

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const riskActive = !!risk && new Date(risk.blocked_until).getTime() > nowMs;
    const isCrisis = riskActive && risk.level === "crisis";
    const isMatchingBlocked = riskActive;

    const joinedRoomIds = (members ?? []).map((m) => m.room_id);
    const leftMap = new Map((members ?? []).map((m) => [m.room_id, Boolean(m.left_at)]));

    let activeRoomId: string | null = null;
    let rooms: {
      id: string;
      status: "active" | "ended";
      started_at: string;
      ends_at: string;
      partner_nickname: string;
      partner_avatar: string;
      left: boolean;
    }[] = [];

    if (joinedRoomIds.length > 0) {
      // 期限切れのまま active で残っているルームは自動終了させる
      await admin
        .from("rooms")
        .update({ status: "ended", end_reason: "timeout" })
        .in("id", joinedRoomIds)
        .eq("status", "active")
        .lte("ends_at", nowIso);

      const [{ data: roomRows }, { data: allMembers }] = await Promise.all([
        admin
          .from("rooms")
          .select("id,status,started_at,ends_at")
          .in("id", joinedRoomIds)
          .order("started_at", { ascending: false }),
        admin.from("room_members").select("room_id,user_id").in("room_id", joinedRoomIds),
      ]);

      const partnerIds = [
        ...new Set((allMembers ?? []).filter((m) => m.user_id !== userId).map((m) => m.user_id)),
      ];
      const { data: partnerProfiles } = partnerIds.length
        ? await admin.from("profiles").select("id,nickname,avatar").in("id", partnerIds)
        : { data: [] as { id: string; nickname: string; avatar: string }[] };
      const profileById = new Map((partnerProfiles ?? []).map((p) => [p.id, p]));
      const partnerByRoom = new Map<string, { nickname: string; avatar: string }>();
      (allMembers ?? []).forEach((m) => {
        if (m.user_id !== userId) {
          const p = profileById.get(m.user_id);
          if (p) partnerByRoom.set(m.room_id, { nickname: p.nickname, avatar: p.avatar });
        }
      });

      rooms = (roomRows ?? []).map((r) => {
        const partner = partnerByRoom.get(r.id);
        const left = leftMap.get(r.id) ?? false;
        const isStillActive =
          r.status === "active" && !left && new Date(r.ends_at).getTime() > nowMs;
        if (isStillActive && !activeRoomId && !isCrisis && !isMatchingBlocked) {
          activeRoomId = r.id;
        }
        return {
          id: r.id,
          status: (isStillActive ? "active" : "ended") as "active" | "ended",
          started_at: r.started_at,
          ends_at: r.ends_at,
          partner_nickname: partner?.nickname ?? "お相手",
          partner_avatar: partner?.avatar ?? "sun",
          left,
        };
      });
    }

    return NextResponse.json({
      profile: profile ?? null,
      checkin: checkin ?? null,
      summaryShared: Boolean(summary),
      summaryText: summary?.share_text ?? null,
      joinedRoomIds,
      activeRoomId,
      rooms,
      pendingReceivedCount: (pendingReceived ?? []).length,
      isCrisis,
      isMatchingBlocked,
    });
  } catch {
    return jsonError(500);
  }
}

// 全データ削除（SPEC §5.9）。blocks と reports は、安全のため残す。
export async function DELETE() {
  const userId = await getUserId();
  if (!userId) return jsonError(401);

  try {
    const admin = getAdmin();

    // 進行中のルームは終了させ、本人のメッセージを消す
    const { data: mine } = await admin.from("room_members").select("room_id").eq("user_id", userId);
    const roomIds = (mine ?? []).map((m) => m.room_id);
    if (roomIds.length > 0) {
      await admin.from("rooms").update({ status: "ended", end_reason: "left" }).in("id", roomIds).eq("status", "active");
    }
    await admin.from("room_messages").delete().eq("sender_id", userId);

    // 要約・リクエスト・チェックイン・プロフィール（profiles の削除で関連行も消える）
    await admin.from("match_requests").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`);
    await admin.from("summaries").delete().eq("user_id", userId);
    await admin.from("checkins").delete().eq("user_id", userId);
    await admin.from("session_risk").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    // 匿名ユーザー自体も削除（Cookieは、画面側のサインアウトで消える）
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch {
    console.warn("[me] delete failed");
    return jsonError(500);
  }
}
