-- =============================================================================
-- MPV 0019 — paris à l'avance : autoriser le pré-choix sur une étape non cotée
-- =============================================================================
-- La règle « le coureur doit faire partie des partants cotés » bloquait TOUT
-- pari sur une étape 'pending' (pré-créée pour les paris à l'avance), qui n'a
-- pas encore de stage_riders. On ne l'applique désormais QUE si l'étape est déjà
-- cotée (a des stage_riders) ; sur une étape non cotée, le pré-choix est libre
-- (le front valide le coureur contre la startlist). Les règles deadline (#1) et
-- quota de bonus (#3) restent inchangées.

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
  -- 1) deadline — défense en profondeur en plus de la RLS
  select bet_deadline into v_deadline from public.stages where id = new.stage_id;
  if v_deadline is null then
    raise exception 'Étape inconnue.';
  end if;
  if now() >= v_deadline then
    raise exception 'Les paris pour cette étape sont clôturés (deadline %).', v_deadline;
  end if;

  -- 2) coureur valide — UNIQUEMENT si l'étape est déjà cotée (a des stage_riders).
  --    Sur une étape non cotée (pré-choix / paris à l'avance), la liste des
  --    partants n'existe pas encore : on laisse passer.
  if exists (select 1 from public.stage_riders where stage_id = new.stage_id) then
    if not exists (
      select 1 from public.stage_riders
      where stage_id = new.stage_id and rider_name = new.rider_name
    ) then
      raise exception 'Coureur "%" non disponible pour cette étape.', new.rider_name;
    end if;
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
