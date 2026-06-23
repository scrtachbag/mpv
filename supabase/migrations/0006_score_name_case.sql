-- =============================================================================
-- MPV 0006 — scoring insensible à la casse sur le nom du coureur
-- =============================================================================
-- PCS renvoie les noms en casse différente entre la startlist
-- ("VAN DER POEL Mathieu") et les résultats ("van der Poel Mathieu").
-- La jointure paris↔résultats doit donc comparer en minuscules, sinon le
-- coureur est vu "hors classement" et marque 0.

create or replace view public.bet_scores
with (security_invoker = true) as
select
  b.id          as bet_id,
  b.user_id,
  b.stage_id,
  b.rider_name,
  b.bonus_used,
  sr.odds,
  res.position,
  case
    when sr.odds is null      then 0
    when res.position is null then 0
    when res.position > 10    then 0
    else round(
           (sr.odds / res.position)
           * (case when res.position = 1 then 2 else 1 end)
           * (case when b.bonus_used     then 2 else 1 end)
         , 2)
  end as points
from public.bets b
left join public.stage_riders  sr  on sr.stage_id  = b.stage_id
                                   and sr.rider_name = b.rider_name
left join public.stage_results res on res.stage_id = b.stage_id
                                   and lower(res.rider_name) = lower(b.rider_name);
