// フロント（Cさん）が呼ぶAPIの入出力型。docs/api-contract-from-ui.md と同じ形。
import type { Category, Stage } from "@/lib/matching/score";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Checkin = { mood: number; energy: number };

/** POST /api/chat のレスポンス（application/x-ndjson の1行1イベント）。crisis のときは application/json で単発 */
export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "crisis" }
  | { type: "done"; matchingBlocked: boolean };

export type SummaryDraft = {
  share_text: string;
  category: Category;
  tags: string[];
  energy_estimate: number;
  stage_estimate: Stage;
  masked?: boolean;
};

export type CandidateDto = {
  summary_id: string;
  user_id: string;
  nickname: string;
  avatar: string;
  share_text: string;
  common_ground: string;
};

export type RequestStatus = "pending" | "accepted" | "declined" | "expired";

export type ReceivedRequestDto = {
  id: string;
  from_nickname: string;
  from_avatar: string;
  share_text: string;
  status: RequestStatus;
  expires_at: string;
};

export type SentRequestDto = {
  id: string;
  to_nickname: string;
  to_avatar: string;
  status: RequestStatus;
  expires_at: string;
  room_id: string | null;
};
