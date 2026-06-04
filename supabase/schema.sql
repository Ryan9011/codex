create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  content text not null check (char_length(content) between 1 and 1000),
  category text not null,
  tags text[] not null default '{}',
  mood_score integer not null default 3 check (mood_score between 1 and 5),
  meltdown integer not null default 50 check (meltdown between 1 and 100),
  anonymous_mode boolean not null default true,
  anonymous_name text not null default '匿名工位',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts
add column if not exists mood_score integer not null default 3
check (mood_score between 1 and 5);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  anonymous_mode boolean not null default true,
  anonymous_name text not null default '匿名同事',
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 80),
  details text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint report_target_required check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      split_part(new.email, '@', 1),
      '打工人'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists comments_post_id_created_at_idx on public.comments(post_id, created_at);
create index if not exists comments_user_id_idx on public.comments(user_id);
create index if not exists reactions_user_id_idx on public.reactions(user_id);
create index if not exists reports_reporter_id_idx on public.reports(reporter_id);

create or replace view public.post_feed
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.title,
  p.content,
  p.category,
  p.tags,
  p.mood_score,
  p.meltdown,
  p.anonymous_mode,
  p.anonymous_name,
  pr.username as author_username,
  case
    when p.anonymous_mode then p.anonymous_name
    else coalesce(pr.username, '已注销用户')
  end as display_name,
  coalesce(c.comment_count, 0)::integer as comment_count,
  coalesce(r.reaction_count, 0)::integer as reaction_count,
  p.created_at,
  p.updated_at
from public.posts p
left join public.profiles pr on pr.id = p.user_id
left join (
  select post_id, count(*) as comment_count
  from public.comments
  group by post_id
) c on c.post_id = p.id
left join (
  select post_id, count(*) as reaction_count
  from public.reactions
  group by post_id
) r on r.post_id = p.id;

create or replace view public.comment_feed
with (security_invoker = true)
as
select
  c.id,
  c.post_id,
  c.user_id,
  c.content,
  c.anonymous_mode,
  c.anonymous_name,
  pr.username as author_username,
  case
    when c.anonymous_mode then c.anonymous_name
    else coalesce(pr.username, '已注销用户')
  end as display_name,
  c.created_at
from public.comments c
left join public.profiles pr on pr.id = c.user_id;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.reports enable row level security;

grant select on public.profiles to anon, authenticated;
grant select on public.posts to anon, authenticated;
grant select on public.comments to anon, authenticated;
grant select on public.reactions to anon, authenticated;
grant select on public.post_feed to anon, authenticated;
grant select on public.comment_feed to anon, authenticated;

grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.posts to authenticated;
grant insert, delete on public.comments to authenticated;
grant insert, delete on public.reactions to authenticated;
grant insert, select on public.reports to authenticated;

drop policy if exists "Profiles are readable" on public.profiles;
create policy "Profiles are readable"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Posts are readable" on public.posts;
create policy "Posts are readable"
on public.posts for select
to anon, authenticated
using (true);

drop policy if exists "Users can create own posts" on public.posts;
create policy "Users can create own posts"
on public.posts for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own posts" on public.posts;
create policy "Users can update own posts"
on public.posts for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts"
on public.posts for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Comments are readable" on public.comments;
create policy "Comments are readable"
on public.comments for select
to anon, authenticated
using (true);

drop policy if exists "Users can create own comments" on public.comments;
create policy "Users can create own comments"
on public.comments for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own comments" on public.comments;
create policy "Users can delete own comments"
on public.comments for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Reactions are readable" on public.reactions;
create policy "Reactions are readable"
on public.reactions for select
to anon, authenticated
using (true);

drop policy if exists "Users can create own reactions" on public.reactions;
create policy "Users can create own reactions"
on public.reactions for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own reactions" on public.reactions;
create policy "Users can delete own reactions"
on public.reactions for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports"
on public.reports for insert
to authenticated
with check ((select auth.uid()) = reporter_id);

drop policy if exists "Users can read own reports" on public.reports;
create policy "Users can read own reports"
on public.reports for select
to authenticated
using ((select auth.uid()) = reporter_id);
