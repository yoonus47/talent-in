-- TalentZify — voice messages + the free/pro account tier.
-- Run this in the Supabase SQL editor after 0022_group_icons.sql.
--
-- Two independent additions bundled together because voice messages need
-- the tier concept to exist first (retention is gated on it):
--
-- 1. profiles.tier — TalentZify's first account-tier concept. No payment
--    integration exists yet; this is deliberately just the data model,
--    set manually (service-role/SQL) until a billing flow exists.
-- 2. Voice messages: messages.content becomes conditional (text messages
--    keep needing it; voice messages carry audio_url/duration_ms instead),
--    plus a new voice-messages Storage bucket. Retention (60-day expiry
--    for free-tier senders, kept forever for pro) is a scheduled API
--    route, not SQL — see app/api/cron/expire-voice-messages/route.ts —
--    because removing a Storage *file* is done via the Storage JS API
--    (.storage.remove()), not by deleting storage.objects rows directly.

-- ── profiles.tier ────────────────────────────────────────────────────────
alter table public.profiles
  add column tier text not null default 'free' check (tier in ('free', 'pro'));

-- Without this, tier is just as writable as every other profiles column
-- under the existing "users can update their own profile" policy
-- (0001_init.sql: `using (auth.uid() = id) with check (auth.uid() = id)` —
-- row-scoped only, no column restriction) — any signed-in client could
-- self-upgrade with a plain `.update({ tier: 'pro' })`, defeating the
-- entire point of a manually-granted tier. Same column-allowlist technique
-- already used for conversations (0019/0022): revoke the table-wide grant,
-- then re-grant only the columns real app code actually writes (lib/
-- actions/profile.ts's updateProfile + uploadAvatar/removeAvatar) —
-- notably excluding tier, id, username, is_minor, created_at.
revoke update on public.profiles from authenticated;
grant update (
  first_name, last_name, full_name, avatar_url, bio, grade, school, city, state, interests
) on public.profiles to authenticated;

-- ── messages: text-or-voice shape ───────────────────────────────────────
-- Same technique as conversations_shape_check (0019_group_chats.sql) — one
-- constraint, two fully-specified valid shapes. The existing insert/select
-- RLS policies (member-gated via is_conversation_member, 0020) are
-- orthogonal to this and need no changes.
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages alter column content drop not null;
alter table public.messages add column type text not null default 'text' check (type in ('text', 'voice'));
alter table public.messages add column audio_url text;
alter table public.messages add column duration_ms integer;

alter table public.messages add constraint messages_shape_check check (
  (type = 'text' and content is not null and char_length(content) between 1 and 2000
   and audio_url is null and duration_ms is null)
  or
  (type = 'voice' and content is null and audio_url is not null
   and duration_ms is not null and duration_ms between 1 and 120000)
);

-- The retention job (app/api/cron/expire-voice-messages) scans by
-- `type = 'voice' and created_at < ...` across every conversation — the
-- existing messages_conversation_id_created_at_idx doesn't help a global
-- scan like that, so a dedicated partial index does.
create index messages_voice_retention_idx on public.messages (created_at) where type = 'voice';

-- ── voice-messages storage bucket ───────────────────────────────────────
-- Path convention: <conversation_id>/<sender_id>/<random>.<ext> — the
-- extra sender-id segment (beyond group-icons' single-segment convention)
-- is what lets the delete policy be "you can delete your own files" with
-- no membership re-check needed.
--
-- file_size_limit is a generous ceiling for a 2-minute clip at low
-- bitrate — defense in depth; the real cap is messages.duration_ms above.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-messages', 'voice-messages', true, 2097152,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/mpeg'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "voice messages are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'voice-messages');

create policy "conversation members can upload their own voice messages"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'voice-messages'
    and public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "users can delete their own voice messages"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'voice-messages' and (storage.foldername(name))[2] = auth.uid()::text);
