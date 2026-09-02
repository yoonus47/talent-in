// One-time local script: fills in image_width/image_height for posts
// created before that feature existed. Without real dimensions, the feed
// falls back to a guessed portrait-ish ratio — badly wrong for a landscape
// photo, which is exactly what caused visible cropping in the feed for a
// few pre-existing posts.
//
// Requires a REAL Supabase service role key in .env.local (bypasses RLS
// and the column-level UPDATE grant, same as scripts/seed-demo-content.mjs).
//
// Usage:  node scripts/backfill-post-image-dimensions.mjs

import { createClient } from "@supabase/supabase-js";
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

/** Reads width/height straight out of a JPEG's SOF marker — no image
 * library needed for the one format every post image is actually stored
 * as (post-images uploads and the seeded picsum.photos demo posts are
 * both JPEG). */
function getJpegDimensions(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null; // not a JPEG
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    // SOFn markers (0xC0–0xCF, excluding DHT/JPG/DAC) carry the dimensions.
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (isSof) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const admin = createClient(url, serviceKey);

  const { data: posts, error } = await admin
    .from("posts")
    .select("id, image_url")
    .not("image_url", "is", null)
    .is("image_width", null);

  if (error) {
    console.error("Failed to fetch posts:", error.message);
    process.exit(1);
  }
  if (!posts || posts.length === 0) {
    console.log("Nothing to backfill — every post with an image already has dimensions.");
    return;
  }

  console.log(`Backfilling dimensions for ${posts.length} post(s)...`);
  for (const post of posts) {
    try {
      const res = await fetch(post.image_url);
      if (!res.ok) {
        console.error(`  ${post.id}: fetch failed (${res.status}) — skipping`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const dims = getJpegDimensions(buf);
      if (!dims) {
        console.error(`  ${post.id}: couldn't read JPEG dimensions — skipping`);
        continue;
      }
      const { error: updateError } = await admin
        .from("posts")
        .update({ image_width: dims.width, image_height: dims.height })
        .eq("id", post.id);
      if (updateError) {
        console.error(`  ${post.id}: update failed — ${updateError.message}`);
      } else {
        console.log(`  ${post.id}: ${dims.width}x${dims.height}`);
      }
    } catch (err) {
      console.error(`  ${post.id}: ${err.message}`);
    }
  }
  console.log("Done.");
}

main();
