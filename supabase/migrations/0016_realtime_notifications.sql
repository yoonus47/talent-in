-- TalentZify — live notification badge.
-- Run this in the Supabase SQL editor after 0015_direct_messages.sql.
--
-- Required for postgres_changes subscriptions on notifications to fire at
-- all (same requirement as messages/conversation_reads in migration 0015).
-- Without this, the bell badge only updates on next page load/refresh —
-- exactly the gap this migration closes.
alter publication supabase_realtime add table public.notifications;
