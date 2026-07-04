-- =============================================================================
-- MPV 0017 — admin : rouvrir / fermer les paris de l'étape du jour
-- =============================================================================
-- Deux RPC réservées à l'admin, agissant UNIQUEMENT sur l'étape datée
-- d'aujourd'hui (heure de Paris) et seulement si les résultats ne sont pas
-- encore officiels. N'affecte pas les étapes suivantes (deadline normale).

create or replace function public.admin_reopen_bets(p_time text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare today date := (timezone('Europe/Paris', now()))::date;
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'Réservé à l''admin.';
  end if;
  update public.stages
     set bet_deadline = (today + p_time::time) at time zone 'Europe/Paris'
   where date = today and results_status <> 'official';
end $$;

create or replace function public.admin_close_bets()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare today date := (timezone('Europe/Paris', now()))::date;
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'Réservé à l''admin.';
  end if;
  update public.stages
     set bet_deadline = now() - interval '1 minute'
   where date = today and results_status <> 'official';
end $$;

revoke all on function public.admin_reopen_bets(text) from public, anon;
revoke all on function public.admin_close_bets()      from public, anon;
grant execute on function public.admin_reopen_bets(text) to authenticated;
grant execute on function public.admin_close_bets()      to authenticated;
