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
