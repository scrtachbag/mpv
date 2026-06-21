-- =============================================================================
-- Données de DÉMO pour le développement local.
-- Exécuté automatiquement par `supabase start` / `supabase db reset`.
-- N'EST PAS destiné à la production (saison 2099 = marqueur démo).
-- =============================================================================

-- Une étape "du jour" ouverte aux paris (deadline = demain midi, donc toujours
-- ouverte pendant ta session de test).
insert into public.stages (season, stage_no, label, name, profile_type, date, bet_deadline, odds_status)
values (
  2099, 1, 'Étape démo', 'Démoville → Testbourg', 'flat',
  current_date,
  ((current_date + 1)::timestamp at time zone 'Europe/Paris'),  -- demain 00:00 Paris (large)
  'published'
)
on conflict (season, stage_no) do update
  set date = excluded.date,
      bet_deadline = excluded.bet_deadline,
      odds_status = excluded.odds_status;

-- Coureurs + côtes de démo, rattachés à l'étape ci-dessus.
with s as (select id from public.stages where season = 2099 and stage_no = 1)
insert into public.stage_riders (stage_id, rider_name, odds)
select s.id, r.name, r.odds
from s, (values
  ('Tadej Pogačar',      2.50),
  ('Jonas Vingegaard',   3.50),
  ('Remco Evenepoel',    7.00),
  ('Primož Roglič',      9.00),
  ('Jasper Philipsen',  12.00),
  ('Mathieu van der Poel', 15.00),
  ('Mads Pedersen',     18.00),
  ('Biniam Girmay',     20.00),
  ('Juan Ayuso',        25.00),
  ('David Gaudu',       50.00),
  ('Romain Bardet',     60.00),
  ('Magnus Cort',       80.00),
  ('Anthony Turgis',   150.00)
) as r(name, odds)
on conflict (stage_id, rider_name) do update set odds = excluded.odds;
