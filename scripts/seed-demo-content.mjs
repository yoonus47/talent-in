// One-time local script: creates a handful of demo student accounts,
// makes your account follow them, and posts some example content so your
// feed isn't empty. Safe to re-run (upserts profiles/follows, skips
// creating demo auth users that already exist).
//
// Requires a REAL Supabase service role key in .env.local
// (Project Settings → API → service_role secret) — the placeholder value
// won't work, since creating auth users needs admin privileges.
//
// Usage:  node scripts/seed-demo-content.mjs

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvLocal() {
  const path = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    console.error(".env.local not found — copy .env.example first.");
    process.exit(1);
  }
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) process.env[match[1]] ??= match[2];
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || serviceKey === "your-service-role-key" || serviceKey.length < 100) {
  console.error(
    "Set a REAL SUPABASE_SERVICE_ROLE_KEY in .env.local first " +
      "(Supabase dashboard → Project Settings → API → service_role secret).",
  );
  process.exit(1);
}

// Change this if you signed up with a different email than the one below.
const YOUR_EMAIL = "mdyoonus2020@gmail.com";

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_USERS = [
  {
    email: "demo.ananya@talentin.local",
    username: "ananya_learns",
    full_name: "Ananya Sharma",
    grade: 11,
    school: "DAV Public School",
    city: "Bengaluru",
    state: "Karnataka",
    interests: ["Coding", "Design"],
  },
  {
    email: "demo.rahul@talentin.local",
    username: "rahul_codes",
    full_name: "Rahul Verma",
    grade: 12,
    school: "Delhi Public School",
    city: "Delhi",
    state: "Delhi",
    interests: ["Coding", "Entrepreneurship"],
  },
  {
    email: "demo.priya@talentin.local",
    username: "priya_science",
    full_name: "Priya Nair",
    grade: 10,
    school: "Kendriya Vidyalaya",
    city: "Kochi",
    state: "Kerala",
    interests: ["Science", "Medicine"],
  },
  {
    email: "demo.karan@talentin.local",
    username: "karan_hustles",
    full_name: "Karan Singh",
    grade: 12,
    school: "St. Xavier's",
    city: "Mumbai",
    state: "Maharashtra",
    interests: ["Finance", "Public Speaking"],
  },
];

const POSTS = [
  {
    username: "ananya_learns",
    content:
      "Finally shipped my first website today 🎉 HTML/CSS took me 2 weeks but it finally clicked. On to JavaScript next!",
    daysAgo: 4,
  },
  {
    username: "rahul_codes",
    content:
      "PSA: the 'Intro to Git and GitHub' video in Discover is actually really good. Wish someone showed me this before I lost a project to a bad merge 😅",
    daysAgo: 3,
  },
  {
    username: "priya_science",
    content:
      "Took the career quiz on here out of curiosity and it said Healthcare & Social Sciences... which, yeah, checks out. Anyone else's result scarily accurate?",
    daysAgo: 3,
  },
  {
    username: "karan_hustles",
    content:
      "Got rejected from my first 'internship' application (a family friend's shop, but still). Onto the next one. Rejection is just data.",
    daysAgo: 2,
  },
  {
    username: "ananya_learns",
    content:
      "Reminder to self: the 'time management for students who do too much' article in Discover >>> me trying to wing it every single time.",
    daysAgo: 2,
  },
  {
    username: "rahul_codes",
    content: "Streak day 6 on the daily challenge 🔥 the math ones are humbling me ngl",
    daysAgo: 1,
  },
  {
    username: "priya_science",
    content:
      "Does anyone actually enjoy public speaking or is everyone just pretending. Asking for myself before my class presentation tomorrow.",
    daysAgo: 1,
  },
  {
    username: "karan_hustles",
    content:
      "Started tracking my pocket money in a spreadsheet after reading the personal finance article. Turns out I spend an alarming amount on chai.",
    daysAgo: 0,
  },
];

async function main() {
  console.log("Looking up your account...");
  const { data: userList, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  const you = userList.users.find((u) => u.email === YOUR_EMAIL);
  if (!you) {
    console.error(
      `Could not find a user with email ${YOUR_EMAIL} — sign up in the app first, or edit YOUR_EMAIL in this script.`,
    );
    process.exit(1);
  }

  const demoIds = {};

  for (const demo of DEMO_USERS) {
    let user = userList.users.find((u) => u.email === demo.email);
    if (!user) {
      console.log(`Creating demo account @${demo.username}...`);
      const { data, error } = await admin.auth.admin.createUser({
        email: demo.email,
        password: randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: demo.full_name },
      });
      if (error) throw error;
      user = data.user;
    }
    demoIds[demo.username] = user.id;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: user.id,
      username: demo.username,
      full_name: demo.full_name,
      grade: demo.grade,
      school: demo.school,
      city: demo.city,
      state: demo.state,
      interests: demo.interests,
      is_minor: true,
    });
    if (profileError) throw profileError;
  }

  console.log("Following demo accounts from your account...");
  for (const id of Object.values(demoIds)) {
    const { error } = await admin
      .from("follows")
      .upsert({ follower_id: you.id, following_id: id }, { onConflict: "follower_id,following_id" });
    if (error) throw error;
  }

  const { count: existingPosts } = await admin
    .from("posts")
    .select("*", { count: "exact", head: true })
    .in("user_id", Object.values(demoIds));

  if (existingPosts && existingPosts > 0) {
    console.log(`Demo accounts already have ${existingPosts} post(s) — skipping, to avoid duplicates.`);
    console.log("Done!");
    return;
  }

  console.log("Posting demo content...");
  for (const post of POSTS) {
    const created_at = new Date(Date.now() - post.daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin.from("posts").insert({
      user_id: demoIds[post.username],
      content: post.content,
      created_at,
    });
    if (error) throw error;
  }

  console.log("Done! Refresh your feed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
