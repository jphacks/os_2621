-- ChatTomo: デモ用のシードユーザー5人（SPEC.md §2.3）
-- すべて is_demo = true。AIが人間のふりをするものではなく、デモ用の登録だと分かる印を付けている。
-- share_text はすべてダミーの文（実在の相談内容は入れない）。
--
-- 注意: profiles は auth.users を参照するため、先に auth.users に行を入れる。
-- ログインはできない（パスワードなし・メールは存在しないドメイン）。

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo1@demo.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo2@demo.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo3@demo.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo4@demo.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000d5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo5@demo.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000d6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo6@demo.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000d7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo7@demo.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000d8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo8@demo.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000d9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo9@demo.invalid', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, nickname, avatar, is_demo)
values
  ('00000000-0000-4000-8000-0000000000d1', 'ことり（デモ）', 'bird', true),
  ('00000000-0000-4000-8000-0000000000d2', 'おちゃ（デモ）', 'tea', true),
  ('00000000-0000-4000-8000-0000000000d3', 'つき（デモ）', 'moon', true),
  ('00000000-0000-4000-8000-0000000000d4', 'はっぱ（デモ）', 'leaf', true),
  ('00000000-0000-4000-8000-0000000000d5', 'ねこ（デモ）', 'cat', true),
  ('00000000-0000-4000-8000-0000000000d6', 'そら（デモ）', 'cloud', true),
  ('00000000-0000-4000-8000-0000000000d7', 'ひなた（デモ）', 'sun', true),
  ('00000000-0000-4000-8000-0000000000d8', 'はな（デモ）', 'flower', true),
  ('00000000-0000-4000-8000-0000000000d9', 'ほし（デモ）', 'star', true)
on conflict (id) do nothing;

-- カテゴリ・エネルギー・stage をばらしてある。有効期限は30日（デモ期間中は有効）
insert into public.summaries (id, user_id, share_text, category, tags, energy, stage, risk_level, share_consent, expires_at)
values
  ('00000000-0000-4000-8000-0000000001d1', '00000000-0000-4000-8000-0000000000d1',
   '新しい環境になじめず、居場所がないと感じています。', 'loneliness', array['孤立感','新生活','居場所'], 3, 'coping', 'none', true, now() + interval '30 days'),
  ('00000000-0000-4000-8000-0000000001d2', '00000000-0000-4000-8000-0000000000d2',
   'サークルの人間関係で、うまく話に入れず悩んでいます。', 'relationships', array['友人関係','孤立感','サークル'], 4, 'recovering', 'none', true, now() + interval '30 days'),
  ('00000000-0000-4000-8000-0000000001d3', '00000000-0000-4000-8000-0000000000d3',
   '進路が決められず、周りと比べて焦っています。', 'career', array['進路','焦り','比較'], 2, 'struggling', 'none', true, now() + interval '30 days'),
  ('00000000-0000-4000-8000-0000000001d4', '00000000-0000-4000-8000-0000000000d4',
   '勉強のペースがつかめず、気持ちが落ち着きません。', 'study', array['勉強','不安','生活リズム'], 3, 'coping', 'none', true, now() + interval '30 days'),
  ('00000000-0000-4000-8000-0000000001d5', '00000000-0000-4000-8000-0000000000d5',
   '最近、友人と少し距離ができてしまい、さみしさがあります。', 'relationships', array['友人関係','さみしさ','新生活'], 5, 'recovering', 'none', true, now() + interval '30 days'),
  ('00000000-0000-4000-8000-0000000001d6', '00000000-0000-4000-8000-0000000000d6',
   'クラスや部活の人間関係で、周りに気を使いすぎて疲れています。', 'relationships', array['友人関係','部活','気疲れ'], 4, 'recovering', 'none', true, now() + interval '30 days'),
  ('00000000-0000-4000-8000-0000000001d7', '00000000-0000-4000-8000-0000000000d7',
   '受験や進路のことを考えると、焦りと不安でいっぱいになります。', 'career', array['進路','勉強','焦り'], 3, 'coping', 'none', true, now() + interval '30 days'),
  ('00000000-0000-4000-8000-0000000001d8', '00000000-0000-4000-8000-0000000000d8',
   'クラスの友達の輪にうまく入れず、学校で孤立している気がします。', 'relationships', array['友人関係','孤立感','新生活'], 4, 'recovering', 'none', true, now() + interval '30 days'),
  ('00000000-0000-4000-8000-0000000001d9', '00000000-0000-4000-8000-0000000000d9',
   'テストや勉強についていけるか不安で、夜なかなか眠れません。', 'study', array['勉強','不安','生活リズム'], 3, 'coping', 'none', true, now() + interval '30 days')
on conflict (id) do nothing;
