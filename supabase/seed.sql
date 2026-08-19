-- Talent In — seed data for the content hub and career quiz.
-- Run after 0001_init.sql. Safe to re-run (clears and re-inserts).

delete from public.quiz_questions;
delete from public.content_items;

-- ── content_items ───────────────────────────────────────────────────────
insert into public.content_items (title, description, type, category, url, thumbnail_url) values
('How to Pick a Stream After Class 10', 'Science, Commerce, or Arts? A practical framework for deciding — not just "what pays more".', 'article', 'career_guidance', 'https://www.example.com/pick-a-stream', null),
('What Does a Software Engineer Actually Do?', 'A day-in-the-life breakdown of the job, minus the LinkedIn buzzwords.', 'article', 'career_guidance', 'https://www.example.com/swe-day-in-life', null),
('Careers Beyond Engineering and Medicine', 'Design, product management, data science, UX research, and a dozen other paths Indian students rarely hear about.', 'article', 'career_guidance', 'https://www.example.com/beyond-engg-medicine', null),
('Free Coding Basics: Python in 2 Weeks', 'A structured, beginner-friendly roadmap to Python fundamentals with daily practice problems.', 'article', 'tech_skills', 'https://www.example.com/python-2-weeks', null),
('Intro to Git and GitHub for Beginners', 'Version control explained without the jargon — what it is, why it matters, and your first repository.', 'video', 'tech_skills', 'https://www.example.com/git-github-intro', null),
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
