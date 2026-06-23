-- =============================================================================
-- MPV 0007 — le classement expose le nombre de bonus utilisés (pour afficher
-- les bonus restants, visuellement, côté front).
-- =============================================================================

drop function if exists public.get_leaderboard();
create function public.get_leaderboard()
returns table (
  user_id       uuid,
  pseudo        text,
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
    p.avatar,
    coalesce(sum(bs.points), 0)::numeric                    as total_points,
    count(bs.bet_id)                                        as bets_count,
    count(bs.bet_id) filter (where bs.position is not null) as scored_stages,
    count(bs.bet_id) filter (where bs.bonus_used)           as bonus_used
  from public.profiles p
  left join public.bet_scores bs on bs.user_id = p.id
  group by p.id, p.pseudo, p.avatar
  order by total_points desc, p.pseudo asc;
$$;
grant execute on function public.get_leaderboard() to anon, authenticated;
