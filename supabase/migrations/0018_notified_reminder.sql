-- =============================================================================
-- MPV 0018 — drapeau "rappel envoyé" par étape (anti-spam du tick de l'après-midi)
-- =============================================================================
alter table public.stages add column if not exists notified_reminder boolean not null default false;

-- Étapes déjà en base : considérées "rappel déjà envoyé" (pas d'envoi rétroactif).
update public.stages set notified_reminder = true;
