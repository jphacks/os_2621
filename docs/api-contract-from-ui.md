# UI（Cさん）が想定しているAPIの形

Aさんへ。画面側は下の形で `fetch` しています。違う形にする場合は、教えてください（直すのは `components/api.ts` と `components/consult/stream.ts` の2か所だけです）。
正式な型は `types/` に置いてもらえれば、そちらに差し替えます。

| API | リクエスト | レスポンス（成功時） | UIが見ているエラー |
| :-- | :-- | :-- | :-- |
| POST `/api/checkin` | `{ mood, energy }` | 2xx なら何でも | 失敗しても相談は続けられる |
| POST `/api/chat` | `{ messages: {role, content}[], checkin }` | 下の「chat のストリーム」参照 | 非2xxは「マッチング停止」扱い（fail-closed） |
| POST `/api/summarize` | `{ messages, checkin }` | `{ share_text, category, tags, energy_estimate, stage_estimate }` | 失敗で「もう一度ためす」を表示 |
| POST `/api/summaries` | 上の要約 + `{ checkin }`（本人が編集済み） | 2xx なら何でも | **403 = このセッションは共有不可（crisis等）** |
| GET `/api/match/candidates` | — | `{ candidates: { summary_id, user_id, nickname, avatar, share_text, common_ground? }[] }` | 403 = 共有した要約がない |
| POST `/api/match/requests` | `{ to_user, to_summary }` | 2xx | **429 = 同時3件の上限** |
| GET `/api/match/requests` | — | `{ received: {id, from_nickname, from_avatar, share_text, status, expires_at}[], sent: {id, to_nickname, to_avatar, status, expires_at, room_id?}[] }` | |
| POST `/api/match/requests/[id]/respond` | `{ accept: boolean }` | 承諾なら `{ room_id }` | |
| POST `/api/rooms/[id]/messages` | `{ body }` | `{ type?: "crisis", masked?: boolean }` | crisis のとき、相手には配信しない |
| POST `/api/rooms/[id]/leave` | `{}` | 2xx | |
| POST `/api/rooms/[id]/facilitate` | `{ event: "time_warning" \| "closing" }` | 2xx | 25分・30分にクライアントから送る（2人とも送るので、サーバー側で重複を無視してください） |
| POST `/api/blocks` | `{ blocked_user_id, room_id }` | 2xx | |
| POST `/api/reports` | `{ reported_user_id, room_id, reason: "aggressive" \| "pii" \| "uncomfortable" \| "other", }` | 2xx | |
| DELETE `/api/me` | — | 2xx | |

`status` は `pending | accepted | declined | expired`。

## chat のストリーム

`Content-Type` で読み分けています。

- `application/json`: `{"type":"crisis"}` のような1件のイベント
- `text/event-stream` または `application/x-ndjson`: 1行1イベント（SSEは `data: ` 付き）
  - `{"type":"delta","text":"..."}` 応答の続き
  - `{"type":"crisis"}` 危機を検知（UIは応答を捨てて、窓口案内に切り替える）
  - `{"type":"done","matchingBlocked":true|false}`
- `text/plain`: 応答テキストそのもの

## Supabase を直接使っている箇所（RLSの確認をお願いします）

- P1: `auth.signInAnonymously()` と `profiles` への upsert（`id, nickname, avatar`）
- P9: `profiles` の `nickname` 更新
- P7: `rooms` / `room_members` / `room_messages` の SELECT と、Realtime の購読（`room_messages` INSERT、`rooms` UPDATE、`room_members` UPDATE）
- P6: `match_requests` の Realtime（変更があったら API を再取得するだけ）
- `profiles` から `id, nickname, avatar` を読む（ルームの相手の表示用）

## 動作確認のメモ

- `NEXT_PUBLIC_SUPABASE_URL` が空のとき、P1 はサインインを飛ばし、`/rooms/demo` はデモ表示になります（画面確認用）。
- 画面遷移バーは本番では非表示です。出したいときは `NEXT_PUBLIC_DEV_NAV=true`。
