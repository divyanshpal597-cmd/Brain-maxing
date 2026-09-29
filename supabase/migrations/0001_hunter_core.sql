-- HUNTER SYSTEM core schema. Every table is owner-scoped via RLS on auth.uid().

create type hunter_rank as enum ('E', 'D', 'C', 'B', 'A', 'S');
create type quest_category as enum ('strength', 'agility', 'endurance', 'perception');
create type loot_rarity as enum ('common', 'rare', 'legendary');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Hunter',
  level int not null default 1 check (level between 1 and 100),
  rank hunter_rank not null default 'E',
  current_xp int not null default 0 check (current_xp >= 0),
  total_xp bigint not null default 0 check (total_xp >= 0),
  unallocated_points int not null default 0 check (unallocated_points >= 0),
  streak_current int not null default 0,
  streak_best int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  str int not null default 10,
  agi int not null default 10,
  "end" int not null default 10,
  per int not null default 10,
  updated_at timestamptz not null default now()
);

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quest_day date not null,
  template_id text not null,
  title text not null,
  category quest_category not null,
  unit text not null,
  target_value numeric not null check (target_value > 0),
  current_value numeric not null default 0,
  is_completed boolean not null default false,
  xp_reward int not null,
  unique (user_id, quest_day, template_id)
);

create table public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null, -- quest_progress | xp_gain | stat_allocate | penalty_start | penalty_survive | loot
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rarity loot_rarity not null,
  kind text not null,
  name text not null,
  xp_bonus numeric,
  obtained_at timestamptz not null default now()
);

create index quests_user_day_idx on public.quests (user_id, quest_day);
create index logs_user_created_idx on public.logs (user_id, created_at desc);
create index inventory_user_idx on public.inventory (user_id);

alter table public.profiles enable row level security;
alter table public.stats enable row level security;
alter table public.quests enable row level security;
alter table public.logs enable row level security;
alter table public.inventory enable row level security;

create policy "own profile" on public.profiles
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "own stats" on public.stats
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own quests" on public.quests
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Logs are append-only from the client.
create policy "read own logs" on public.logs
  for select using ((select auth.uid()) = user_id);
create policy "insert own logs" on public.logs
  for insert with check ((select auth.uid()) = user_id);
create policy "own inventory" on public.inventory
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Bootstrap profile + stats rows on sign-up.
create function public.handle_new_hunter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.stats (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_hunter();
