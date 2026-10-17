import { NextResponse } from "next/server";
import { getAdmin, getUserId, jsonError } from "@/lib/api/common";

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
