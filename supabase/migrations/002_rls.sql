-- ひだまり: Row Level Security（SPEC.md §8.1）
-- 方針: クライアント（anon/authenticated）に許すのは「自分のデータを読む」「プロフィールを書く」だけ。
-- それ以外の書き込みは、すべて API（service role）を通す。service role は RLS を無視する。

alter table public.profiles enable row level security;
alter table public.checkins enable row level security;
alter table public.summaries enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_messages enable row level security;
alter table public.match_requests enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.session_risk enable row level security;

-- ルームのメンバーか（RLSの再帰を避けるため security definer）
create or replace function public.is_room_member(rid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = rid and user_id = auth.uid()
  );
$$;

-- profiles: ログイン済みなら誰でも読める（ニックネームとアバターの表示用）。書き込みは本人だけ。
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- checkins: 本人だけが読める。書き込みはAPI。
create policy checkins_select on public.checkins for select to authenticated using (user_id = auth.uid());

-- summaries: 本人だけが読める。他人の要約は、候補としてAPI経由でだけ返す。書き込みはAPI。
create policy summaries_select on public.summaries for select to authenticated using (user_id = auth.uid());

-- match_requests: 当事者だけが読める。書き込みはAPI。
create policy match_requests_select on public.match_requests for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- rooms / room_members: メンバーだけが読める。書き込みはAPI。
create policy rooms_select on public.rooms for select to authenticated using (public.is_room_member(id));
create policy room_members_select on public.room_members for select to authenticated using (public.is_room_member(room_id));

-- room_messages: SELECT はメンバーだけ。INSERT / UPDATE / DELETE のポリシーは作らない
-- （= クライアントからは書けない。安全チェックを迂回させないため）
create policy room_messages_select on public.room_messages for select to authenticated using (public.is_room_member(room_id));

-- blocks / reports / session_risk: ポリシーなし（クライアントからは見えない・書けない）

-- Realtime
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.match_requests;
