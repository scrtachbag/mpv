-- =============================================================================
-- Données de DÉMO pour le développement local.
-- Exécuté automatiquement par `supabase start` / `supabase db reset`.
-- N'EST PAS destiné à la production (saison 2099 = marqueur démo).
--
-- Crée l'ÉTAPE DU JOUR, ouverte aux paris (étape 7). Les étapes passées de
-- test (2 à 6) et leurs paris sont dans seed_demo_history.sql.
-- =============================================================================

-- Étape du jour, ouverte (deadline = demain 00:00 Paris, donc ouverte toute la journée).
insert into public.stages (season, stage_no, label, name, profile_type, date, bet_deadline, odds_status, results_status)
values (
  2099, 7, 'Étape 7', 'Bourg-d''Oisans → Alpe d''Huez', 'mountain',
  current_date,
  ((current_date + 1)::timestamp at time zone 'Europe/Paris'),
  'published', 'pending'
)
on conflict (season, stage_no) do update
  set name = excluded.name, profile_type = excluded.profile_type, date = excluded.date,
      bet_deadline = excluded.bet_deadline, odds_status = excluded.odds_status,
      results_status = 'pending';

-- Coureurs + côtes du jour (étape de montagne).
with s as (select id from public.stages where season = 2099 and stage_no = 7)
insert into public.stage_riders (stage_id, rider_name, odds)
select s.id, r.name, r.odds
from s, (values
  ('Tadej Pogačar',         2.10),
  ('Jonas Vingegaard',      2.80),
  ('Primož Roglič',         6.50),
  ('Remco Evenepoel',       7.50),
  ('Juan Ayuso',           16.00),
  ('David Gaudu',          28.00),
  ('Romain Bardet',        45.00),
  ('Mathieu van der Poel',120.00),
  ('Mads Pedersen',       150.00),
  ('Biniam Girmay',       220.00),
  ('Jasper Philipsen',    260.00)
) as r(name, odds)
on conflict (stage_id, rider_name) do update set odds = excluded.odds;
