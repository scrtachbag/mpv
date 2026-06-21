-- =============================================================================
-- MPV 0002 — avatars + chat (temps réel)
-- =============================================================================

-- --- Avatars ----------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar text not null default 'sprinteur';

-- --- Chat -------------------------------------------------------------------
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  user_id    uuid   not null references public.profiles (id) on delete cascade,
  content    text   not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at);

alter table public.messages enable row level security;

drop policy if exists messages_read       on public.messages;
drop policy if exists messages_insert_own on public.messages;
create policy messages_read       on public.messages for select using (true);
create policy messages_insert_own on public.messages for insert with check (user_id = auth.uid());

grant select, insert on public.messages to authenticated;
grant select         on public.messages to anon;

-- Temps réel (Supabase Realtime).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- --- Classement : on ajoute l'avatar -----------------------------------------
drop function if exists public.get_leaderboard();
create function public.get_leaderboard()
returns table (
  user_id       uuid,
  pseudo        text,
  avatar        text,
  total_points  numeric,
  bets_count    bigint,
  scored_stages bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.pseudo,
    p.avatar,
    coalesce(sum(bs.points), 0)::numeric                    as total_points,
    count(bs.bet_id)                                        as bets_count,
    count(bs.bet_id) filter (where bs.position is not null) as scored_stages
  from public.profiles p
  left join public.bet_scores bs on bs.user_id = p.id
  group by p.id, p.pseudo, p.avatar
  order by total_points desc, p.pseudo asc;
$$;
grant execute on function public.get_leaderboard() to anon, authenticated;
