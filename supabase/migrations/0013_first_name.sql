-- =============================================================================
-- MPV 0013 — prénom (affiché en info-bulle au survol du pseudo)
-- =============================================================================
-- Pour savoir qui est qui quand des amis qui ne se connaissent pas jouent
-- ensemble. Champ optionnel ; renseigné à l'inscription et modifiable au profil.

alter table public.profiles add column if not exists first_name text;

-- get_leaderboard expose désormais le prénom.
drop function if exists public.get_leaderboard();
create function public.get_leaderboard()
returns table (
  user_id       uuid,
  pseudo        text,
  first_name    text,
  avatar        text,
  total_points  numeric,
  bets_count    bigint,
  scored_stages bigint,
  bonus_used    bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.pseudo,
    p.first_name,
    p.avatar,
    coalesce(sum(bs.points), 0)::numeric                    as total_points,
    count(bs.bet_id)                                        as bets_count,
    count(bs.bet_id) filter (where bs.position is not null) as scored_stages,
    count(bs.bet_id) filter (where bs.bonus_used)           as bonus_used
  from public.profiles p
  left join public.bet_scores bs on bs.user_id = p.id
  group by p.id, p.pseudo, p.first_name, p.avatar
  order by total_points desc, p.pseudo asc;
$$;
grant execute on function public.get_leaderboard() to anon, authenticated;
