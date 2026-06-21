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
