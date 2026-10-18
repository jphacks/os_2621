-- ChatTomo: スキーマ（SPEC.md §8）
-- 実行順: 001_schema → 002_rls → 003_seed

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 12),
  avatar text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mood int not null check (mood between 1 and 5),
  energy int not null check (energy between 1 and 5),
  created_at timestamptz not null default now()
);

create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  share_text text not null check (char_length(share_text) between 1 and 200),
  category text not null check (category in ('relationships','career','study','family','loneliness','health','other')),
  tags text[] not null default '{}',
  energy int not null check (energy between 1 and 5),
  stage text not null check (stage in ('struggling','coping','recovering')),
  risk_level text not null default 'none' check (risk_level in ('none','caution','crisis')),
  share_consent boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index summaries_user_idx on public.summaries (user_id, created_at desc);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active','ended')),
  end_reason text check (end_reason in ('left','timeout','report','safety')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  -- 連続した攻撃的発言の回数（lib/facilitator/decide.ts が使う）
  hostility_count int not null default 0
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  summary_id uuid references public.summaries (id) on delete set null,
  left_at timestamptz,
  primary key (room_id, user_id)
);
create index room_members_user_idx on public.room_members (user_id);

create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null, -- AI・systemのときは null
  sender_type text not null check (sender_type in ('user','ai','system')),
  body text not null,
  masked boolean not null default false,
  created_at timestamptz not null default now()
);
create index room_messages_room_idx on public.room_messages (room_id, created_at);

create table public.match_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  from_summary uuid references public.summaries (id) on delete set null,
  to_summary uuid references public.summaries (id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  room_id uuid references public.rooms (id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index match_requests_to_idx on public.match_requests (to_user, status);
create index match_requests_from_idx on public.match_requests (from_user, status);

-- ブロックと通報は、ユーザーを削除しても残す（安全のため）。ユーザーへの外部キーは張らない
create table public.blocks (
  blocker uuid not null,
  blocked uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null,
  reported uuid not null,
  room_id uuid,
  reason text not null check (reason in ('aggressive','pii','uncomfortable','other')),
  created_at timestamptz not null default now()
);

-- AI相談で危機・判定失敗になったユーザーを、サーバー側で覚えておく（API側でも要約・マッチングを拒否するため）
-- crisis は24時間、L2の失敗（unknown）は短い時間だけ止める。チェックインでは解除しない。
create table public.session_risk (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  level text not null check (level in ('crisis','unknown')),
  blocked_until timestamptz not null,
  updated_at timestamptz not null default now()
);
