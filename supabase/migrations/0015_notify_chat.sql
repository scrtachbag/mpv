-- =============================================================================
-- MPV 0015 — préférence "notifications de chat"
-- =============================================================================
-- Notifier (push) quand un nouveau message est posté. Envoi assuré par l'Edge
-- Function notify-chat (déclenchée par un webhook sur INSERT dans messages).
alter table public.profiles add column if not exists notify_chat boolean not null default true;
