-- TalentZify — add a heart/love reaction, Instagram's default double-tap
-- reaction, alongside the existing fire/cheers/smart/respect set.
-- Run this in the Supabase SQL editor after 0010_comment_threads_and_reactions.sql.

alter table public.reactions drop constraint if exists reactions_reaction_type_check;
alter table public.reactions
  add constraint reactions_reaction_type_check
  check (reaction_type in ('heart', 'fire', 'cheers', 'smart', 'respect'));

alter table public.comment_reactions drop constraint if exists comment_reactions_reaction_type_check;
alter table public.comment_reactions
  add constraint comment_reactions_reaction_type_check
  check (reaction_type in ('heart', 'fire', 'cheers', 'smart', 'respect'));
