// ブラウザ側の状態（localStorage ＋ sessionStorage フォールバック）。
// 相談の会話本文はDBに保存せず（SPEC §5.2）、タブを閉じたり別タブを開いたりしてもブラウザ内で会話を引き継げるようにする。
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
  activeRoomId: "hidamari.activeRoomId",
  notice: "hidamari.notice",
} as const;

export type SessionFlags = {
  crisis: boolean; // crisis と判定された（要約・マッチングに進めない）
  matchingBlocked: boolean; // L2失敗などで止める（fail-closed）
};

function getPrimaryStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    if (window.localStorage) return window.localStorage;
  } catch {
    // プライベートブラウジング等で localStorage が無効な場合は sessionStorage へフォールバック
  }
  try {
    if (window.sessionStorage) return window.sessionStorage;
  } catch {
    // noop
  }
  return null;
}

function getSecondaryStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    if (window.sessionStorage && window.sessionStorage !== getPrimaryStorage()) {
      return window.sessionStorage;
    }
  } catch {
    // noop
  }
  return null;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const primary = getPrimaryStorage();
    const rawPrimary = primary?.getItem(key);
    if (rawPrimary !== null && rawPrimary !== undefined) {
      return JSON.parse(rawPrimary) as T;
    }
  } catch {
    // 破損データ時はセカンダリまたは fallback へ
  }
  try {
    const secondary = getSecondaryStorage();
    const rawSecondary = secondary?.getItem(key);
    if (rawSecondary !== null && rawSecondary !== undefined) {
      const parsed = JSON.parse(rawSecondary) as T;
      // 既存タブの sessionStorage データを localStorage へマイグレーション
      try {
        getPrimaryStorage()?.setItem(key, rawSecondary);
      } catch {
        // noop
      }
      return parsed;
    }
  } catch {
    // noop
  }
  return fallback;
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(value);
  try {
    getPrimaryStorage()?.setItem(key, serialized);
  } catch {
    // 容量超過などは無視（状態が残らないだけ）
  }
  try {
    getSecondaryStorage()?.setItem(key, serialized);
  } catch {
    // noop
  }
}

function remove(key: string) {
  if (typeof window === "undefined") return;
  try {
    getPrimaryStorage()?.removeItem(key);
  } catch {
    // noop
  }
  try {
    getSecondaryStorage()?.removeItem(key);
  } catch {
    // noop
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

  getActiveRoomId: () => read<string | null>(KEYS.activeRoomId, null),
  setActiveRoomId(id: string | null) {
    if (!id || typeof id !== "string") {
      remove(KEYS.activeRoomId);
      return;
    }
    write(KEYS.activeRoomId, id);
    this.addJoinedRoomId(id);
  },

  getNotice: () => read<FlowNotice | null>(KEYS.notice, null),
  setNotice(n: FlowNotice | null) {
    if (typeof window === "undefined") return;
    try {
      if (n === null) {
        remove(KEYS.notice);
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
    remove(KEYS.messages);
    remove(KEYS.flags);
    remove(KEYS.summaryShared);
  },

  clearAll() {
    if (typeof window === "undefined") return;
    Object.values(KEYS).forEach((key) => remove(key));
    try {
      window.sessionStorage?.clear();
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

