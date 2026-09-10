// One-time / occasional local script: fills phonetic + pronunciation
// audio for vocabulary_words (the "Word of the Day" pool) from the Free
// Dictionary API (api.dictionaryapi.dev — free, no key, CC BY-SA data).
//
// The API is a strained community service with no SLA, so we hit it ONCE,
// here, offline — never from the app. The audio MP3 is re-hosted in our
// own `word-audio` Supabase Storage bucket so the dashboard has zero
// runtime dependency on that API.
//
// Requires a REAL Supabase service role key in .env.local (bypasses RLS,
// same as scripts/backfill-post-image-dimensions.mjs).
//
// Usage:
//   node scripts/enrich-vocabulary.mjs          # only rows never processed
//   node scripts/enrich-vocabulary.mjs --force  # re-check every row

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const BUCKET = "word-audio";
const MAX_ATTEMPTS = 4;
const DELAY_BETWEEN_WORDS_MS = 500;
// The media files come as <word>-us.mp3 / -uk.mp3 / -au.mp3 / unsuffixed.
// "First in the array" is nondeterministic across accents, so pick one on
// purpose — US first for this audience.
const ACCENT_PREFERENCE = ["-us.", "-uk.", "-au."];

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with retry/backoff on network errors and 5xx (the API 522s a lot).
 * Returns { status, body } — body is parsed JSON for 2xx, null otherwise. */
async function fetchWithRetry(url, { json = true } = {}) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.status === 404) return { status: 404, body: null };
      if (res.status >= 500 || res.status === 429) {
        if (attempt < MAX_ATTEMPTS) {
          await sleep(attempt * 1500);
          continue;
        }
        return { status: res.status, body: null };
      }
      if (!res.ok) return { status: res.status, body: null };
      return { status: res.status, body: json ? await res.json() : Buffer.from(await res.arrayBuffer()) };
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(attempt * 1500);
        continue;
      }
      return { status: 0, body: null };
    }
  }
  return { status: 0, body: null };
}

function pickPhonetic(entries) {
  for (const entry of entries) {
    if (typeof entry.phonetic === "string" && entry.phonetic.trim().startsWith("/")) {
      return entry.phonetic.trim();
    }
  }
  for (const entry of entries) {
    for (const p of entry.phonetics ?? []) {
      if (typeof p.text === "string" && p.text.trim().startsWith("/")) return p.text.trim();
    }
  }
  return null;
}

function pickAudioUrl(entries) {
  const urls = [];
  for (const entry of entries) {
    for (const p of entry.phonetics ?? []) {
      if (typeof p.audio === "string" && p.audio.startsWith("http")) urls.push(p.audio);
    }
  }
  if (urls.length === 0) return null;
  for (const accent of ACCENT_PREFERENCE) {
    const match = urls.find((u) => u.includes(accent));
    if (match) return match;
  }
  const unsuffixed = urls.find((u) => !/-(us|uk|au)\.mp3$/i.test(u));
  return unsuffixed ?? urls[0];
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || serviceKey.length < 100) {
    console.error("Set a REAL SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
    process.exit(1);
  }
  const admin = createClient(url, serviceKey);
  const force = process.argv.includes("--force");

  let query = admin.from("vocabulary_words").select("id, word").order("word");
  if (!force) query = query.is("enriched_at", null);
  const { data: words, error } = await query;
  if (error) {
    console.error("Failed to fetch vocabulary_words:", error.message);
    process.exit(1);
  }
  if (!words || words.length === 0) {
    console.log("Nothing to enrich — every row already has enriched_at set (use --force to re-check).");
    return;
  }

  console.log(`Enriching ${words.length} word(s)...`);
  const notFound = [];
  let withAudio = 0;
  let withPhoneticOnly = 0;

  for (const row of words) {
    const slug = row.word.toLowerCase().replace(/[^a-z0-9]/g, "");
    const { status, body } = await fetchWithRetry(API_BASE + encodeURIComponent(row.word.toLowerCase()));

    let phonetic = null;
    let audioUrl = null;
    let sourceUrl = null;

    if (status === 200 && Array.isArray(body) && body.length > 0) {
      phonetic = pickPhonetic(body);
      sourceUrl = body.find((e) => Array.isArray(e.sourceUrls) && e.sourceUrls[0])?.sourceUrls[0] ?? null;

      const remoteAudio = pickAudioUrl(body);
      if (remoteAudio) {
        const { status: aStatus, body: mp3 } = await fetchWithRetry(remoteAudio, { json: false });
        if (aStatus === 200 && mp3?.length > 0) {
          const { error: upErr } = await admin.storage
            .from(BUCKET)
            .upload(`${slug}.mp3`, mp3, { contentType: "audio/mpeg", upsert: true });
          if (upErr) {
            console.error(`  ${row.word}: audio upload failed — ${upErr.message}`);
          } else {
            audioUrl = admin.storage.from(BUCKET).getPublicUrl(`${slug}.mp3`).data.publicUrl;
          }
        } else {
          console.error(`  ${row.word}: audio download failed (status ${aStatus})`);
        }
      }
    } else if (status === 404) {
      notFound.push(row.word);
    } else {
      console.error(`  ${row.word}: API returned status ${status} after ${MAX_ATTEMPTS} tries — leaving unenriched`);
      await sleep(DELAY_BETWEEN_WORDS_MS);
      continue; // don't set enriched_at — a transient outage should be retried next run
    }

    const { error: updErr } = await admin
      .from("vocabulary_words")
      .update({ phonetic, audio_url: audioUrl, source_url: sourceUrl, enriched_at: new Date().toISOString() })
      .eq("id", row.id);

    if (updErr) {
      console.error(`  ${row.word}: row update failed — ${updErr.message}`);
    } else if (audioUrl) {
      withAudio++;
      console.log(`  ${row.word}: audio + ${phonetic ?? "(no phonetic)"}`);
    } else if (phonetic) {
      withPhoneticOnly++;
      console.log(`  ${row.word}: phonetic only (${phonetic})`);
    } else {
      console.log(`  ${row.word}: nothing usable`);
    }

    await sleep(DELAY_BETWEEN_WORDS_MS);
  }

  console.log(
    `\nDone. ${withAudio} with audio, ${withPhoneticOnly} phonetic-only, ${notFound.length} not found in the API.`,
  );
  if (notFound.length > 0) {
    console.log(`Not found (consider swapping these in seed.sql): ${notFound.join(", ")}`);
  }
}

main();
