-- 年代区分（同年代・近接年代どうしのマッチング。lib/matching/score.ts の ageGroup）
-- 001〜003 を実行済みのDBにも流せるよう、add column if not exists にしてある。

alter table public.profiles
  add column if not exists age_group text;

-- 既存の CHECK 制約がある場合は再作成して拡張（中学生・高校生・大学生・大学院生・社会人・その他）
alter table public.profiles
  drop constraint if exists profiles_age_group_check;

alter table public.profiles
  add constraint profiles_age_group_check
  check (age_group in ('junior_high', 'high_school', 'university', 'graduate', 'working', 'other'));

-- デモ用ユーザーは大学生
update public.profiles set age_group = 'university' where is_demo and age_group is null;

-- 一度選んだ年代は変えられない（自己申告でも、別の年代の人とつながるために変えられないようにする）。
-- 変えたいときは、全データ削除からやり直す。
create or replace function public.prevent_age_group_change()
returns trigger
language plpgsql
as $$
begin
  if old.age_group is not null and new.age_group is distinct from old.age_group then
    raise exception 'age_group cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_age_change on public.profiles;
create trigger profiles_prevent_age_change
  before update on public.profiles
  for each row execute function public.prevent_age_group_change();
