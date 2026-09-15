-- TalentZify — Community: v1, a first pass at Facebook-groups-style
-- topic threads. Run this in the Supabase SQL editor after
-- 0027_challenge_explanations.sql.
--
-- Modeled directly on this codebase's existing posts/comments pattern —
-- same RLS shape (open select, insert-as-self, author-only delete, never
-- update), same Server Action style (lib/actions/community.ts) — not
-- chat's direct-client-insert exception, since there's no realtime/
-- latency need here.
--
-- Explicit v1 cuts, not oversights: no reactions on threads/replies, no
-- reply-to-reply nesting (one flat discussion per thread, like a comment
-- section), no notifications for new replies (would need extending
-- notifications/lib/notify.ts for a new reference column — deferred), no
-- user-created topics/groups (a curated, fixed list only, to avoid empty/
-- spam topics before there's a real community to fill them). All
-- reasonable next steps once this first pass is in front of the user.

-- ── community_topics ────────────────────────────────────────────────────
create table public.community_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  "order" smallint not null,
  created_at timestamptz not null default now()
);

alter table public.community_topics enable row level security;

-- Curated, not user-created — select-only, no insert policy. Same spirit
-- as quiz_questions/content_items ("managed via the dashboard, not a
-- public admin UI") in 0001_init.sql.
create policy "community topics are readable by authenticated users"
  on public.community_topics for select
  to authenticated
  using (true);

insert into public.community_topics (slug, name, description, "order") values
  ('career-advice', 'Career Advice', 'Stream choices, career paths, and "what should I even do" panic.', 1),
  ('study-tips', 'Study Tips & Exam Prep', 'What actually works when exams are close.', 2),
  ('tech-coding', 'Tech & Coding', 'Learning to code, projects, tools, and rabbit holes.', 3),
  ('college-apps', 'College Applications', 'Applications, essays, entrance exams, deadlines.', 4),
  ('clubs-extracurriculars', 'Clubs & Extracurriculars', 'Clubs, competitions, and hobbies worth mentioning.', 5),
  ('just-chatting', 'Just Chatting', 'Anything else — introduce yourself, vent, ask around.', 6);

-- ── community_threads ───────────────────────────────────────────────────
create table public.community_threads (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.community_topics(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 3000),
  -- Maintained ONLY by sync_community_thread_activity() below — never a
  -- client-writable column (no update policy on this table at all, same
  -- "never trust a client-writable derived metric" reasoning as the chat
  -- reply/mention trigger, 0026_chat_reply_and_mentions.sql).
  reply_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.community_threads enable row level security;

create index community_threads_topic_activity_idx
  on public.community_threads (topic_id, last_activity_at desc);

create policy "community threads are readable by authenticated users"
  on public.community_threads for select
  to authenticated
  using (true);

create policy "users can start threads as themselves"
  on public.community_threads for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "authors can delete their own threads"
  on public.community_threads for delete
  to authenticated
  using (auth.uid() = author_id);

-- No update policy — a thread is immutable once posted, same convention
-- comments already use (Update: never in lib/types/database.ts).

-- ── community_replies ───────────────────────────────────────────────────
create table public.community_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.community_replies enable row level security;

create index community_replies_thread_id_idx on public.community_replies (thread_id, created_at);

create policy "community replies are readable by authenticated users"
  on public.community_replies for select
  to authenticated
  using (true);

create policy "users can reply as themselves"
  on public.community_replies for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "authors can delete their own replies"
  on public.community_replies for delete
  to authenticated
  using (auth.uid() = author_id);

-- ── keep community_threads.reply_count/last_activity_at in sync ────────
-- SECURITY DEFINER so it can update community_threads despite that table
-- having no client-facing update policy at all — same trigger shape as
-- promote_next_admin (0019_group_chats.sql) / the reply-snapshot trigger
-- (0026_chat_reply_and_mentions.sql).
create or replace function public.sync_community_thread_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_threads
      set reply_count = reply_count + 1, last_activity_at = now()
      where id = new.thread_id;
  elsif tg_op = 'DELETE' then
    update public.community_threads
      set reply_count = greatest(0, reply_count - 1)
      where id = old.thread_id;
  end if;
  return null;
end;
$$;

create trigger sync_community_thread_activity_trigger
  after insert or delete on public.community_replies
  for each row execute function public.sync_community_thread_activity();
