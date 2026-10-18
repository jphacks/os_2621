import { COPY } from "@/lib/copy";

export type FlowState = {
  hasProfile: boolean;
  hasCheckin: boolean;
  hasMessages: boolean; // ユーザー発言1件以上
  summaryShared: boolean; // 要約の確認・共有同意済み
  isCrisis: boolean;
  isMatchingBlocked: boolean;
  joinedRoomIds: string[];
};

export type FlowNoticeCode =
  | "crisis_redirect"
  | "matching_blocked"
  | "profile_required"
  | "checkin_required"
  | "consult_required"
  | "summary_required"
  | "room_invalid";

export type FlowNotice = {
  code: FlowNoticeCode;
  message: string;
};

export type GuardResult =
  | { allowed: true }
  | { allowed: false; redirectPath: string; notice: FlowNotice };

/**
 * URLパスを正規化する（クエリ文字列・ハッシュ除去、連続スラッシュ統合、末尾スラッシュ除去）
 */
export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  const clean = pathname.split("?")[0].split("#")[0].trim();
  const collapsed = clean.replace(/\/+/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed || "/";
}

/**
 * ページ遷移フローの妥当性を評価する純粋関数ステートマシン
 */
export function evaluateFlowAccess(pathname: string, state: FlowState): GuardResult {
  const path = normalizePathname(pathname);

  // P0 (トップ) と P8 (窓口案内) は常時アクセス可
  if (path === "/" || path === "/crisis") {
    return { allowed: true };
  }

  // 危機・マッチングブロックの特別対応
  // /summary, /candidates, /requests, /rooms/* への遷移をブロック
  const isMatchingFlowPath =
    path === "/summary" ||
    path === "/candidates" ||
    path === "/requests" ||
    path === "/rooms" ||
    path.startsWith("/rooms/");

  if (isMatchingFlowPath) {
    if (state.isCrisis) {
      return {
        allowed: false,
        redirectPath: "/crisis",
        notice: {
          code: "crisis_redirect",
          message: COPY.flow.notices.crisis_redirect,
        },
      };
    }
    if (state.isMatchingBlocked) {
      return {
        allowed: false,
        redirectPath: "/consult",
        notice: {
          code: "matching_blocked",
          message: COPY.flow.notices.matching_blocked,
        },
      };
    }
  }

  // P1: /start
  if (path === "/start") {
    return { allowed: true };
  }

  // P9: /settings（プロフィールが必要）
  if (path === "/settings") {
    if (!state.hasProfile) {
      return {
        allowed: false,
        redirectPath: "/start",
        notice: {
          code: "profile_required",
          message: COPY.flow.notices.profile_required,
        },
      };
    }
    return { allowed: true };
  }

  // P2: /checkin
  if (path === "/checkin") {
    if (!state.hasProfile) {
      return {
        allowed: false,
        redirectPath: "/start",
        notice: {
          code: "profile_required",
          message: COPY.flow.notices.profile_required,
        },
      };
    }
    return { allowed: true };
  }

  // P3: /consult
  if (path === "/consult") {
    if (!state.hasProfile) {
      return {
        allowed: false,
        redirectPath: "/start",
        notice: {
          code: "profile_required",
          message: COPY.flow.notices.profile_required,
        },
      };
    }
    if (!state.hasCheckin) {
      return {
        allowed: false,
        redirectPath: "/checkin",
        notice: {
          code: "checkin_required",
          message: COPY.flow.notices.checkin_required,
        },
      };
    }
    return { allowed: true };
  }

  // P4: /summary
  if (path === "/summary") {
    if (!state.hasProfile) {
      return {
        allowed: false,
        redirectPath: "/start",
        notice: {
          code: "profile_required",
          message: COPY.flow.notices.profile_required,
        },
      };
    }
    if (!state.hasCheckin) {
      return {
        allowed: false,
        redirectPath: "/checkin",
        notice: {
          code: "checkin_required",
          message: COPY.flow.notices.checkin_required,
        },
      };
    }
    if (!state.hasMessages) {
      return {
        allowed: false,
        redirectPath: "/consult",
        notice: {
          code: "consult_required",
          message: COPY.flow.notices.consult_required,
        },
      };
    }
    return { allowed: true };
  }

  // P5: /candidates
  if (path === "/candidates") {
    if (!state.hasProfile) {
      return {
        allowed: false,
        redirectPath: "/start",
        notice: {
          code: "profile_required",
          message: COPY.flow.notices.profile_required,
        },
      };
    }
    if (!state.hasCheckin) {
      return {
        allowed: false,
        redirectPath: "/checkin",
        notice: {
          code: "checkin_required",
          message: COPY.flow.notices.checkin_required,
        },
      };
    }
    if (!state.hasMessages) {
      return {
        allowed: false,
        redirectPath: "/consult",
        notice: {
          code: "consult_required",
          message: COPY.flow.notices.consult_required,
        },
      };
    }
    if (!state.summaryShared) {
      return {
        allowed: false,
        redirectPath: "/summary",
        notice: {
          code: "summary_required",
          message: COPY.flow.notices.summary_required,
        },
      };
    }
    return { allowed: true };
  }

  // P6: /requests
  // ホーム画面から Step6（リクエスト画面・以前のチャット記録）へいつでもアクセスできるよう、プロフィールとチェックインが完了していれば許可する
  if (path === "/requests") {
    if (!state.hasProfile) {
      return {
        allowed: false,
        redirectPath: "/start",
        notice: {
          code: "profile_required",
          message: COPY.flow.notices.profile_required,
        },
      };
    }
    if (!state.hasCheckin) {
      return {
        allowed: false,
        redirectPath: "/checkin",
        notice: {
          code: "checkin_required",
          message: COPY.flow.notices.checkin_required,
        },
      };
    }
    return { allowed: true };
  }

  // P7: /rooms, /rooms/[id]
  if (path === "/rooms" || path.startsWith("/rooms/")) {
    if (path === "/rooms/demo") {
      return { allowed: true };
    }

    const roomId = path.startsWith("/rooms/") ? path.slice("/rooms/".length) : "";

    if (!state.hasProfile) {
      return {
        allowed: false,
        redirectPath: "/start",
        notice: {
          code: "profile_required",
          message: COPY.flow.notices.profile_required,
        },
      };
    }
    if (!state.hasCheckin) {
      return {
        allowed: false,
        redirectPath: "/checkin",
        notice: {
          code: "checkin_required",
          message: COPY.flow.notices.checkin_required,
        },
      };
    }
    // すでに自分が参加したルームであれば、後から要約期限切れや会話クリアがあっても過去のチャット記録を閲覧・再開できる
    if (roomId && state.joinedRoomIds.includes(roomId)) {
      return { allowed: true };
    }
    if (!state.hasMessages) {
      return {
        allowed: false,
        redirectPath: "/consult",
        notice: {
          code: "consult_required",
          message: COPY.flow.notices.consult_required,
        },
      };
    }
    if (!state.summaryShared) {
      return {
        allowed: false,
        redirectPath: "/summary",
        notice: {
          code: "summary_required",
          message: COPY.flow.notices.summary_required,
        },
      };
    }
    return {
      allowed: false,
      redirectPath: "/requests",
      notice: {
        code: "room_invalid",
        message: COPY.flow.notices.room_invalid,
      },
    };
  }

  // その他のパスは許可
  return { allowed: true };
}
