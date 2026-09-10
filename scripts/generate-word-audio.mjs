// One-time / occasional local script: generates a British-female
// pronunciation clip for every vocabulary_words row (the "Word of the
// Day" pool) with Amazon Polly, and stores each MP3 in our own
// `word-audio` Supabase Storage bucket.
//
// Polly bills only for the SynthesizeSpeech call that creates the audio —
// once the files are in Storage they cost nothing and never call AWS
// again. Total input here is ~4,500 characters (~$0 on the free tier,
// ~13 cents at the generative rate otherwise).
//
// Requires in .env.local:
//   SUPABASE_SERVICE_ROLE_KEY   (real service role key — bypasses RLS)
//   AWS_ACCESS_KEY_ID           (IAM user with AmazonPollyReadOnlyAccess)
//   AWS_SECRET_ACCESS_KEY
//   AWS_REGION                  (optional, defaults to us-east-1)
//
// Usage:
//   node scripts/generate-word-audio.mjs          # only rows without audio
//   node scripts/generate-word-audio.mjs --force  # regenerate every row

import { createClient } from "@supabase/supabase-js";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VOICE_ID = "Amy"; // British female
const BUCKET = "word-audio";
const DELAY_MS = 120;
// Best → worst; Amy supports all three. We settle on one engine for the
// whole run so every word sounds consistent.
const ENGINES = ["generative", "neural", "standard"];

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

async function synth(polly, text, engine) {
  const res = await polly.send(
    new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: VOICE_ID,
      Engine: engine,
      OutputFormat: "mp3",
      SampleRate: "24000", // Polly's highest for speech
    }),
  );
  return Buffer.from(await res.AudioStream.transformToByteArray());
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const awsKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";
  if (!url || !serviceKey || serviceKey.length < 100) {
    console.error("Set a REAL SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
    process.exit(1);
  }
  if (!awsKey || !awsSecret) {
    console.error("Set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY in .env.local (IAM user with AmazonPollyReadOnlyAccess).");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey);
  const polly = new PollyClient({ region, credentials: { accessKeyId: awsKey, secretAccessKey: awsSecret } });
  const force = process.argv.includes("--force");

  // Settle on one engine up front.
  let engine = null;
  for (const e of ENGINES) {
    try {
      await synth(polly, "test", e);
      engine = e;
      break;
    } catch (err) {
      console.log(`engine "${e}" unavailable in ${region} (${err.name}) — trying next`);
    }
  }
  if (!engine) {
    console.error("Polly rejected every engine. Check the IAM policy and region.");
    process.exit(1);
  }
  console.log(`Using voice ${VOICE_ID} / engine "${engine}" in ${region}.\n`);

  let query = admin.from("vocabulary_words").select("id, word").order("word");
  if (!force) query = query.is("audio_url", null);
  const { data: words, error } = await query;
  if (error) {
    console.error("Failed to fetch vocabulary_words:", error.message);
    process.exit(1);
  }
  if (!words || words.length === 0) {
    console.log("Nothing to do — every row already has audio_url (use --force to regenerate).");
    return;
  }

  console.log(`Generating audio for ${words.length} word(s)...`);
  let done = 0;
  const failed = [];

  for (const row of words) {
    const slug = row.word.toLowerCase().replace(/[^a-z0-9]/g, "");
    try {
      const mp3 = await synth(polly, row.word, engine);
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(`${slug}.mp3`, mp3, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const audioUrl = admin.storage.from(BUCKET).getPublicUrl(`${slug}.mp3`).data.publicUrl;
      const { error: updErr } = await admin
        .from("vocabulary_words")
        .update({ audio_url: audioUrl, enriched_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updErr) throw new Error(`row update: ${updErr.message}`);

      done++;
      if (done % 25 === 0) console.log(`  ...${done}/${words.length}`);
    } catch (err) {
      failed.push(`${row.word} (${err.message})`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${done} generated, ${failed.length} failed.`);
  if (failed.length > 0) console.log("Failed:\n  " + failed.join("\n  "));
}

main();
