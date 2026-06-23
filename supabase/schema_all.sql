-- =============================================================
-- MPV — schéma complet (toutes les migrations concaténées).
-- À coller dans Supabase > SQL Editor > Run (une seule fois).
-- Source de vérité : supabase/migrations/*.sql
-- =============================================================

-- >>>>> migrations/0001_init.sql <<<<<

-- =============================================================================
-- Mon Petit Vélo (MPV) — schéma initial
-- =============================================================================
-- À exécuter sur ton projet Supabase :
--   supabase db push          (CLI)
-- ou bien copier/coller dans : Dashboard > SQL Editor.
--
-- Modèle de jeu :
--   points = côte / place finale          (place de 1 à 10)
--          × 2  si 1ᵉ de l'étape
--          × 2  si le parieur a utilisé un bonus
--          = 0  si le coureur est hors du top 10
--   - Pari à réaliser avant 12h00 (heure de Paris).
--   - 2 bonus disponibles par parieur pour tout le Tour.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Profil applicatif lié à un compte auth Supabase (email + pseudo).
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  pseudo     text not null unique,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Une étape du Tour.
create table if not exists public.stages (
  id             bigint generated always as identity primary key,
  season         int  not null,
  stage_no       int  not null,
  label          text not null,                       -- ex : "Étape 5"
  name           text,                                -- ex : "Tours → Châteauroux"
  profile_type   text,                                -- flat / hilly / mountain / itt ...
  date           date not null,
  bet_deadline   timestamptz not null,                -- date du jour à 12h00 (Europe/Paris)
  odds_status    text not null default 'pending',     -- pending / published
  results_status text not null default 'pending',     -- pending / official
  unique (season, stage_no)
);

-- Coureurs au départ d'une étape, avec leur côte (calculée chaque matin).
create table if not exists public.stage_riders (
  id          bigint generated always as identity primary key,
  stage_id    bigint not null references public.stages (id) on delete cascade,
  rider_name  text   not null,
  rider_pcs_id text,
  odds        numeric(7,2) not null check (odds >= 1.0),
  unique (stage_id, rider_name)
);

-- Résultats officiels d'une étape (positions, top 10 suffit pour le score).
create table if not exists public.stage_results (
  id         bigint generated always as identity primary key,
  stage_id   bigint not null references public.stages (id) on delete cascade,
  rider_name text   not null,
  position   int    not null check (position >= 1),
  unique (stage_id, position),
  unique (stage_id, rider_name)
);

-- Paris des participants : un seul pari par étape et par parieur.
create table if not exists public.bets (
  id         bigint generated always as identity primary key,
  user_id    uuid   not null references public.profiles (id) on delete cascade,
  stage_id   bigint not null references public.stages (id) on delete cascade,
  rider_name text   not null,
  bonus_used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, stage_id)
);

create index if not exists bets_stage_idx on public.bets (stage_id);
create index if not exists stage_riders_stage_idx on public.stage_riders (stage_id);

-- -----------------------------------------------------------------------------
-- Vues de scoring
-- -----------------------------------------------------------------------------

-- Score de chaque pari. security_invoker => la visibilité respecte les
-- politiques RLS de la table bets (on ne voit le pari d'autrui qu'après la
-- deadline de l'étape concernée).
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
    when sr.odds is null               then 0
    when res.position is null           then 0
    when res.position > 10              then 0
    else round(
           (sr.odds / res.position)
           * (case when res.position = 1 then 2 else 1 end)
           * (case when b.bonus_used     then 2 else 1 end)
         , 2)
  end as points
from public.bets b
left join public.stage_riders  sr  on sr.stage_id  = b.stage_id and sr.rider_name  = b.rider_name
left join public.stage_results res on res.stage_id = b.stage_id and res.rider_name = b.rider_name;

-- Classement agrégé public (pseudo + total), sans fuiter les pronostics
-- individuels. security definer : lit tous les paris scorés pour le total.
drop function if exists public.get_leaderboard();
create function public.get_leaderboard()
returns table (
  user_id       uuid,
  pseudo        text,
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
    coalesce(sum(bs.points), 0)::numeric            as total_points,
    count(bs.bet_id)                                as bets_count,
    count(bs.bet_id) filter (where bs.position is not null) as scored_stages
  from public.profiles p
  left join public.bet_scores bs on bs.user_id = p.id
  group by p.id, p.pseudo
  order by total_points desc, p.pseudo asc;
$$;

-- -----------------------------------------------------------------------------
-- Règles métier (triggers)
-- -----------------------------------------------------------------------------

-- Maintient updated_at.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Valide un pari : deadline, coureur valide, quota de bonus.
create or replace function public.check_bet_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deadline timestamptz;
  v_bonus_count int;
begin
  -- 1) deadline (12h00 Paris) — défense en profondeur en plus de la RLS
  select bet_deadline into v_deadline from public.stages where id = new.stage_id;
  if v_deadline is null then
    raise exception 'Étape inconnue.';
  end if;
  if now() >= v_deadline then
    raise exception 'Les paris pour cette étape sont clôturés (deadline %).', v_deadline;
  end if;

  -- 2) le coureur doit faire partie des partants cotés de l'étape
  if not exists (
    select 1 from public.stage_riders
    where stage_id = new.stage_id and rider_name = new.rider_name
  ) then
    raise exception 'Coureur "%" non disponible pour cette étape.', new.rider_name;
  end if;

  -- 3) quota : 2 bonus maximum par parieur sur tout le Tour
  if new.bonus_used then
    select count(*) into v_bonus_count
    from public.bets
    where user_id = new.user_id
      and bonus_used = true
      and id is distinct from new.id;
    if v_bonus_count >= 2 then
      raise exception 'Quota de bonus atteint (2 maximum pour tout le Tour).';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bets_touch on public.bets;
create trigger trg_bets_touch
  before update on public.bets
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_bets_rules on public.bets;
create trigger trg_bets_rules
  before insert or update on public.bets
  for each row execute function public.check_bet_rules();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.stages        enable row level security;
alter table public.stage_riders  enable row level security;
alter table public.stage_results enable row level security;
alter table public.bets          enable row level security;

-- Helper : l'utilisateur courant est-il admin ?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- profiles : lecture publique (pour afficher les pseudos), écriture de soi.
drop policy if exists profiles_read       on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_read        on public.profiles for select using (true);
create policy profiles_insert_self on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- stages / stage_riders / stage_results : lecture publique, écriture admin.
-- (Les jobs CI écrivent avec la clé service_role, qui contourne la RLS.)
drop policy if exists stages_read  on public.stages;
drop policy if exists stages_admin on public.stages;
create policy stages_read  on public.stages for select using (true);
create policy stages_admin on public.stages for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists riders_read  on public.stage_riders;
drop policy if exists riders_admin on public.stage_riders;
create policy riders_read  on public.stage_riders for select using (true);
create policy riders_admin on public.stage_riders for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists results_read  on public.stage_results;
drop policy if exists results_admin on public.stage_results;
create policy results_read  on public.stage_results for select using (true);
create policy results_admin on public.stage_results for all using (public.is_admin()) with check (public.is_admin());

-- bets :
--   - lecture : son propre pari toujours ; celui des autres seulement
--               après la deadline de l'étape (anti-triche).
--   - écriture : uniquement les siens, avant la deadline.
drop policy if exists bets_read       on public.bets;
drop policy if exists bets_insert_own on public.bets;
drop policy if exists bets_update_own on public.bets;
drop policy if exists bets_delete_own on public.bets;

create policy bets_read on public.bets for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.stages s
    where s.id = bets.stage_id and now() >= s.bet_deadline
  )
);

create policy bets_insert_own on public.bets for insert with check (
  user_id = auth.uid()
);

create policy bets_update_own on public.bets for update using (
  user_id = auth.uid()
) with check (
  user_id = auth.uid()
);

create policy bets_delete_own on public.bets for delete using (
  user_id = auth.uid()
  and exists (
    select 1 from public.stages s
    where s.id = bets.stage_id and now() < s.bet_deadline
  )
);

-- -----------------------------------------------------------------------------
-- Droits sur vues / fonctions
-- -----------------------------------------------------------------------------
-- Droits de table (la RLS restreint ensuite les LIGNES visibles/modifiables).
grant usage on schema public to anon, authenticated;
grant select on public.stages        to anon, authenticated;
grant select on public.stage_riders  to anon, authenticated;
grant select on public.stage_results to anon, authenticated;
grant select on public.profiles      to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.bets to authenticated;

grant select  on public.bet_scores to anon, authenticated;
grant execute on function public.get_leaderboard() to anon, authenticated;

-- >>>>> migrations/0002_chat_avatars.sql <<<<<

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

-- >>>>> migrations/0003_delete_account.sql <<<<<

-- =============================================================================
-- MPV 0003 — suppression de son propre compte
-- =============================================================================
-- Un utilisateur connecté supprime SON compte. La suppression de la ligne
-- auth.users entraîne en cascade la suppression du profil, des paris et des
-- messages (FK ... on delete cascade).

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Non authentifié.';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- >>>>> migrations/0004_push_subscriptions.sql <<<<<

-- =============================================================================
-- MPV 0004 — abonnements aux notifications push (Web Push)
-- =============================================================================
-- Chaque navigateur autorisé crée un abonnement (endpoint + clés). Le job de
-- rappel (notify_reminder.py) lit ces abonnements via la clé service_role.

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_sub_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_select_own on public.push_subscriptions;
drop policy if exists push_insert_own on public.push_subscriptions;
drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_select_own on public.push_subscriptions for select using (user_id = auth.uid());
create policy push_insert_own on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy push_delete_own on public.push_subscriptions for delete using (user_id = auth.uid());

grant select, insert, delete on public.push_subscriptions to authenticated;

-- >>>>> migrations/0005_service_role_grants.sql <<<<<

-- =============================================================================
-- MPV 0005 — privilèges pour le rôle service_role (utilisé par les jobs)
-- =============================================================================
-- En prod Supabase, service_role reçoit ces privilèges par défaut ; on les
-- rend explicites pour que les jobs fonctionnent aussi en local. service_role
-- contourne la RLS (BYPASSRLS) : il voit/écrit toutes les lignes.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables    in schema public to service_role;
grant usage, select                  on all sequences in schema public to service_role;
grant execute                        on all functions in schema public to service_role;

-- Objets créés ultérieurement.
alter default privileges in schema public grant select, insert, update, delete on tables    to service_role;
alter default privileges in schema public grant usage, select                  on sequences to service_role;

-- >>>>> migrations/0006_score_name_case.sql <<<<<

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

-- >>>>> migrations/0007_leaderboard_bonus.sql <<<<<

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

-- >>>>> migrations/0008_rider_meta.sql <<<<<

-- =============================================================================
-- MPV 0008 — métadonnées coureur sur les partants (drapeau + équipe)
-- =============================================================================
alter table public.stage_riders add column if not exists nationality text;  -- code ISO2 (fr, be, sl…)
alter table public.stage_riders add column if not exists team text;         -- nom d'équipe PCS
