export type CallStatus =
  | "idle"
  | "requesting"
  | "requested"
  | "connecting"
  | "connected"
  | "ended";

export interface CallState {
  status: CallStatus;
  isMuted: boolean;
  durationSeconds: number;
  errorMessage: string | null;
}

export type CallAction =
  | { type: "START_REQUEST" }
  | { type: "RECEIVE_REQUEST" }
  | { type: "ACCEPT_REQUEST" }
  | { type: "RECEIVE_ACCEPT" }
  | { type: "CONNECT_SUCCESS" }
  | { type: "CANCEL_REQUEST" }
  | { type: "REJECT_REQUEST" }
  | { type: "END_CALL" }
  | { type: "TOGGLE_MUTE" }
  | { type: "SET_MUTED"; isMuted: boolean }
  | { type: "TICK_TIMER" }
  | { type: "SET_ERROR"; message: string }
  | { type: "RESET" };

export const initialCallState: CallState = {
  status: "idle",
  isMuted: false,
  durationSeconds: 0,
  errorMessage: null,
};

/**
 * 双方承認通話の純粋な状態遷移リデューサー。
 * 双方がほぼ同時にリクエストした場合（status === "requesting" かつ RECEIVE_REQUEST）も
 * 双方同意成立として "connecting" へ自動遷移します。
 */
export function callStateReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case "RESET":
      return { ...initialCallState };

    case "SET_ERROR":
      return {
        ...state,
        status: state.status === "connected" || state.status === "connecting" ? "ended" : "idle",
        errorMessage: action.message,
      };

    case "START_REQUEST":
      if (state.status === "idle" || state.status === "ended") {
        return { ...state, status: "requesting", errorMessage: null };
      }
      return state;

    case "RECEIVE_REQUEST":
      if (state.status === "idle" || state.status === "ended") {
        return { ...state, status: "requested", errorMessage: null };
      }
      // 同時リクエスト発生: 自分も要求中なら双方同意成立で即座に接続へ
      if (state.status === "requesting") {
        return { ...state, status: "connecting", errorMessage: null };
      }
      return state;

    case "ACCEPT_REQUEST":
      if (state.status === "requested") {
        return { ...state, status: "connecting", errorMessage: null };
      }
      return state;

    case "RECEIVE_ACCEPT":
      if (state.status === "requesting") {
        return { ...state, status: "connecting", errorMessage: null };
      }
      return state;

    case "CONNECT_SUCCESS":
      if (state.status === "connecting") {
        return { ...state, status: "connected", durationSeconds: 0, errorMessage: null };
      }
      return state;

    case "CANCEL_REQUEST":
      if (state.status === "requesting" || state.status === "requested") {
        return { ...state, status: "idle" };
      }
      return state;

    case "REJECT_REQUEST":
      if (state.status === "requesting" || state.status === "requested") {
        return { ...state, status: "idle" };
      }
      return state;

    case "END_CALL":
      if (state.status !== "idle") {
        return { ...state, status: "ended" };
      }
      return state;

    case "TOGGLE_MUTE":
      return { ...state, isMuted: !state.isMuted };

    case "SET_MUTED":
      return { ...state, isMuted: action.isMuted };

    case "TICK_TIMER":
      if (state.status === "connected") {
        return { ...state, durationSeconds: state.durationSeconds + 1 };
      }
      return state;

    default:
      return state;
  }
}

/**
 * 通話秒数を MM:SS 形式にフォーマットする純粋関数。
 */
export function formatCallDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
