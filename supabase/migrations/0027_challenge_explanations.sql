-- TalentZify — daily challenge answer reveal + a bigger question pool.
-- Run this in the Supabase SQL editor after 0026_chat_reply_and_mentions.sql.
--
-- Adds a short explanation shown alongside the correct answer once the
-- user has already submitted today's challenge (lib/actions/challenge.ts's
-- submitDailyChallenge / components/daily-challenge.tsx's results view).
-- This does NOT weaken the existing "never expose the answer key before
-- grading" design — get_daily_challenge() (0002_dashboard_and_share.sql)
-- is untouched and still sends no correct_index; only submit_daily_
-- challenge()'s per-question RESULT (already post-submission, already the
-- one place correctness is revealed) gains two more fields.

alter table public.challenge_questions add column explanation text not null default '';

-- Backfills the ~20 questions already seeded (supabase/seed.sql) so
-- nothing ships with a blank explanation. Matched by exact question text
-- (stable — nothing else keys off it, and it's the only handle a
-- migration has back to specific seeded rows).
update public.challenge_questions set explanation =
  '2x = 12, so x = 6. Algebra is just detective work with numbers.'
  where question = 'What is the value of x in 2x + 5 = 17?';
update public.challenge_questions set explanation =
  '12 x 12 = 144 - also why a dozen dozens sounds like a lot, because it is.'
  where question = 'What is the square root of 144?';
-- This question's correct_index was wrong in the original seed data (0,
-- "50 km/h") - 300 / 5 is 60, not 50. Fixing the actual error here, not
-- just adding an explanation for the wrong answer.
update public.challenge_questions set
  correct_index = 2,
  explanation = '300 km / 5 h = 60 km/h. (This one briefly had the wrong answer marked as correct - fixed now.)'
  where question = 'A train travels 300 km in 5 hours. What is its average speed?';
update public.challenge_questions set explanation =
  'Pi is about 3.14159..., which rounds to 3.14 - the reason March 14th (3/14) is Pi Day.'
  where question = 'What is the value of pi (π), rounded to two decimal places?';
update public.challenge_questions set explanation =
  'Angles in a triangle always add up to 180°. 90 + 45 = 135, so the last one has to be 45°.'
  where question = 'If a triangle has angles of 90° and 45°, what is the third angle?';
update public.challenge_questions set explanation =
  '15% of 200 is 10% (20) plus half of that again (10) - 30 total.'
  where question = 'What is 15% of 200?';
update public.challenge_questions set explanation =
  'Mitochondria convert food into usable energy (ATP) - the cell''s actual power plant.'
  where question = 'What is the powerhouse of the cell?';
update public.challenge_questions set explanation =
  'Plants pull in CO2 and release oxygen during photosynthesis - the opposite of what we do when we breathe.'
  where question = 'Which gas do plants absorb from the atmosphere for photosynthesis?';
update public.challenge_questions set explanation =
  'Na comes from natrium, sodium''s Latin-ish name - chemistry loves an old nickname.'
  where question = 'What is the chemical symbol for Sodium?';
update public.challenge_questions set explanation =
  'Gravity pulls everything toward Earth''s center, which is also why "up" takes effort and "down" doesn''t.'
  where question = 'What force pulls objects toward the center of the Earth?';
update public.challenge_questions set explanation =
  'Ampere (A) measures electric current - how much charge flows past a point per second.'
  where question = 'What is the SI unit of electric current?';
update public.challenge_questions set explanation =
  'The heart pumps blood through your entire body, around 100,000 times a day without a lunch break.'
  where question = 'Which part of the human body is primarily responsible for pumping blood?';
update public.challenge_questions set explanation =
  'Ubiquitous means seemingly everywhere at once - like phone chargers you can never find.'
  where question = 'What does "ubiquitous" mean?';
update public.challenge_questions set explanation =
  'Eloquent describes speech that''s fluent, clear, and genuinely persuasive.'
  where question = 'Someone who is "eloquent" is best described as:';
update public.challenge_questions set explanation =
  'Pragmatic means sensible and realistic - choosing what actually works over what just sounds nice.'
  where question = 'If a plan is "pragmatic", it is:';
update public.challenge_questions set explanation =
  'Procrastinate means to delay something you know you should be doing (we see you, 11pm essay writers).'
  where question = 'To "procrastinate" means to:';
update public.challenge_questions set explanation =
  'Meticulous people notice the details everyone else skims past.'
  where question = 'A "meticulous" person pays close attention to:';
update public.challenge_questions set explanation =
  'Resilient means bouncing back from setbacks instead of staying down - a genuinely useful life skill.'
  where question = 'Being "resilient" means you:';
update public.challenge_questions set explanation =
  'Concise means saying exactly what''s needed and nothing more - the opposite of this sentence if it kept going.'
  where question = 'A "concise" explanation is:';
update public.challenge_questions set explanation =
  'Arbitrary means based on random choice rather than a real reason - like most Wi-Fi passwords.'
  where question = 'If something is "arbitrary", it is:';

-- New questions - roughly doubles the pool (existing subjects only, no
-- schema/type change needed). get_daily_challenge() already picks 5 per
-- day from the whole table, so this alone improves day-to-day variety.
insert into public.challenge_questions (subject, question, options, correct_index, explanation) values
('math', 'What is 7² − 3²?', '["30", "35", "40", "45"]'::jsonb, 2,
 '49 − 9 = 40. Shortcut: (7−3)(7+3) = 4 × 10 = 40.'),
('math', 'Simplify: 3/4 + 1/8', '["7/8", "5/8", "1", "9/8"]'::jsonb, 0,
 'Common denominator 8: 6/8 + 1/8 = 7/8.'),
('math', 'What is the next number in the sequence: 2, 6, 18, 54, ...?', '["108", "150", "162", "216"]'::jsonb, 2,
 'Each term is triple the last - 54 × 3 = 162.'),
('math', 'A shirt priced ₹800 is on sale for 25% off. What''s the sale price?', '["₹600", "₹650", "₹700", "₹750"]'::jsonb, 0,
 '25% off ₹800 knocks off ₹200, leaving ₹600.'),
('math', 'What is the area of a circle with radius 7 cm? (use π ≈ 22/7)', '["144 cm²", "154 cm²", "164 cm²", "174 cm²"]'::jsonb, 1,
 'Area = πr² = (22/7) × 49 = 154 cm² - the 7s cancel nicely with 22/7.'),
('math', 'What is the median of 4, 8, 15, 16, 23?', '["8", "15", "16", "23"]'::jsonb, 1,
 'With 5 numbers sorted in order, the median is just the middle one: 15.'),
('math', 'If log₁₀(100) = x, what is x?', '["1", "2", "10", "100"]'::jsonb, 1,
 '100 = 10², so log₁₀(100) = 2.'),
('math', 'What is the least common multiple (LCM) of 4 and 6?', '["8", "12", "16", "24"]'::jsonb, 1,
 '12 is the smallest number both 4 and 6 divide into evenly.'),
('math', 'A die is rolled once. What is the probability of getting an even number?', '["1/6", "1/3", "1/2", "2/3"]'::jsonb, 2,
 '2, 4, 6 are even - 3 of 6 outcomes, which simplifies to 1/2.'),
('math', 'What is 2³ × 2²?', '["16", "32", "64", "128"]'::jsonb, 1,
 'Same base, add the exponents: 2³ × 2² = 2⁵ = 32.'),

('science', 'What is the most abundant gas in Earth''s atmosphere?', '["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"]'::jsonb, 2,
 'Nitrogen makes up about 78% of the air you''re breathing right now - oxygen is only ~21%.'),
('science', 'Which organ in the human body produces insulin?', '["Liver", "Pancreas", "Kidney", "Stomach"]'::jsonb, 1,
 'The pancreas produces insulin, which helps regulate blood sugar levels.'),
('science', 'What type of energy is stored in a stretched rubber band?', '["Kinetic", "Thermal", "Potential", "Chemical"]'::jsonb, 2,
 'Stretching it stores potential energy, released the moment you let go (ask anyone hit by one).'),
('science', 'What is the boiling point of water at sea level in Celsius?', '["90°C", "95°C", "100°C", "110°C"]'::jsonb, 2,
 '100°C at sea level - though it drops at higher altitudes, where air pressure is lower.'),
('science', 'Which planet is known as the Red Planet?', '["Venus", "Mars", "Jupiter", "Saturn"]'::jsonb, 1,
 'Mars gets its color from iron oxide - basically, the whole planet is rusty.'),
('science', 'What is the process by which water changes from liquid to gas called?', '["Condensation", "Evaporation", "Precipitation", "Sublimation"]'::jsonb, 1,
 'Evaporation - the same reason a puddle disappears without anyone mopping it up.'),
('science', 'Which blood type is known as the universal donor?', '["A", "B", "AB", "O negative"]'::jsonb, 3,
 'O negative lacks the markers other blood types react to, so almost anyone can receive it in an emergency.'),
('science', 'What is the hardest natural substance on Earth?', '["Gold", "Iron", "Diamond", "Quartz"]'::jsonb, 2,
 'Diamond - pure carbon packed into an incredibly tough crystal structure.'),
('science', 'Which part of a plant cell is responsible for photosynthesis?', '["Nucleus", "Chloroplast", "Vacuole", "Cell wall"]'::jsonb, 1,
 'Chloroplasts contain chlorophyll, the pigment that captures sunlight for photosynthesis.'),
('science', 'What is the unit used to measure force?', '["Joule", "Pascal", "Newton", "Watt"]'::jsonb, 2,
 'Force is measured in Newtons - named after the guy the apple allegedly fell on.'),

('vocabulary', 'If someone is "articulate", they:', '["Struggle to speak clearly", "Express ideas fluently and clearly", "Speak very loudly", "Refuse to speak"]'::jsonb, 1,
 'Articulate means expressing yourself clearly and effectively, in speech or writing.'),
('vocabulary', '"Feasible" means:', '["Impossible", "Expensive", "Capable of being done", "Illegal"]'::jsonb, 2,
 'Feasible means realistically doable, not just theoretically possible.'),
('vocabulary', 'To "scrutinize" something is to:', '["Ignore it completely", "Examine it closely", "Praise it publicly", "Destroy it"]'::jsonb, 1,
 'Scrutinize means to look at something very carefully, often checking for errors or detail.'),
('vocabulary', '"Versatile" best describes someone or something that is:', '["Limited to one use", "Adaptable to many uses", "Very expensive", "Hard to understand"]'::jsonb, 1,
 'Versatile means adaptable - able to handle many different situations or tasks well.'),
('vocabulary', 'If a decision is "unanimous", it means:', '["Only one person agreed", "Everyone agreed", "No one voted", "It was made randomly"]'::jsonb, 1,
 'Unanimous means total agreement - literally, everyone''s on the same page.'),
('vocabulary', '"Redundant" most nearly means:', '["Necessary", "Unnecessary or repetitive", "Very rare", "Extremely valuable"]'::jsonb, 1,
 'Redundant means no longer needed, often because it repeats something already said or done.'),
('vocabulary', 'Someone described as "humble" is:', '["Arrogant and boastful", "Modest about their achievements", "Extremely wealthy", "Very tall"]'::jsonb, 1,
 'Humble means modest - not showing off, even when you''ve earned the right to.'),
('vocabulary', '"Inevitable" describes something that is:', '["Avoidable with effort", "Certain to happen", "Extremely unlikely", "Illegal"]'::jsonb, 1,
 'Inevitable means it''s going to happen no matter what - like Monday, after the weekend.'),
('vocabulary', 'To "collaborate" means to:', '["Work alone", "Compete against others", "Work together with others", "Avoid a task"]'::jsonb, 2,
 'Collaborate means teaming up with others toward a shared goal.'),
('vocabulary', '"Ambitious" describes someone who:', '["Has strong goals and drive to achieve them", "Avoids all risk", "Gives up easily", "Dislikes challenges"]'::jsonb, 0,
 'Ambitious means having a strong desire to achieve something, often big and challenging.');

-- ── submit_daily_challenge(jsonb): reveal correct_index + explanation ───
-- Same function otherwise unchanged (still recomputes today's real
-- question set server-side, still upserts the attempt) - only the
-- per-question result object grows two fields, both already safe to
-- disclose at this point since grading has already happened.
create or replace function public.submit_daily_challenge(p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_score smallint := 0;
  v_total smallint := 0;
  v_results jsonb := '[]'::jsonb;
  v_question record;
  v_selected smallint;
  v_correct boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  for v_question in
    select cq.id, cq.correct_index, cq.explanation
    from public.challenge_questions cq
    order by md5(cq.id::text || v_today::text)
    limit 5
  loop
    v_total := v_total + 1;

    select (elem->>'selected_index')::smallint
      into v_selected
      from jsonb_array_elements(p_answers) elem
      where (elem->>'question_id')::uuid = v_question.id
      limit 1;

    v_correct := v_selected is not null and v_selected = v_question.correct_index;
    if v_correct then
      v_score := v_score + 1;
    end if;

    v_results := v_results || jsonb_build_object(
      'question_id', v_question.id,
      'correct', coalesce(v_correct, false),
      'correct_index', v_question.correct_index,
      'explanation', v_question.explanation
    );
  end loop;

  insert into public.challenge_attempts (user_id, challenge_date, score, total)
  values (v_user_id, v_today, v_score, v_total)
  on conflict (user_id, challenge_date)
  do update set score = excluded.score, total = excluded.total;

  return jsonb_build_object('score', v_score, 'total', v_total, 'results', v_results);
end;
$$;

grant execute on function public.submit_daily_challenge(jsonb) to authenticated;
