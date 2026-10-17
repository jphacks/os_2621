// フロントから呼ぶAPIの入出力型と fetch 補助（Cさん担当）。
// ここの型は SPEC.md §9 を元にした「想定」。Aさんの types/ が出来たら、そちらに差し替える。

export type SummaryDraft = {
  share_text: string;
  category: string;
  tags: string[];
  energy_estimate: number;
  stage_estimate: string;
};

export type Candidate = {
  summary_id: string;
  user_id: string;
  nickname: string;
  avatar: string;
  share_text: string;
  common_ground?: string;
};

export type ReceivedRequest = {
  id: string;
  from_nickname: string;
  from_avatar: string;
  share_text: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at: string;
};

export type SentRequest = {
  id: string;
  to_nickname: string;
  to_avatar: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at: string;
  room_id?: string | null;
};

export type RequestsResponse = { received: ReceivedRequest[]; sent: SentRequest[] };

export class ApiError extends Error {
  constructor(
    public status: number,
    /** サーバーが返した、利用者向けのやさしい文（なければ空） */
    public userMessage = ""
  ) {
    super(`api error ${status}`);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new ApiError(res.status, typeof body?.error === "string" ? body.error : "");
  }
  return (await res.json()) as T;
}
