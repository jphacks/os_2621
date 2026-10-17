import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const FRIENDLY_ERROR = "うまく処理できませんでした。少し時間をおいて、もう一度ためしてください。";

export function jsonError(status: number, message = FRIENDLY_ERROR) {
  return NextResponse.json({ error: message }, { status });
}

/** ログイン中のユーザーID（Cookieのセッションから）。未ログインなら null */
export async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/** service role のクライアント（RLSを無視する。サーバー専用） */
export function getAdmin() {
  return createAdminClient();
}

export type AdminClient = ReturnType<typeof getAdmin>;
