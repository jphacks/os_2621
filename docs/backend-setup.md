# バックエンドのセットアップ（Aさん担当分）

## 1. Supabase プロジェクト

1. Supabase でプロジェクトを作る。
2. **Authentication → Providers → Anonymous Sign-Ins** を有効にする（`signInAnonymously` に必要）。
3. SQL Editor で、次の順に実行する（`supabase/migrations/`）。
   1. `001_schema.sql` — テーブル
   2. `002_rls.sql` — RLS と Realtime
   3. `003_seed.sql` — デモ用ユーザー5人（`is_demo = true`）
   4. `004_age_group.sql` — 年代区分（`profiles.age_group`）。一度選んだ年代は変えられない（トリガー）
4. `.env.local` を作り、`.env.example` の値を埋める（`.env.local` は git に入れない。このリポジトリは Public）。
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY`: 同じ画面の service_role（**サーバー専用。`NEXT_PUBLIC_` を付けない**）
   - `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL_MAIN` / `ANTHROPIC_MODEL_FAST`

### 無料で試す（Gemini）

Claude の代わりに、無料枠のある Google Gemini を使えます。

1. https://aistudio.google.com/apikey で API キーを作る（クレジットカード不要）。
2. `.env.local` に `LLM_PROVIDER=gemini` と `GEMINI_API_KEY=（キー）` を書く。`ANTHROPIC_*` は空のままでよい。
3. モデルを変えたいときだけ `GEMINI_MODEL_MAIN` / `GEMINI_MODEL_FAST` を書く（空なら `gemini-3.8-flash` / `gemini-3.5-flash-lite`）。

注意:
- 無料枠には、回数と速度の制限がある。デモの直前に使いすぎると、止まることがある。止まったときは、危機判定が失敗扱い（fail-closed）になり、マッチングに進めない。
- **無料枠に送った内容は、Google が製品の改善に使うことがある。**実在の相談内容は入れず、ダミーの文だけで試すこと。
- 安全フィルターで応答が空になったときも、失敗として扱う（fail-closed）。

## 2. 設計のポイント

- **同年代どうしのマッチング**: `profiles.age_group`（中学生 / 高校生 / 大学生）が同じで、どちらも設定済みの人だけが候補・リクエスト・承諾の対象（`lib/matching/score.ts`）。未設定は除外（fail-closed）。

- **クライアントから書けるのは `profiles`（自分の行）だけ**。ほかの書き込みはすべて API（service role）を通す。
- `room_messages` は、SELECT がルームのメンバーだけ。INSERT/UPDATE/DELETE のポリシーがない（= クライアントから書けない）ので、安全チェックを迂回できない。
- `blocks` / `reports` / `session_risk` は、ポリシーなし（クライアントから見えない）。`blocks` と `reports` はユーザー削除後も残す。
- `session_risk`: AI相談で crisis（24時間）・L2の失敗（30分）になったユーザーを覚えておく。`/api/summarize`・`/api/summaries`・`/api/match/*` は、これを見て拒否する（UIの無効化だけに頼らない）。確認に失敗したときも「止める」側に倒す。
- ログには ID と判定結果だけを出す。相談やメッセージの本文は出さない。

## 3. RLS の確認手順（SQL Editor）

別ユーザーとして `room_messages` に INSERT できないことを確認する。

```sql
-- 任意のユーザーIDになりきる
select set_config('request.jwt.claims', '{"sub":"<ユーザーID>","role":"authenticated"}', true);
set local role authenticated;

-- どちらも「new row violates row-level security policy」で失敗すれば OK
insert into public.room_messages (room_id, sender_id, sender_type, body)
values ('<ルームID>', '<ユーザーID>', 'user', 'test');
```

## 4. API 一覧（実装済み）

| API | ファイル |
| :-- | :-- |
| POST `/api/checkin` | `app/api/checkin/route.ts` |
| POST `/api/chat` | `app/api/chat/route.ts` |
| POST `/api/summarize` | `app/api/summarize/route.ts` |
| POST `/api/summaries` | `app/api/summaries/route.ts` |
| GET `/api/match/candidates` | `app/api/match/candidates/route.ts` |
| POST / GET `/api/match/requests` | `app/api/match/requests/route.ts` |
| POST `/api/match/requests/[id]/respond` | `app/api/match/requests/[id]/respond/route.ts` |
| POST `/api/rooms/[id]/messages` | `app/api/rooms/[id]/messages/route.ts` |
| POST `/api/rooms/[id]/leave` | `app/api/rooms/[id]/leave/route.ts` |
| POST `/api/rooms/[id]/facilitate` | `app/api/rooms/[id]/facilitate/route.ts` |
| POST `/api/blocks` | `app/api/blocks/route.ts` |
| POST `/api/reports` | `app/api/reports/route.ts` |
| DELETE `/api/me` | `app/api/me/route.ts` |

入出力の型は `types/api.ts`・`types/room.ts`。画面側が想定している形は `docs/api-contract-from-ui.md`。
