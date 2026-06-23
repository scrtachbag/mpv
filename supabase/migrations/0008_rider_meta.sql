-- =============================================================================
-- MPV 0008 — métadonnées coureur sur les partants (drapeau + équipe)
-- =============================================================================
alter table public.stage_riders add column if not exists nationality text;  -- code ISO2 (fr, be, sl…)
alter table public.stage_riders add column if not exists team text;         -- nom d'équipe PCS
