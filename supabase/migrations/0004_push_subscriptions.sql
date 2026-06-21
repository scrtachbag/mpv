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
