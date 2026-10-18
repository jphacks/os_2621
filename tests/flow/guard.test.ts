import { describe, expect, it } from "vitest";
import {
  evaluateFlowAccess,
  normalizePathname,
  type FlowState,
} from "@/lib/flow/guard";
import { COPY } from "@/lib/copy";

const defaultState: FlowState = {
  hasProfile: false,
  hasCheckin: false,
  hasMessages: false,
  summaryShared: false,
  isCrisis: false,
  isMatchingBlocked: false,
  joinedRoomIds: [],
};

describe("normalizePathname", () => {
  it("クエリパラメータやハッシュを除去する", () => {
    expect(normalizePathname("/summary?ref=1&step=2")).toBe("/summary");
    expect(normalizePathname("/consult#bottom")).toBe("/consult");
    expect(normalizePathname("/candidates?q=test#card")).toBe("/candidates");
  });

  it("末尾のスラッシュを除去する（ルートを除く）", () => {
    expect(normalizePathname("/start/")).toBe("/start");
    expect(normalizePathname("/rooms/room-1/")).toBe("/rooms/room-1");
    expect(normalizePathname("/")).toBe("/");
    expect(normalizePathname("///")).toBe("/");
  });

  it("連続スラッシュを正規化する", () => {
    expect(normalizePathname("//requests//")).toBe("/requests");
    expect(normalizePathname("")).toBe("/");
  });
});

describe("evaluateFlowAccess - 正常系", () => {
  it("ルートパス (/) と窓口案内 (/crisis) は常にアクセス可能", () => {
    expect(evaluateFlowAccess("/", defaultState)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/crisis", defaultState)).toEqual({ allowed: true });
  });

  it("/start は常にアクセス可能", () => {
    expect(evaluateFlowAccess("/start", defaultState)).toEqual({ allowed: true });
  });

  it("プロフィール登録済みなら /checkin と /settings にアクセス可能", () => {
    const state: FlowState = { ...defaultState, hasProfile: true };
    expect(evaluateFlowAccess("/checkin", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/settings", state)).toEqual({ allowed: true });
  });

  it("チェックイン完了なら /consult にアクセス可能", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
    };
    expect(evaluateFlowAccess("/consult", state)).toEqual({ allowed: true });
  });

  it("ユーザー発言があれば /summary にアクセス可能", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
    };
    expect(evaluateFlowAccess("/summary", state)).toEqual({ allowed: true });
  });

  it("要約共有完了なら /candidates と /requests にアクセス可能", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
      summaryShared: true,
    };
    expect(evaluateFlowAccess("/candidates", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/requests", state)).toEqual({ allowed: true });
  });

  it("参加済みルームIDを持つ場合は該当ルーム (/rooms/[id]) にアクセス可能", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
      summaryShared: true,
      joinedRoomIds: ["room-123"],
    };
    expect(evaluateFlowAccess("/rooms/room-123", state)).toEqual({ allowed: true });
  });

  it("デモルーム (/rooms/demo) は通常状態でアクセス可能", () => {
    expect(evaluateFlowAccess("/rooms/demo", defaultState)).toEqual({ allowed: true });
  });
});

describe("evaluateFlowAccess - スキップ防止（前提条件未完了の遮断と誘導）", () => {
  it("未登録ユーザーが /checkin に直接アクセスすると /start へ誘導", () => {
    const result = evaluateFlowAccess("/checkin", defaultState);
    expect(result).toEqual({
      allowed: false,
      redirectPath: "/start",
      notice: {
        code: "profile_required",
        message: COPY.flow.notices.profile_required,
      },
    });
  });

  it("未登録ユーザーが /settings に直接アクセスすると /start へ誘導", () => {
    const result = evaluateFlowAccess("/settings", defaultState);
    expect(result).toEqual({
      allowed: false,
      redirectPath: "/start",
      notice: {
        code: "profile_required",
        message: COPY.flow.notices.profile_required,
      },
    });
  });

  it("未チェックインで /consult に直接アクセスすると /checkin へ誘導", () => {
    const state: FlowState = { ...defaultState, hasProfile: true };
    const result = evaluateFlowAccess("/consult", state);
    expect(result).toEqual({
      allowed: false,
      redirectPath: "/checkin",
      notice: {
        code: "checkin_required",
        message: COPY.flow.notices.checkin_required,
      },
    });
  });

  it("会話なしで /summary に直接アクセスすると /consult へ誘導", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: false,
    };
    const result = evaluateFlowAccess("/summary", state);
    expect(result).toEqual({
      allowed: false,
      redirectPath: "/consult",
      notice: {
        code: "consult_required",
        message: COPY.flow.notices.consult_required,
      },
    });
  });

  it("要約未共有で /candidates や /requests に直接アクセスすると /summary へ誘導", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
      summaryShared: false,
    };

    const resCandidates = evaluateFlowAccess("/candidates", state);
    expect(resCandidates).toEqual({
      allowed: false,
      redirectPath: "/summary",
      notice: {
        code: "summary_required",
        message: COPY.flow.notices.summary_required,
      },
    });

    const resRequests = evaluateFlowAccess("/requests", state);
    expect(resRequests).toEqual({
      allowed: false,
      redirectPath: "/summary",
      notice: {
        code: "summary_required",
        message: COPY.flow.notices.summary_required,
      },
    });
  });

  it("未参加の通常ルームにアクセスすると /requests へ誘導", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
      summaryShared: true,
      joinedRoomIds: ["room-abc"],
    };
    const result = evaluateFlowAccess("/rooms/unauthorized-room", state);
    expect(result).toEqual({
      allowed: false,
      redirectPath: "/requests",
      notice: {
        code: "room_invalid",
        message: COPY.flow.notices.room_invalid,
      },
    });
  });

  it("IDのない /rooms に直接アクセスすると /requests へ誘導", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
      summaryShared: true,
      joinedRoomIds: ["room-abc"],
    };
    const result = evaluateFlowAccess("/rooms", state);
    expect(result).toEqual({
      allowed: false,
      redirectPath: "/requests",
      notice: {
        code: "room_invalid",
        message: COPY.flow.notices.room_invalid,
      },
    });
  });

  it("未登録ユーザーが後のステップ（P3〜P7）に直接アクセスした場合、すべて最優先で /start へ誘導", () => {
    const skipTargets = [
      "/consult",
      "/summary",
      "/candidates",
      "/requests",
      "/rooms",
      "/rooms/room-xyz",
    ];

    for (const path of skipTargets) {
      const result = evaluateFlowAccess(path, defaultState);
      expect(result).toEqual({
        allowed: false,
        redirectPath: "/start",
        notice: {
          code: "profile_required",
          message: COPY.flow.notices.profile_required,
        },
      });
    }
  });

  it("チェックイン未完了ユーザーが後のステップ（P4〜P7）に直接アクセスした場合、すべて /checkin へ誘導", () => {
    const state: FlowState = { ...defaultState, hasProfile: true, hasCheckin: false };
    const skipTargets = [
      "/summary",
      "/candidates",
      "/requests",
      "/rooms",
      "/rooms/room-xyz",
    ];

    for (const path of skipTargets) {
      const result = evaluateFlowAccess(path, state);
      expect(result).toEqual({
        allowed: false,
        redirectPath: "/checkin",
        notice: {
          code: "checkin_required",
          message: COPY.flow.notices.checkin_required,
        },
      });
    }
  });

  it("相談発言未送信ユーザーが後のステップ（P5〜P7）に直接アクセスした場合、すべて /consult へ誘導", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: false,
    };
    const skipTargets = [
      "/candidates",
      "/requests",
      "/rooms",
      "/rooms/room-xyz",
    ];

    for (const path of skipTargets) {
      const result = evaluateFlowAccess(path, state);
      expect(result).toEqual({
        allowed: false,
        redirectPath: "/consult",
        notice: {
          code: "consult_required",
          message: COPY.flow.notices.consult_required,
        },
      });
    }
  });

  it("要約未共有ユーザーがルーム（P7）に直接アクセスした場合、/summary へ誘導", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
      summaryShared: false,
    };
    const skipTargets = [
      "/rooms",
      "/rooms/room-xyz",
    ];

    for (const path of skipTargets) {
      const result = evaluateFlowAccess(path, state);
      expect(result).toEqual({
        allowed: false,
        redirectPath: "/summary",
        notice: {
          code: "summary_required",
          message: COPY.flow.notices.summary_required,
        },
      });
    }
  });
});

describe("evaluateFlowAccess - 危機・マッチングブロック時の安全強制", () => {
  it("isCrisis=true のとき、要約・マッチング・ルーム系へのアクセスはすべて /crisis へリダイレクト", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
      summaryShared: true,
      isCrisis: true,
      joinedRoomIds: ["room-123"],
    };

    const targets = [
      "/summary",
      "/candidates",
      "/requests",
      "/rooms",
      "/rooms/room-123",
      "/rooms/demo",
    ];

    for (const target of targets) {
      const result = evaluateFlowAccess(target, state);
      expect(result).toEqual({
        allowed: false,
        redirectPath: "/crisis",
        notice: {
          code: "crisis_redirect",
          message: COPY.flow.notices.crisis_redirect,
        },
      });
    }

    // /crisis や / は常時アクセス可
    expect(evaluateFlowAccess("/crisis", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/", state)).toEqual({ allowed: true });
    // 前提条件を満たしているプロフィール系や相談はアクセス可
    expect(evaluateFlowAccess("/start", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/checkin", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/consult", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/settings", state)).toEqual({ allowed: true });
  });

  it("isMatchingBlocked=true のとき、要約・マッチング・ルーム系へのアクセスは /consult へリダイレクト", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
      summaryShared: true,
      isMatchingBlocked: true,
      joinedRoomIds: ["room-123"],
    };

    const targets = [
      "/summary",
      "/candidates",
      "/requests",
      "/rooms",
      "/rooms/room-123",
      "/rooms/demo",
    ];

    for (const target of targets) {
      const result = evaluateFlowAccess(target, state);
      expect(result).toEqual({
        allowed: false,
        redirectPath: "/consult",
        notice: {
          code: "matching_blocked",
          message: COPY.flow.notices.matching_blocked,
        },
      });
    }

    // /crisis, /, /consult はアクセス可
    expect(evaluateFlowAccess("/crisis", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/consult", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/start", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/checkin", state)).toEqual({ allowed: true });
    expect(evaluateFlowAccess("/settings", state)).toEqual({ allowed: true });
  });

  it("isCrisis と isMatchingBlocked が両方 true の場合は危機 (isCrisis) を最優先する", () => {
    const state: FlowState = {
      ...defaultState,
      isCrisis: true,
      isMatchingBlocked: true,
    };
    const result = evaluateFlowAccess("/summary", state);
    expect(result).toEqual({
      allowed: false,
      redirectPath: "/crisis",
      notice: {
        code: "crisis_redirect",
        message: COPY.flow.notices.crisis_redirect,
      },
    });
  });
});

describe("evaluateFlowAccess - クエリや末尾スラッシュ付きURLの境界値", () => {
  it("クエリパラメータや末尾スラッシュが付いていても正しく判定できる", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: false,
    };

    const result = evaluateFlowAccess("/checkin/?ref=header&tab=1#main", state);
    expect(result).toEqual({
      allowed: false,
      redirectPath: "/start",
      notice: {
        code: "profile_required",
        message: COPY.flow.notices.profile_required,
      },
    });
  });

  it("参加済みルームのURLにスラッシュやクエリが付いていても許可される", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
      summaryShared: true,
      joinedRoomIds: ["room-123"],
    };

    expect(evaluateFlowAccess("/rooms/room-123/?from=list#bottom", state)).toEqual({
      allowed: true,
    });
    expect(evaluateFlowAccess("//rooms//demo//?preview=true", defaultState)).toEqual({
      allowed: true,
    });
  });

  it("未参加ルームURLにスラッシュが付いていても正しくブロックされる", () => {
    const state: FlowState = {
      ...defaultState,
      hasProfile: true,
      hasCheckin: true,
      hasMessages: true,
      summaryShared: true,
      joinedRoomIds: ["room-123"],
    };

    const result = evaluateFlowAccess("/rooms/other-room/", state);
    expect(result).toEqual({
      allowed: false,
      redirectPath: "/requests",
      notice: {
        code: "room_invalid",
        message: COPY.flow.notices.room_invalid,
      },
    });
  });
});
