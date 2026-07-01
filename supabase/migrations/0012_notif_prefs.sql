-- =============================================================================
-- MPV 0012 — préférences de notification par utilisateur + intro vue
-- =============================================================================
-- Chaque joueur peut activer/désactiver chaque type de notification, ou tout
-- couper (notify_enabled). Par défaut : tout activé (opt-out).
-- seen_intro : l'onglet Règles n'est ouvert qu'à la toute première connexion
-- (par COMPTE, fiable même en navigation privée / PWA).

alter table public.profiles add column if not exists seen_intro      boolean not null default false;
alter table public.profiles add column if not exists notify_enabled  boolean not null default true;
alter table public.profiles add column if not exists notify_open     boolean not null default true;
alter table public.profiles add column if not exists notify_reminder boolean not null default true;
alter table public.profiles add column if not exists notify_close    boolean not null default true;
alter table public.profiles add column if not exists notify_results  boolean not null default true;

-- Comptes déjà existants : considérés comme ayant déjà vu l'intro (pas de
-- redirection vers les Règles à leur prochaine connexion).
update public.profiles set seen_intro = true;
