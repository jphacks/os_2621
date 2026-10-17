// ブラウザ側の一時状態（sessionStorage）。相談の会話本文はDBに保存しない（SPEC §5.2）。
// SSR中は何もしない。

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type Checkin = { mood: number; energy: number };

const KEYS = {
  profile: "hidamari.profile",
  checkin: "hidamari.checkin",
  messages: "hidamari.messages",
  flags: "hidamari.flags",
} as const;

export type SessionFlags = {
  crisis: boolean; // crisis と判定された（要約・マッチングに進めない）
  matchingBlocked: boolean; // L2失敗などで止める（fail-closed）
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 容量超過などは無視（状態が残らないだけ）
  }
}

export const sessionStore = {
  getProfile: () => read<{ nickname: string; avatar: string } | null>(KEYS.profile, null),
  setProfile: (p: { nickname: string; avatar: string }) => write(KEYS.profile, p),

  getCheckin: () => read<Checkin | null>(KEYS.checkin, null),
  setCheckin: (c: Checkin) => write(KEYS.checkin, c),

  getMessages: () => read<ChatMessage[]>(KEYS.messages, []),
  setMessages: (m: ChatMessage[]) => write(KEYS.messages, m),

  getFlags: () => read<SessionFlags>(KEYS.flags, { crisis: false, matchingBlocked: false }),
  setFlags: (f: SessionFlags) => write(KEYS.flags, f),

  clearConsult() {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(KEYS.messages);
      window.sessionStorage.removeItem(KEYS.flags);
    } catch {
      // noop
    }
  },
};
