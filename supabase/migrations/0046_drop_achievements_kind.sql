-- Achievement vs. Certificate turned out to be a distinction without a
-- difference (0045_achievements.sql) — the field only ever changed an
-- icon and a form placeholder, nothing structural, so it was just an
-- extra decision for no real payoff. Dropped now, while the table is
-- brand new with no meaningful production data, rather than left as a
-- vestigial unused column.
alter table public.achievements drop column kind;
