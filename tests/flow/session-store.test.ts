import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sessionStore } from "@/components/session-store";

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

describe("sessionStore", () => {
  beforeAll(() => {
    const mockStorage = new MockStorage();
    // @ts-expect-error test mock
    globalThis.window = {
      sessionStorage: mockStorage,
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    globalThis.sessionStorage = mockStorage;
    // @ts-expect-error test mock
    globalThis.CustomEvent = class CustomEvent {
      detail: unknown;
      constructor(public type: string, init?: { detail?: unknown }) {
        this.detail = init?.detail;
      }
    };
  });

  beforeEach(() => {
    sessionStore.clearAll();
  });

  it("初期状態ではデフォルトの FlowState を返す", () => {
    const state = sessionStore.getFlowState();
    expect(state).toEqual({
      hasProfile: false,
      hasCheckin: false,
      hasMessages: false,
      summaryShared: false,
      isCrisis: false,
      isMatchingBlocked: false,
      joinedRoomIds: [],
    });
  });

  it("プロフィール登録で hasProfile が true になる", () => {
    sessionStore.setProfile({ nickname: "ひなた", avatar: "sun" });
    const state = sessionStore.getFlowState();
    expect(state.hasProfile).toBe(true);
  });

  it("チェックイン記録で hasCheckin が true になる", () => {
    sessionStore.setCheckin({ mood: 3, energy: 4 });
    const state = sessionStore.getFlowState();
    expect(state.hasCheckin).toBe(true);
  });

  it("ユーザーメッセージ記録で hasMessages が true になる（アシスタントのみでは false）", () => {
    sessionStore.setMessages([{ role: "assistant", content: "こんにちは" }]);
    expect(sessionStore.getFlowState().hasMessages).toBe(false);

    sessionStore.setMessages([
      { role: "assistant", content: "こんにちは" },
      { role: "user", content: "つらいです" },
    ]);
    expect(sessionStore.getFlowState().hasMessages).toBe(true);
  });

  it("要約共有記録で summaryShared が true になる", () => {
    sessionStore.setSummaryShared(true);
    expect(sessionStore.getFlowState().summaryShared).toBe(true);
  });

  it("ルームIDの追加と重複防止", () => {
    sessionStore.addJoinedRoomId("room-1");
    sessionStore.addJoinedRoomId("room-2");
    sessionStore.addJoinedRoomId("room-1"); // 重複追加
    expect(sessionStore.getJoinedRoomIds()).toEqual(["room-1", "room-2"]);
    expect(sessionStore.getFlowState().joinedRoomIds).toEqual(["room-1", "room-2"]);
  });

  it("clearConsult で messages, flags, summaryShared がクリアされる", () => {
    sessionStore.setProfile({ nickname: "ひなた", avatar: "sun" });
    sessionStore.setCheckin({ mood: 3, energy: 3 });
    sessionStore.setMessages([{ role: "user", content: "相談" }]);
    sessionStore.setFlags({ crisis: true, matchingBlocked: true });
    sessionStore.setSummaryShared(true);

    sessionStore.clearConsult();

    const state = sessionStore.getFlowState();
    // プロフィールとチェックインは維持
    expect(state.hasProfile).toBe(true);
    expect(state.hasCheckin).toBe(true);
    // 相談関連はリセット
    expect(state.hasMessages).toBe(false);
    expect(state.isCrisis).toBe(false);
    expect(state.isMatchingBlocked).toBe(false);
    expect(state.summaryShared).toBe(false);
  });

  it("clearAll で全データがリセットされる", () => {
    sessionStore.setProfile({ nickname: "ひなた", avatar: "sun" });
    sessionStore.addJoinedRoomId("room-1");

    sessionStore.clearAll();

    const state = sessionStore.getFlowState();
    expect(state.hasProfile).toBe(false);
    expect(state.joinedRoomIds).toEqual([]);
  });

  it("notice の設定と消費", () => {
    const notice = {
      code: "profile_required" as const,
      message: "プロフィールが必要です",
    };
    sessionStore.setNotice(notice);
    expect(sessionStore.getNotice()).toEqual(notice);

    const consumed = sessionStore.consumeNotice();
    expect(consumed).toEqual(notice);
    expect(sessionStore.getNotice()).toBeNull();
  });

  it("setNotice(null) で通知を直接クリアできる", () => {
    sessionStore.setNotice({
      code: "checkin_required",
      message: "チェックインが必要です",
    });
    sessionStore.setNotice(null);
    expect(sessionStore.getNotice()).toBeNull();
  });

  it("ニックネームが空白のみの場合は hasProfile は false のまま", () => {
    sessionStore.setProfile({ nickname: "   ", avatar: "sun" });
    expect(sessionStore.getFlowState().hasProfile).toBe(false);
  });

  it("ユーザーメッセージが空白のみの場合は hasMessages は false のまま", () => {
    sessionStore.setMessages([
      { role: "assistant", content: "お話しを聞きますよ" },
      { role: "user", content: "   \n\t  " },
    ]);
    expect(sessionStore.getFlowState().hasMessages).toBe(false);

    // 有効な文字が含まれる場合は true
    sessionStore.setMessages([
      { role: "assistant", content: "お話しを聞きますよ" },
      { role: "user", content: " つらい " },
    ]);
    expect(sessionStore.getFlowState().hasMessages).toBe(true);
  });

  it("addJoinedRoomId は空文字や非文字列を無視する", () => {
    sessionStore.addJoinedRoomId("");
    // @ts-expect-error test invalid argument
    sessionStore.addJoinedRoomId(null);
    // @ts-expect-error test invalid argument
    sessionStore.addJoinedRoomId(123);
    expect(sessionStore.getJoinedRoomIds()).toEqual([]);
  });

  it("sessionStorage に不正な JSON が保存されていてもクラッシュせず fallback を返す", () => {
    globalThis.sessionStorage.setItem("hidamari.profile", "INVALID_JSON{{");
    globalThis.sessionStorage.setItem("hidamari.flags", "{corrupted");

    expect(sessionStore.getProfile()).toBeNull();
    expect(sessionStore.getFlags()).toEqual({ crisis: false, matchingBlocked: false });
    expect(sessionStore.getFlowState().hasProfile).toBe(false);
  });
});
