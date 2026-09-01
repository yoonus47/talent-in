-- TalentZify — LinkedIn-style comment replies, @mentions, and comment
-- reactions. Run this in the Supabase SQL editor after
-- 0009_posts_image_url_update.sql.

-- ── one level of replies ────────────────────────────────────────────────
-- null = top-level comment. A reply's parent must itself be a top-level
-- comment in practice (enforced by the app, not the DB — keeping this a
-- plain self-FK rather than a stricter constraint, consistent with how
-- lightly this schema is normalized elsewhere).
alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_parent_comment_id_idx
  on public.comments (parent_comment_id);

-- ── @mentions ────────────────────────────────────────────────────────────
-- Captured at write time from the mention autocomplete's actual
-- selections — used only to drive notifications reliably. Rendering
-- "@username" as a link is a pure regex over `content` at display time
-- (usernames are immutable here), so this column is never read back for
-- display, only for who-to-notify.
alter table public.comments
  add column if not exists mentioned_user_ids uuid[] not null default '{}';

-- ── comment reactions ────────────────────────────────────────────────────
-- Same shape as `reactions` (post reactions), one level down.
create table if not exists public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('fire', 'cheers', 'smart', 'respect')),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists comment_reactions_comment_id_idx
  on public.comment_reactions (comment_id);

alter table public.comment_reactions enable row level security;

create policy "comment reactions are readable by authenticated users"
  on public.comment_reactions for select
  to authenticated
  using (true);

create policy "users can react to comments as themselves"
  on public.comment_reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can change their own comment reaction"
  on public.comment_reactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can remove their own comment reaction"
  on public.comment_reactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── notifications: reply / mention / comment_reaction ───────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('follow', 'reaction', 'comment', 'share', 'reply', 'mention', 'comment_reaction'));

alter table public.notifications
  add column if not exists comment_id uuid references public.comments(id) on delete cascade;
