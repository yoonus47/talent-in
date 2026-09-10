-- TalentZify — seed data for the content hub, career quiz, and daily challenge.
-- Run after 0001_init.sql and 0002_dashboard_and_share.sql. Safe to re-run
-- (clears and re-inserts).

delete from public.quiz_questions;
delete from public.content_items;
delete from public.challenge_questions;
delete from public.vocabulary_words;

-- ── content_items ───────────────────────────────────────────────────────
insert into public.content_items (title, description, type, category, url, thumbnail_url) values
('How to Pick a Stream After Class 10', 'Science, Commerce, or Arts? A practical framework for deciding, not just "what pays more".', 'article', 'career_guidance', 'https://www.example.com/pick-a-stream', null),
('What Does a Software Engineer Actually Do?', 'A day-in-the-life breakdown of the job, minus the LinkedIn buzzwords.', 'article', 'career_guidance', 'https://www.example.com/swe-day-in-life', null),
('Careers Beyond Engineering and Medicine', 'Design, product management, data science, UX research, and a dozen other paths Indian students rarely hear about.', 'article', 'career_guidance', 'https://www.example.com/beyond-engg-medicine', null),
('Free Coding Basics: Python in 2 Weeks', 'A structured, beginner-friendly roadmap to Python fundamentals with daily practice problems.', 'article', 'tech_skills', 'https://www.example.com/python-2-weeks', null),
('Intro to Git and GitHub for Beginners', 'Version control explained without the jargon: what it is, why it matters, and your first repository.', 'video', 'tech_skills', 'https://www.example.com/git-github-intro', null),
('Build Your First Website (HTML/CSS)', 'No prior experience needed. By the end you will have a live personal page.', 'video', 'tech_skills', 'https://www.example.com/first-website', null),
('What is Artificial Intelligence, Really?', 'Cutting through the hype: a clear, non-technical explanation of AI/ML for high schoolers.', 'article', 'tech_skills', 'https://www.example.com/what-is-ai', null),
('Writing a Resume With Zero Work Experience', 'How to present school projects, clubs, and volunteering like real accomplishments.', 'article', 'job_readiness', 'https://www.example.com/first-resume', null),
('Acing Your First Interview', 'Common questions, how to talk about yourself without rehearsing a script, and what interviewers actually notice.', 'video', 'job_readiness', 'https://www.example.com/first-interview', null),
('Internships You Can Actually Get in Class 11-12', 'Realistic internship and volunteering options for school students, and how to find them.', 'article', 'job_readiness', 'https://www.example.com/school-internships', null),
('Time Management for Students Who Do Too Much', 'A simple system for balancing school, exams, and side projects without burning out.', 'article', 'upskilling', 'https://www.example.com/time-management', null),
('Public Speaking Without the Panic', 'Practical exercises to get comfortable presenting in class, in interviews, and on camera.', 'video', 'upskilling', 'https://www.example.com/public-speaking', null),
('How to Learn Any New Skill Faster', 'The difference between passive learning and deliberate practice, explained with real study techniques.', 'article', 'upskilling', 'https://www.example.com/learn-faster', null),
('Understanding Competitive Exams: JEE, NEET, CUET', 'What each exam actually tests, how they differ, and how to decide which path fits you.', 'article', 'career_guidance', 'https://www.example.com/competitive-exams', null),
('Personal Finance Basics Before You Turn 18', 'Saving, budgeting, and understanding money before your first paycheck.', 'article', 'job_readiness', 'https://www.example.com/personal-finance-basics', null),
('Intro to Data: Spreadsheets to Dashboards', 'Excel/Sheets fundamentals that quietly power a huge number of real jobs.', 'video', 'tech_skills', 'https://www.example.com/intro-to-data', null);

-- ── quiz_questions ──────────────────────────────────────────────────────
-- `options[].streams` are informal tags used to tally suggested streams —
-- not a scientific psychometric model, just a lightweight starter signal.
insert into public.quiz_questions (question, options, "order") values
(
  'Which of these sounds most fun to spend a Saturday on?',
  '[
    {"label": "Building or fixing something with your hands or a computer", "streams": ["Engineering & Technology"]},
    {"label": "Debating an idea or writing about something you care about", "streams": ["Humanities & Media"]},
    {"label": "Organizing an event or leading a group project", "streams": ["Business & Management"]},
    {"label": "Helping someone solve a personal problem", "streams": ["Healthcare & Social Sciences"]}
  ]'::jsonb,
  1
),
(
  'In a group project, you naturally end up...',
  '[
    {"label": "Figuring out how things actually work under the hood", "streams": ["Engineering & Technology"]},
    {"label": "Making sure the story/presentation is clear and convincing", "streams": ["Humanities & Media"]},
    {"label": "Keeping everyone on track and managing the plan", "streams": ["Business & Management"]},
    {"label": "Checking that the outcome actually helps people", "streams": ["Healthcare & Social Sciences"]}
  ]'::jsonb,
  2
),
(
  'Which school subject do you look forward to most?',
  '[
    {"label": "Math or Computer Science", "streams": ["Engineering & Technology"]},
    {"label": "English, History, or Political Science", "streams": ["Humanities & Media"]},
    {"label": "Economics or Business Studies", "streams": ["Business & Management"]},
    {"label": "Biology", "streams": ["Healthcare & Social Sciences"]}
  ]'::jsonb,
  3
),
(
  'Pick a problem you would enjoy solving:',
  '[
    {"label": "Why does this app keep crashing?", "streams": ["Engineering & Technology"]},
    {"label": "Why did public opinion shift on this issue?", "streams": ["Humanities & Media"]},
    {"label": "Why is this product not selling?", "streams": ["Business & Management"]},
    {"label": "Why is this community struggling with access to something?", "streams": ["Healthcare & Social Sciences"]}
  ]'::jsonb,
  4
),
(
  'Your ideal work environment looks like...',
  '[
    {"label": "A lab, workshop, or writing code", "streams": ["Engineering & Technology"]},
    {"label": "A newsroom, studio, or creative space", "streams": ["Humanities & Media"]},
    {"label": "An office running a growing team or company", "streams": ["Business & Management"]},
    {"label": "A hospital, clinic, or community organization", "streams": ["Healthcare & Social Sciences"]}
  ]'::jsonb,
  5
);

-- ── challenge_questions ─────────────────────────────────────────────────
-- `options` is a plain array of strings; `correct_index` is 0-based.
-- Roughly class 9-12 difficulty, mixed math/science. `get_daily_challenge()`
-- picks 5 of these deterministically each day.
insert into public.challenge_questions (subject, question, options, correct_index) values
('math', 'What is the value of x in 2x + 5 = 17?', '["4", "5", "6", "7"]'::jsonb, 2),
('math', 'What is the square root of 144?', '["11", "12", "13", "14"]'::jsonb, 1),
('math', 'A train travels 300 km in 5 hours. What is its average speed?', '["50 km/h", "55 km/h", "60 km/h", "65 km/h"]'::jsonb, 0),
('math', 'What is the value of pi (π), rounded to two decimal places?', '["3.14", "3.16", "3.12", "3.18"]'::jsonb, 0),
('math', 'If a triangle has angles of 90° and 45°, what is the third angle?', '["30°", "35°", "45°", "50°"]'::jsonb, 2),
('math', 'What is 15% of 200?', '["20", "25", "30", "35"]'::jsonb, 2),
('science', 'What is the powerhouse of the cell?', '["Nucleus", "Ribosome", "Mitochondria", "Golgi body"]'::jsonb, 2),
('science', 'Which gas do plants absorb from the atmosphere for photosynthesis?', '["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"]'::jsonb, 2),
('science', 'What is the chemical symbol for Sodium?', '["So", "Sd", "Na", "S"]'::jsonb, 2),
('science', 'What force pulls objects toward the center of the Earth?', '["Magnetism", "Gravity", "Friction", "Tension"]'::jsonb, 1),
('science', 'What is the SI unit of electric current?', '["Volt", "Watt", "Ohm", "Ampere"]'::jsonb, 3),
('science', 'Which part of the human body is primarily responsible for pumping blood?', '["Lungs", "Liver", "Heart", "Kidneys"]'::jsonb, 2),
('vocabulary', 'What does "ubiquitous" mean?', '["Rare and hard to find", "Present everywhere", "Extremely expensive", "Difficult to understand"]'::jsonb, 1),
('vocabulary', 'Someone who is "eloquent" is best described as:', '["Fluent and persuasive in speech", "Very quiet and shy", "Easily confused", "Physically strong"]'::jsonb, 0),
('vocabulary', 'If a plan is "pragmatic", it is:', '["Overly complicated", "Sensible and realistic", "Based on emotion", "Impossible to achieve"]'::jsonb, 1),
('vocabulary', 'To "procrastinate" means to:', '["Finish early", "Delay or postpone", "Work quickly", "Ask for help"]'::jsonb, 1),
('vocabulary', 'A "meticulous" person pays close attention to:', '["Other peoples opinions", "Detail", "Money", "Time zones"]'::jsonb, 1),
('vocabulary', 'Being "resilient" means you:', '["Give up easily", "Recover quickly from setbacks", "Avoid all risks", "Ignore feedback"]'::jsonb, 1),
('vocabulary', 'A "concise" explanation is:', '["Long and detailed", "Clear and brief", "Confusing", "Written in another language"]'::jsonb, 1),
('vocabulary', 'If something is "arbitrary", it is:', '["Carefully planned", "Based on random choice", "Extremely rare", "Scientifically proven"]'::jsonb, 1);

-- ── vocabulary_words ────────────────────────────────────────────────────
-- The "Word of the Day" card pool. Class 9-12 English level, examples
-- written around student life so they land as relevant, not textbook-dry.
-- Single words only (no phrases/hyphenates) so scripts/enrich-vocabulary.mjs
-- can look each one up in the Free Dictionary API and slug the audio file
-- name off it. Examples avoid apostrophes/contractions to keep the SQL
-- string literals clean.
insert into public.vocabulary_words (word, part_of_speech, definition, example_sentence) values
('Ubiquitous', 'adjective', 'Present, appearing, or found everywhere.', 'Smartphones have become ubiquitous in modern classrooms.'),
('Eloquent', 'adjective', 'Fluent and persuasive in speaking or writing.', 'Her eloquent speech convinced the entire student council.'),
('Resilient', 'adjective', 'Able to recover quickly from difficulties.', 'Being resilient after a failed exam matters more than never failing.'),
('Ambiguous', 'adjective', 'Open to more than one interpretation.', 'The instructions were so ambiguous that half the class misunderstood them.'),
('Procrastinate', 'verb', 'To delay or postpone taking action.', 'I always procrastinate on assignments until the night before they are due.'),
('Meticulous', 'adjective', 'Showing great attention to detail.', 'She is meticulous about checking her math homework twice.'),
('Candid', 'adjective', 'Truthful and straightforward; frank.', 'The teacher gave candid feedback on my essay.'),
('Innovate', 'verb', 'To introduce new ideas or methods.', 'Young entrepreneurs are innovating faster than ever before.'),
('Skeptical', 'adjective', 'Not easily convinced; having doubts.', 'I am skeptical about claims that promise overnight success.'),
('Pragmatic', 'adjective', 'Dealing with things sensibly and realistically.', 'Choosing a stream based on your strengths is a pragmatic decision.'),
('Concise', 'adjective', 'Giving information clearly, in a few words.', 'A concise resume is more likely to actually get read.'),
('Tenacious', 'adjective', 'Persistent and determined.', 'Her tenacious attitude helped her master calculus despite struggling at first.'),
('Euphoric', 'adjective', 'Feeling intense happiness or excitement.', 'She felt euphoric after her first coding project actually worked.'),
('Arbitrary', 'adjective', 'Based on random choice, not reason.', 'The seating arrangement seemed completely arbitrary.'),
('Diligent', 'adjective', 'Showing care and effort in your work.', 'Diligent students review their notes every single day.'),
('Cogent', 'adjective', 'Clear, logical, and convincing.', 'She built a cogent argument for extending the project deadline.'),
('Succinct', 'adjective', 'Expressed clearly in very few words.', 'Keep your presentation succinct so people remember the main point.'),
('Verbose', 'adjective', 'Using far more words than necessary.', 'His verbose answers made a simple topic sound complicated.'),
('Astute', 'adjective', 'Quick to understand a situation and act on it.', 'An astute observation from the back of the class shifted the whole discussion.'),
('Prudent', 'adjective', 'Careful and sensible, especially about the future.', 'Saving part of your pocket money is a prudent habit to start early.'),
('Zealous', 'adjective', 'Full of energy and enthusiasm for a cause.', 'The zealous new club members organised three events in a month.'),
('Apathy', 'noun', 'A lack of interest, enthusiasm, or concern.', 'Voter apathy in the student council election worried the teachers.'),
('Empathy', 'noun', 'The ability to understand how another person feels.', 'Good group projects need empathy as much as they need talent.'),
('Nuance', 'noun', 'A very small difference in meaning, tone, or feeling.', 'The debate came down to a nuance that most students had missed.'),
('Paradox', 'noun', 'A statement that seems to contradict itself but may be true.', 'It is a paradox that the more you learn, the more you realise how little you know.'),
('Rhetoric', 'noun', 'The art of using language to persuade or impress.', 'The winning speech relied on real evidence, not just rhetoric.'),
('Scrutinize', 'verb', 'To examine something closely and critically.', 'Scrutinize the question paper for a minute before you start writing.'),
('Alleviate', 'verb', 'To make pain or a problem less severe.', 'A clear study timetable can alleviate a lot of exam stress.'),
('Advocate', 'verb', 'To publicly support a particular cause or idea.', 'She advocates for more practical lab time in the science curriculum.'),
('Emulate', 'verb', 'To try to match or do as well as someone you admire.', 'He tried to emulate the discipline of the class topper.'),
('Mitigate', 'verb', 'To make something bad less harmful or serious.', 'Reviewing your notes weekly mitigates the panic before finals.'),
('Facilitate', 'verb', 'To make an action or process easier.', 'A shared document facilitated the group project even though everyone lived far apart.'),
('Articulate', 'adjective', 'Able to express ideas clearly and fluently.', 'Being articulate in an interview matters more than using big words.'),
('Coherent', 'adjective', 'Logical, clear, and well organised.', 'Her essay was coherent from the first line to the conclusion.'),
('Redundant', 'adjective', 'Not needed because it repeats something already present.', 'The second paragraph was redundant and only weakened the essay.'),
('Superficial', 'adjective', 'Only on the surface; lacking depth.', 'A superficial reading of the chapter will not get you through the exam.'),
('Trivial', 'adjective', 'Of very little importance or value.', 'Do not lose marks over trivial spelling mistakes you could have caught.'),
('Profound', 'adjective', 'Very deep, intense, or insightful.', 'The book had a profound effect on how she saw her career choices.'),
('Inevitable', 'adjective', 'Certain to happen and impossible to avoid.', 'Some failure is inevitable when you are learning a hard new skill.'),
('Feasible', 'adjective', 'Possible to do without too much difficulty.', 'Finishing the model in one weekend was just about feasible.'),
('Viable', 'adjective', 'Able to work successfully.', 'The team needed a viable plan, not just an exciting one.'),
('Obsolete', 'adjective', 'Out of date and no longer used.', 'The lab manual referred to software that is now obsolete.'),
('Intrinsic', 'adjective', 'Belonging naturally to something; essential.', 'Curiosity is intrinsic to good research.'),
('Autonomy', 'noun', 'The freedom to make your own decisions.', 'Older students were given more autonomy over their project topics.'),
('Consensus', 'noun', 'General agreement within a group.', 'The class reached a consensus on the trip destination after a long discussion.'),
('Criterion', 'noun', 'A standard used to judge or decide something.', 'Originality was the main criterion for the science fair prize.'),
('Hypothesis', 'noun', 'A proposed explanation that can be tested.', 'Write down your hypothesis before you run the experiment, not after.'),
('Incentive', 'noun', 'Something that encourages a person to act.', 'Bonus marks were the incentive to submit the assignment early.'),
('Rationale', 'noun', 'The set of reasons behind a decision.', 'Explain the rationale for your method in the project report.'),
('Bias', 'noun', 'An unfair leaning toward or against something.', 'Good sources try to report the facts without bias.'),
('Integrity', 'noun', 'The quality of being honest and having firm principles.', 'Academic integrity means the work you submit is genuinely your own.'),
('Adversity', 'noun', 'A difficult or unpleasant situation.', 'She spoke about facing adversity after switching schools mid year.'),
('Ambivalent', 'adjective', 'Having mixed or conflicting feelings about something.', 'He felt ambivalent about joining the debate team and the coding club at once.'),
('Complacent', 'adjective', 'So satisfied with yourself that you stop trying to improve.', 'One good test result made him complacent, and the next one slipped.'),
('Conscientious', 'adjective', 'Careful to do your work thoroughly and well.', 'A conscientious student checks the marking scheme before submitting.'),
('Versatile', 'adjective', 'Able to adapt to many different tasks or roles.', 'A versatile teammate can present, design, and write when needed.'),
('Proficient', 'adjective', 'Skilled and competent at something.', 'Two months of daily practice made her proficient in basic Python.'),
('Erratic', 'adjective', 'Irregular and unpredictable.', 'His erratic sleep schedule showed up in his morning classes.'),
('Volatile', 'adjective', 'Likely to change suddenly and unpredictably.', 'The group mood was volatile the week before the board exams.'),
('Sporadic', 'adjective', 'Happening at irregular intervals; scattered.', 'Sporadic studying rarely beats a steady half hour every day.'),
('Transient', 'adjective', 'Lasting only for a short time.', 'The disappointment of a low mark is usually transient.'),
('Elaborate', 'verb', 'To add more detail to something already said.', 'The examiner asked her to elaborate on her second point.'),
('Condense', 'verb', 'To make something shorter or more concentrated.', 'Try to condense the chapter into one page of notes.'),
('Delegate', 'verb', 'To give part of your work or authority to someone else.', 'A good group leader will delegate tasks instead of doing everything alone.'),
('Persevere', 'verb', 'To keep going despite difficulty or delay.', 'She persevered with the proof until it finally made sense.'),
('Contemplate', 'verb', 'To think about something carefully and for a long time.', 'He spent the summer contemplating whether to take commerce or science.'),
('Speculate', 'verb', 'To form an opinion without having full evidence.', 'Do not speculate about the results before the experiment is done.'),
('Undermine', 'verb', 'To weaken something gradually or secretly.', 'Skipping the basics will undermine everything you build later.'),
('Reinforce', 'verb', 'To make something stronger or more firmly established.', 'Solving extra problems reinforces what you learned in class.'),
('Diminish', 'verb', 'To make or become smaller or less.', 'Regular revision diminishes the fear of a big syllabus.'),
('Distort', 'verb', 'To twist something out of its true shape or meaning.', 'A rushed summary can distort what the author actually argued.'),
('Fluctuate', 'verb', 'To rise and fall in an irregular way.', 'Her marks fluctuated until she fixed her revision routine.'),
('Prevalent', 'adjective', 'Widespread; common in a place or time.', 'The belief that you must choose engineering is still prevalent among many parents.'),
('Notorious', 'adjective', 'Well known for something bad.', 'That chapter is notorious for tricky application questions.'),
('Prominent', 'adjective', 'Important, well known, or easily noticed.', 'A prominent alumnus came back to talk about life after school.'),
('Credible', 'adjective', 'Believable and able to be trusted.', 'Cite credible sources, not the first blog you find.'),
('Plausible', 'adjective', 'Seeming reasonable or likely to be true.', 'Her explanation for the missing data was plausible enough to accept.'),
('Legitimate', 'adjective', 'Allowed by the rules; genuine and justifiable.', 'A note from a doctor is a legitimate reason to reschedule the test.'),
('Impartial', 'adjective', 'Not favouring one side; fair.', 'The judges stayed impartial even when their own school competed.'),
('Objective', 'adjective', 'Based on facts rather than personal feelings.', 'Try to be objective when you grade your own practice essay.'),
('Subjective', 'adjective', 'Based on personal opinion or feeling.', 'Whether a film is good is partly subjective, but the editing quality is not.'),
('Comprehensive', 'adjective', 'Complete; covering all or nearly all parts.', 'She made a comprehensive revision sheet for the entire unit.'),
('Rigorous', 'adjective', 'Extremely thorough, careful, and demanding.', 'The coach set a rigorous training plan for the science olympiad.'),
('Analytical', 'adjective', 'Relating to careful, step by step reasoning.', 'Physics rewards an analytical approach more than memorising.'),
('Abstract', 'adjective', 'Existing as an idea rather than a physical object.', 'Algebra felt abstract until she connected it to real problems.'),
('Tangible', 'adjective', 'Real and definite; able to be seen or touched.', 'Finishing a working prototype gave the team something tangible to show.'),
('Elusive', 'adjective', 'Hard to find, catch, or achieve.', 'A full night of sleep was elusive during exam week.'),
('Deliberate', 'adjective', 'Done on purpose and with full awareness.', 'Her calm tone in the debate was a deliberate choice.'),
('Spontaneous', 'adjective', 'Happening naturally, without being planned.', 'The best answers in the viva were spontaneous, not memorised.'),
('Reluctant', 'adjective', 'Unwilling and slow to act.', 'He was reluctant to ask for help until the topic became impossible.'),
('Assertive', 'adjective', 'Confident and direct in stating your needs or views.', 'Being assertive in a group means sharing your idea without talking over others.'),
('Arrogant', 'adjective', 'Having an exaggerated sense of your own importance.', 'Confidence helps in an interview; sounding arrogant does not.'),
('Gracious', 'adjective', 'Kind, polite, and pleasant, especially toward juniors.', 'She was gracious to the junior team even after winning.'),
('Hostile', 'adjective', 'Unfriendly and opposed.', 'A hostile tone in a group chat kills honest discussion fast.'),
('Indignant', 'adjective', 'Angry because something seems unfair.', 'The class was indignant when the trip was cancelled without a reason.'),
('Apprehensive', 'adjective', 'Worried that something bad might happen.', 'Most students feel apprehensive before their first oral exam.'),
('Impulsive', 'adjective', 'Acting suddenly without thinking it through.', 'Choosing a stream on an impulsive whim is a decision worth slowing down.'),
('Frugal', 'adjective', 'Careful and sparing with money or resources.', 'A frugal approach to the project budget left room for mistakes.'),
('Scarce', 'adjective', 'Available in smaller quantity than needed.', 'Quiet study spots become scarce during exam season.'),
('Abundant', 'adjective', 'Present in large quantity; more than enough.', 'Free learning resources are abundant online if you know where to look.');
