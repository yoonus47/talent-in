-- TalentZify — Word of the Day pronunciation: phonetic spelling + audio.
-- Run this in the Supabase SQL editor after 0017_link_previews.sql, then
-- re-run seed.sql (the vocabulary_words pool grew from 15 to ~100), then
-- run `node scripts/enrich-vocabulary.mjs` locally to fill the new
-- columns from the Free Dictionary API.

-- ── vocabulary_words: pronunciation columns ────────────────────────────
-- All nullable and populated by scripts/enrich-vocabulary.mjs, not the
-- app — it hits the (flaky, community-run) Free Dictionary API once,
-- offline, and re-hosts the audio in our own bucket so the dashboard
-- never depends on that API at request time. `source_url` is the
-- per-word Wiktionary page, kept for CC BY-SA attribution. `enriched_at`
-- marks a row as processed even when the API had nothing for it, so a
-- plain re-run doesn't keep retrying it (`--force` re-checks).
alter table public.vocabulary_words
  add column if not exists phonetic text,
  add column if not exists audio_url text,
  add column if not exists source_url text,
  add column if not exists enriched_at timestamptz;

-- ── word-audio storage bucket ─────────────────────────────────────────
-- Public read; same shape as the post-images bucket (0008). No
-- insert/update/delete policies: the only writer is the enrichment
-- script, which runs as the service role and bypasses RLS entirely.
-- Pronunciation clips are never user-generated, so there's no
-- per-user-folder ownership to enforce.
insert into storage.buckets (id, name, public)
values ('word-audio', 'word-audio', true)
on conflict (id) do nothing;

create policy "word audio is publicly accessible"
  on storage.objects for select
  using (bucket_id = 'word-audio');
