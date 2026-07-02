-- =============================================================================
-- MPV 0016 — confidentialité : ne compter les bonus qu'après les résultats
-- =============================================================================
-- Avant, get_leaderboard comptait un bonus dès qu'il était posé, révélant en
-- direct qu'un joueur avait parié (avec bonus) sur l'étape encore ouverte.
-- On ne le compte désormais que si l'étape a ses résultats OFFICIELS.

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
    count(bs.bet_id) filter (
      where bs.bonus_used and st.results_status = 'official'
    )                                                       as bonus_used
  from public.profiles p
  left join public.bet_scores bs on bs.user_id = p.id
  left join public.stages     st on st.id = bs.stage_id
  group by p.id, p.pseudo, p.first_name, p.avatar
  order by total_points desc, p.pseudo asc;
$$;
grant execute on function public.get_leaderboard() to anon, authenticated;
