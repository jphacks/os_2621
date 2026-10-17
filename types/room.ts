// ルーム関連APIの入出力型。UI側（components/api.ts）と同じ形にしてある。

export type MessageResponse =
  | { type: "ok"; masked: boolean }
  | { type: "crisis" }; // 本人にだけ返す。相手には何も配信しない

export type FacilitateEvent = "time_warning" | "closing";

export type ReportReason = "aggressive" | "pii" | "uncomfortable" | "other";

export type EndReason = "left" | "timeout" | "report" | "safety";
