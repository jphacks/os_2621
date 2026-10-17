// POST /api/chat のレスポンスを読むクライアント側の処理。
//
// 想定するレスポンス形式（Aさんの実装と合わせる。違う場合はこのファイルだけ直す）:
//   - application/json            : {"type":"crisis"} など単発のイベント
//   - text/event-stream / ndjson  : 1行1イベント（SSEは "data: " 付き）
//       {"type":"delta","text":"..."}   応答の続き
//       {"type":"crisis"}               危機を検知（以降の応答は表示しない）
//       {"type":"done","matchingBlocked":true|false}
//   - text/plain                  : 応答テキストそのもの（ストリーミング）

export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "crisis" }
  | { type: "done"; matchingBlocked?: boolean };

function parseLine(line: string): ChatEvent | null {
  const body = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
  if (!body || body === "[DONE]") return null;
  try {
    const ev = JSON.parse(body);
    if (ev && typeof ev.type === "string") return ev as ChatEvent;
  } catch {
    // JSONでない行は無視
  }
  return null;
}

export async function* readChatStream(res: Response): AsyncGenerator<ChatEvent> {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const ev = parseLine(await res.text());
    if (ev) yield ev;
    return;
  }

  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  if (contentType.includes("text/plain")) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield { type: "delta", text: decoder.decode(value, { stream: true }) };
    }
    yield { type: "done" };
    return;
  }

  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const ev = parseLine(line);
      if (ev) yield ev;
    }
  }
  const last = parseLine(buffer);
  if (last) yield last;
}
