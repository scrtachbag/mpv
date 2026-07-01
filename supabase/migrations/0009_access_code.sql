-- =============================================================================
-- MPV 0009 — code d'accès à l'inscription (cercle maîtrisé)
-- =============================================================================
-- L'appli reste "entre amis" : pour créer un compte il faut un code d'accès
-- partagé. Les codes sont stockés ici (pas dans le bundle JS public) et
-- vérifiés via la fonction check_access_code(), seule surface exposée à anon.
-- Rotation possible : ajouter/désactiver des lignes (active = false).

create table if not exists public.access_codes (
  code       text primary key,
  label      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Table NON exposée : RLS active sans policy => personne ne lit/écrit via l'API
-- (sauf service_role). La vérification passe uniquement par la fonction ci-dessous.
alter table public.access_codes enable row level security;

-- Vérifie qu'un code actif correspond (insensible à la casse / aux espaces).
-- security definer : lit la table malgré la RLS, sans l'exposer.
create or replace function public.check_access_code(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.access_codes
    where active and lower(code) = lower(btrim(coalesce(p_code, '')))
  );
$$;

revoke all on function public.check_access_code(text) from public;
grant execute on function public.check_access_code(text) to anon, authenticated;

-- Code initial (à changer : update public.access_codes ...).
insert into public.access_codes (code, label)
values ('MAILLOT-JAUNE-2026', 'Code initial — à personnaliser')
on conflict (code) do nothing;
