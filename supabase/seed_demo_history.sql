-- =============================================================================
-- DÉMO : 5 étapes passées (2 à 6) déjà résolues + un pari par joueur.
-- À lancer APRÈS que les comptes de démo existent (sinon aucun pari n'est créé).
--   docker exec -i <supabase_db_...> psql -U postgres -d postgres < seed_demo_history.sql
-- ou copier/coller dans Supabase Studio (SQL Editor).
-- Ré-exécutable (upserts). Saison 2099 = marqueur démo.
--
-- ⚠️ Les paris sont insérés en désactivant temporairement le trigger de règles
--    (les deadlines sont dans le passé : un INSERT normal serait refusé).
-- =============================================================================
begin;

-- 1) Étapes (deadline = midi Paris du jour J-n, donc passée ; résultats officiels)
insert into public.stages (season, stage_no, label, name, profile_type, date, bet_deadline, odds_status, results_status)
values
  (2099, 2, 'Étape 2', 'Sprintville → Bunchgallop', 'flat',     current_date - 1, ((current_date - 1) + time '12:00') at time zone 'Europe/Paris', 'published', 'official'),
  (2099, 3, 'Étape 3', 'Montcol → Grand Sommet',    'mountain', current_date - 2, ((current_date - 2) + time '12:00') at time zone 'Europe/Paris', 'published', 'official'),
  (2099, 4, 'Étape 4', 'Vallons → Mur final',        'hilly',    current_date - 3, ((current_date - 3) + time '12:00') at time zone 'Europe/Paris', 'published', 'official'),
  (2099, 5, 'Étape 5', 'Chrono-les-Bains (CLM)',     'itt',      current_date - 4, ((current_date - 4) + time '12:00') at time zone 'Europe/Paris', 'published', 'official'),
  (2099, 6, 'Étape 6', 'Plaine → Bord de mer',       'flat',     current_date - 5, ((current_date - 5) + time '12:00') at time zone 'Europe/Paris', 'published', 'official')
on conflict (season, stage_no) do update
  set name = excluded.name, profile_type = excluded.profile_type, date = excluded.date,
      bet_deadline = excluded.bet_deadline, odds_status = excluded.odds_status,
      results_status = excluded.results_status;

-- 2) Côtes des partants
insert into public.stage_riders (stage_id, rider_name, odds)
select s.id, v.rider, v.odds
from (values
  -- étape 2
  (2,'Jasper Philipsen',3.0),(2,'Mathieu van der Poel',5.0),(2,'Biniam Girmay',6.0),(2,'Mads Pedersen',7.0),(2,'Tadej Pogačar',9.0),(2,'Jonas Vingegaard',12.0),(2,'Remco Evenepoel',15.0),(2,'Primož Roglič',18.0),(2,'Juan Ayuso',30.0),(2,'Romain Bardet',60.0),
  -- étape 3
  (3,'Tadej Pogačar',2.0),(3,'Jonas Vingegaard',2.8),(3,'Primož Roglič',6.0),(3,'Remco Evenepoel',7.0),(3,'Juan Ayuso',15.0),(3,'David Gaudu',40.0),(3,'Romain Bardet',50.0),(3,'Mads Pedersen',200.0),(3,'Biniam Girmay',250.0),(3,'Jasper Philipsen',300.0),
  -- étape 4
  (4,'Mathieu van der Poel',4.0),(4,'Mads Pedersen',5.0),(4,'Tadej Pogačar',5.5),(4,'Remco Evenepoel',8.0),(4,'Jasper Philipsen',9.0),(4,'Biniam Girmay',12.0),(4,'Jonas Vingegaard',13.0),(4,'Primož Roglič',20.0),(4,'Juan Ayuso',25.0),(4,'Romain Bardet',40.0),
  -- étape 5 (chrono)
  (5,'Remco Evenepoel',2.5),(5,'Tadej Pogačar',3.0),(5,'Jonas Vingegaard',4.0),(5,'Primož Roglič',7.0),(5,'Juan Ayuso',20.0),(5,'David Gaudu',50.0),(5,'Romain Bardet',60.0),(5,'Mads Pedersen',80.0),(5,'Mathieu van der Poel',90.0),(5,'Jasper Philipsen',120.0),
  -- étape 6
  (6,'Jasper Philipsen',2.8),(6,'Biniam Girmay',5.0),(6,'Mathieu van der Poel',6.0),(6,'Mads Pedersen',7.0),(6,'Tadej Pogačar',10.0),(6,'Jonas Vingegaard',14.0),(6,'Remco Evenepoel',16.0),(6,'Primož Roglič',22.0),(6,'Juan Ayuso',35.0),(6,'Romain Bardet',70.0)
) v(stage_no, rider, odds)
join public.stages s on s.season = 2099 and s.stage_no = v.stage_no
on conflict (stage_id, rider_name) do update set odds = excluded.odds;

-- 3) Résultats (top 10)
insert into public.stage_results (stage_id, position, rider_name)
select s.id, v.position, v.rider
from (values
  (2,1,'Jasper Philipsen'),(2,2,'Biniam Girmay'),(2,3,'Mathieu van der Poel'),(2,4,'Mads Pedersen'),(2,5,'Tadej Pogačar'),(2,6,'Jonas Vingegaard'),(2,7,'Remco Evenepoel'),(2,8,'Primož Roglič'),(2,9,'Juan Ayuso'),(2,10,'Romain Bardet'),
  (3,1,'Jonas Vingegaard'),(3,2,'Tadej Pogačar'),(3,3,'Primož Roglič'),(3,4,'Remco Evenepoel'),(3,5,'Juan Ayuso'),(3,6,'David Gaudu'),(3,7,'Romain Bardet'),(3,8,'Mads Pedersen'),(3,9,'Biniam Girmay'),(3,10,'Jasper Philipsen'),
  (4,1,'Tadej Pogačar'),(4,2,'Mathieu van der Poel'),(4,3,'Mads Pedersen'),(4,4,'Remco Evenepoel'),(4,5,'Jasper Philipsen'),(4,6,'Biniam Girmay'),(4,7,'Jonas Vingegaard'),(4,8,'Primož Roglič'),(4,9,'Juan Ayuso'),(4,10,'Romain Bardet'),
  (5,1,'Remco Evenepoel'),(5,2,'Tadej Pogačar'),(5,3,'Jonas Vingegaard'),(5,4,'Primož Roglič'),(5,5,'Juan Ayuso'),(5,6,'David Gaudu'),(5,7,'Romain Bardet'),(5,8,'Mads Pedersen'),(5,9,'Mathieu van der Poel'),(5,10,'Jasper Philipsen'),
  (6,1,'Biniam Girmay'),(6,2,'Jasper Philipsen'),(6,3,'Mads Pedersen'),(6,4,'Mathieu van der Poel'),(6,5,'Tadej Pogačar'),(6,6,'Jonas Vingegaard'),(6,7,'Remco Evenepoel'),(6,8,'Primož Roglič'),(6,9,'Juan Ayuso'),(6,10,'Romain Bardet')
) v(stage_no, position, rider)
join public.stages s on s.season = 2099 and s.stage_no = v.stage_no
on conflict (stage_id, position) do update set rider_name = excluded.rider_name;

-- 4) Paris de chaque joueur (trigger de règles désactivé le temps du seed)
alter table public.bets disable trigger trg_bets_rules;

insert into public.bets (user_id, stage_id, rider_name, bonus_used)
select p.id, s.id, v.rider, v.bonus
from (values
  -- (stage_no, pseudo, coureur, bonus)
  (2,'TwentyCent','Jasper Philipsen',false),(2,'Bernard','Mathieu van der Poel',false),(2,'Le Blaireau','Biniam Girmay',true),(2,'Testos','Mads Pedersen',false),(2,'Admin','Tadej Pogačar',false),
  (3,'TwentyCent','Tadej Pogačar',false),(3,'Bernard','Jonas Vingegaard',true),(3,'Le Blaireau','David Gaudu',false),(3,'Testos','Primož Roglič',false),(3,'Admin','Remco Evenepoel',false),
  (4,'TwentyCent','Mathieu van der Poel',false),(4,'Bernard','Mads Pedersen',false),(4,'Le Blaireau','Romain Bardet',false),(4,'Testos','Jasper Philipsen',false),(4,'Admin','Tadej Pogačar',true),
  (5,'TwentyCent','Remco Evenepoel',false),(5,'Bernard','Tadej Pogačar',false),(5,'Le Blaireau','Jonas Vingegaard',false),(5,'Testos','Primož Roglič',true),(5,'Admin','Juan Ayuso',false),
  (6,'TwentyCent','Jasper Philipsen',false),(6,'Bernard','Biniam Girmay',false),(6,'Le Blaireau','Mathieu van der Poel',false),(6,'Testos','Mads Pedersen',false),(6,'Admin','Tadej Pogačar',false)
) v(stage_no, pseudo, rider, bonus)
join public.stages s   on s.season = 2099 and s.stage_no = v.stage_no
join public.profiles p on p.pseudo = v.pseudo
on conflict (user_id, stage_id) do update
  set rider_name = excluded.rider_name, bonus_used = excluded.bonus_used;

alter table public.bets enable trigger trg_bets_rules;

-- 5) Avatars de démo
update public.profiles set avatar = case pseudo
  when 'TwentyCent'  then 'jaune'
  when 'Bernard'     then 'grimpeur'
  when 'Le Blaireau' then 'diable'
  when 'Testos'      then 'frites'
  when 'Admin'       then 'ds'
  else avatar end
where pseudo in ('TwentyCent', 'Bernard', 'Le Blaireau', 'Testos', 'Admin');

-- 6) Quelques messages de chat (uniquement si le chat est vide)
insert into public.messages (user_id, content, created_at)
select p.id, m.content, now() - (m.mins || ' minutes')::interval
from (values
  ('Bernard',     'Vous allez tous perdre, j''ai mis un bonus sur Vinge 💪', 180),
  ('Le Blaireau', 'Didi le Diable a parlé : Pogačar écrase tout 😈',          150),
  ('Testos',      'Encore parié sur un sprinteur en montagne... 🤦',          120),
  ('Admin',       'Pensez à parier AVANT midi les amis 🚴',                    60),
  ('TwentyCent',  'Le maillot jaune me va trop bien 🟡',                       15)
) m(pseudo, content, mins)
join public.profiles p on p.pseudo = m.pseudo
where (select count(*) from public.messages) = 0;

commit;
