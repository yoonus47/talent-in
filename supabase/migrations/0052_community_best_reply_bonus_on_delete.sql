-- TalentZify — fixes a community_points integrity bug in
-- on_community_best_reply_points() (0031_community_round3.sql): that
-- trigger only ever fires on `update of best_reply_id`, so it reverses
-- the +10 "your reply was marked best" bonus when a thread author
-- explicitly changes/clears the pick, but never when the thread or the
-- best reply itself is *deleted* — letting a student mark a reply best,
-- then delete the thread (or just that one reply), and permanently keep
-- 10 community_points for an answer that no longer exists anywhere.
--
-- Both new triggers below fire BEFORE delete rather than after, and that
-- is the actual fix, not a style choice: an AFTER trigger here would race
-- the FK cascades already in play (community_replies.thread_id is
-- `on delete cascade`, community_threads.best_reply_id is
-- `on delete set null`) with no guaranteed ordering against them, so by
-- the time an AFTER trigger ran, the row it needs to look up (the best
-- reply's author, or the thread's best_reply_id pointer) could already be
-- gone. A BEFORE DELETE trigger runs strictly before the row is removed
-- and strictly before any cascade its removal would trigger, so neither
-- side of this can ever observe stale/missing data — see the two
-- functions' own comments for exactly which race each one avoids.

-- Path 1: the whole thread is deleted (best reply included, via cascade).
create or replace function public.reverse_best_reply_bonus_on_thread_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  best_author uuid;
begin
  if old.best_reply_id is not null then
    -- Runs before community_replies' own cascade delete for this thread
    -- has even started, so the best reply row (and its author) is still
    -- there to read — an after-the-fact lookup here would just as often
    -- find nothing, since cascade order between this row's own trigger
    -- and its children's isn't guaranteed.
    select author_id into best_author from public.community_replies where id = old.best_reply_id;
    if best_author is not null then
      perform public.award_community_points(best_author, -10);
    end if;
  end if;
  return old;
end;
$$;

create trigger community_thread_best_reply_bonus_trigger
  before delete on public.community_threads
  for each row execute function public.reverse_best_reply_bonus_on_thread_delete();

-- Path 2: just the best reply is deleted directly, thread stays. Its own
-- FK (`on delete set null`) will null out community_threads.best_reply_id
-- right after this row is actually gone, which would otherwise fire
-- on_community_best_reply_points() — but by then this exact row (the one
-- whose author it needs) no longer exists, so that path silently finds
-- nothing. Checking here instead, before the row is removed, means
-- old.author_id is just read directly off OLD, no lookup needed at all.
create or replace function public.reverse_best_reply_bonus_on_reply_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.community_threads
    where id = old.thread_id and best_reply_id = old.id
  ) then
    perform public.award_community_points(old.author_id, -10);
  end if;
  return old;
end;
$$;

create trigger community_reply_best_reply_bonus_trigger
  before delete on public.community_replies
  for each row execute function public.reverse_best_reply_bonus_on_reply_delete();

-- Note on why these two can't double-count when a whole thread (best
-- reply included) is deleted: path 1 fires first (before delete, on the
-- thread row) and does the reversal. By the time the cascade reaches the
-- best reply row itself and path 2's trigger runs, community_threads no
-- longer has a row for old.thread_id at all (the parent was already
-- removed to get here), so path 2's `exists` check is false and it
-- correctly no-ops.
