-- =============================================================================
-- MPV 0010 — points ×10 (scores plus « sympas »)
-- =============================================================================
-- Même côtes, même formule (côte / place, ×2 si 1er, ×2 si bonus, 0 hors top 10),
-- mais multipliés par 10 pour des totaux plus lisibles/motivants.

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
           * 10
         , 2)
  end as points
from public.bets b
left join public.stage_riders  sr  on sr.stage_id  = b.stage_id
                                   and sr.rider_name = b.rider_name
left join public.stage_results res on res.stage_id = b.stage_id
                                   and lower(res.rider_name) = lower(b.rider_name);
