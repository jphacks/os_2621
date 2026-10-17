// ブラウザ側の一時状態（sessionStorage）。相談の会話本文はDBに保存しない（SPEC §5.2）。
// SSR中は何もしない。

import type { FlowNotice, FlowState } from "@/lib/flow/guard";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type Checkin = { mood: number; energy: number };

const KEYS = {
  profile: "hidamari.profile",
  checkin: "hidamari.checkin",
  messages: "hidamari.messages",
  flags: "hidamari.flags",
  summaryShared: "hidamari.summaryShared",
  joinedRoomIds: "hidamari.joinedRoomIds",
  notice: "hidamari.notice",
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
  getProfile: () => read<{ nickname: string; avatar: string; age_group?: string } | null>(KEYS.profile, null),
  setProfile: (p: { nickname: string; avatar: string; age_group?: string }) => write(KEYS.profile, p),

  getCheckin: () => read<Checkin | null>(KEYS.checkin, null),
  setCheckin: (c: Checkin) => write(KEYS.checkin, c),

  getMessages: () => read<ChatMessage[]>(KEYS.messages, []),
  setMessages: (m: ChatMessage[]) => write(KEYS.messages, m),

  getFlags: () => read<SessionFlags>(KEYS.flags, { crisis: false, matchingBlocked: false }),
  setFlags: (f: SessionFlags) => write(KEYS.flags, f),

  getSummaryShared: () => read<boolean>(KEYS.summaryShared, false),
  setSummaryShared: (s: boolean) => write(KEYS.summaryShared, s),

  getJoinedRoomIds: () => read<string[]>(KEYS.joinedRoomIds, []),
  addJoinedRoomId(id: string) {
    if (!id || typeof id !== "string") return;
    const current = read<string[]>(KEYS.joinedRoomIds, []);
    if (!current.includes(id)) {
      write(KEYS.joinedRoomIds, [...current, id]);
    }
  },

  getNotice: () => read<FlowNotice | null>(KEYS.notice, null),
  setNotice(n: FlowNotice | null) {
    if (typeof window === "undefined") return;
    try {
      if (n === null) {
        window.sessionStorage.removeItem(KEYS.notice);
      } else {
        write(KEYS.notice, n);
      }
      window.dispatchEvent(new CustomEvent("hidamari:notice", { detail: n }));
    } catch {
      // noop
    }
  },
  consumeNotice(): FlowNotice | null {
    const n = this.getNotice();
    if (n) {
      this.setNotice(null);
    }
    return n;
  },

  clearConsult() {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(KEYS.messages);
      window.sessionStorage.removeItem(KEYS.flags);
      window.sessionStorage.removeItem(KEYS.summaryShared);
    } catch {
      // noop
    }
  },

  clearAll() {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.clear();
    } catch {
      // noop
    }
  },

  getFlowState(): FlowState {
    const profile = this.getProfile();
    const checkin = this.getCheckin();
    const messages = this.getMessages();
    const flags = this.getFlags();
    const summaryShared = this.getSummaryShared();
    const joinedRoomIds = this.getJoinedRoomIds();

    return {
      hasProfile: Boolean(profile?.nickname && profile.nickname.trim().length > 0),
      hasCheckin: Boolean(checkin),
      hasMessages: messages.some((m) => m.role === "user" && m.content.trim().length > 0),
      summaryShared: Boolean(summaryShared),
      isCrisis: Boolean(flags.crisis),
      isMatchingBlocked: Boolean(flags.matchingBlocked),
      joinedRoomIds: Array.isArray(joinedRoomIds) ? joinedRoomIds : [],
    };
  },
};
