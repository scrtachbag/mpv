-- =============================================================================
-- MPV 0014 — réactions emoji sur les messages du chat
-- =============================================================================
create table if not exists public.message_reactions (
  id         bigint generated always as identity primary key,
  message_id bigint not null references public.messages (id) on delete cascade,
  user_id    uuid   not null references public.profiles (id) on delete cascade,
  emoji      text   not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)   -- une réaction donnée / message / joueur
);
create index if not exists reactions_message_idx on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;
drop policy if exists reactions_read       on public.message_reactions;
drop policy if exists reactions_write_own  on public.message_reactions;
drop policy if exists reactions_delete_own on public.message_reactions;
create policy reactions_read       on public.message_reactions for select using (true);
create policy reactions_write_own  on public.message_reactions for insert with check (user_id = auth.uid());
create policy reactions_delete_own on public.message_reactions for delete using (user_id = auth.uid());

grant select, insert, delete on public.message_reactions to authenticated;
grant select                 on public.message_reactions to anon;

-- payload complet sur les DELETE temps réel (sinon seul l'id serait publié).
alter table public.message_reactions replica identity full;

-- Temps réel (Supabase Realtime).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    execute 'alter publication supabase_realtime add table public.message_reactions';
  end if;
end $$;
