-- =============================================================================
-- MPV 0011 — drapeaux « déjà notifié » par étape (anti-spam des push)
-- =============================================================================
-- Chaque transition (paris ouverts / fermés / résultats) ne doit être notifiée
-- qu'une seule fois, même si les jobs (surtout results, qui "poll") tournent
-- plusieurs fois. On mémorise l'envoi par étape.

alter table public.stages add column if not exists notified_open    boolean not null default false;
alter table public.stages add column if not exists notified_close   boolean not null default false;
alter table public.stages add column if not exists notified_results boolean not null default false;

-- Les étapes déjà en base sont considérées « déjà notifiées » : évite un envoi
-- massif rétroactif au moment du déploiement.
update public.stages set notified_open = true, notified_close = true, notified_results = true;
