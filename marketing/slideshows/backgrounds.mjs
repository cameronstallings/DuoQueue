#!/usr/bin/env node
// Builds the photo backgrounds the slideshows use: 2160x3840 JPGs (2x the slide size) in
// cache/bg/. The slideshows are faceless by Cameron's call (4 Oct 2026): no stills of him, no
// other people. Covers use free Unsplash photos of gear and rooms; the one photo of his own is
// the sleeping cat. render.mjs imports BACKGROUNDS for the caption notes.
//
//   node backgrounds.mjs                    build the missing ones
//   node backgrounds.mjs --force            rebuild all of them
//   node backgrounds.mjs --force <key> ...  rebuild only these keys
//
// Stock photos are downloaded once into cache/stock/ (git ignores cache/); who took each one is
// in stock/CREDITS.md. Every one is a "Free Photo" under the Unsplash License, checked on its
// own page on 4 Oct 2026, never an Unsplash+ photo. Needs ffmpeg on PATH.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BG_DIR = path.join(HERE, "cache", "bg");
const STOCK_DIR = path.join(HERE, "cache", "stock");
const PHOTOS = process.env.PHOTO_DIR || "C:\\Users\\stall\\Pictures\\duoqueue-filming";

// key -> where it comes from and what it shows (the "about" line goes into caption.txt).
// Chosen with no people, no readable brand logos and no game on any screen.
export const BACKGROUNDS = {
  "s01-empty-chair-dim-room": { stock: "1577239458058-b179bc7479bf", page: "https://unsplash.com/photos/empty-chair-in-dim-room-TkqlTjmuqfw", by: "Alejandro Mendoza", about: "an empty chair in a dark room lit by the monitor" },
  "s02-lamp-over-notebook": { stock: "1781690643160-73d0743dfbde", page: "https://unsplash.com/photos/a-lit-desk-lamp-illuminates-a-notebook-and-pen-LOk7sNVCNJU", by: "Barney Goodman", about: "a desk lamp over a notebook of notes" },
  "s03-clock-near-midnight": { stock: "1638814089537-87535ea2fd5b", page: "https://unsplash.com/photos/a-black-and-white-clock-on-a-black-wall-D4lJ7p7S8eY", by: "Aedrian Salazar", about: "a clock face at almost midnight" },
  "s04-mic-and-headphones-desk": { stock: "1631812801948-2ade0adc7f2a", page: "https://unsplash.com/photos/a-desk-with-two-monitors-and-headphones-on-it-pcSne19GyKQ", by: "Konstantin Remy", about: "a dark desk with a mic and headphones" },
  "s05-red-and-blue-controllers": { stock: "1640955059914-c5971628f6f9", page: "https://unsplash.com/photos/three-video-game-controllers-sitting-next-to-each-other-0Q-Hj4pi2tk", by: "Pablo Arenas", about: "a red and a blue controller side by side" },
  "s06-two-controllers": { stock: "1675701299052-01abe3b8743f", page: "https://unsplash.com/photos/two-video-game-controllers-sitting-on-top-of-a-table-Ws40ZcWnMPg", by: "Eugene Chystiakov", about: "two controllers side by side" },
  "s07-keyboard-lit-in-dark": { stock: "1646505262769-db0b272acb7d", page: "https://unsplash.com/photos/a-computer-keyboard-lit-up-in-the-dark-NsAGCQU3s7E", by: "Samsul", about: "a keyboard glowing in the dark" },
  "s09-mic-pink-light": { stock: "1756489947258-b7774b7671ff", page: "https://unsplash.com/photos/black-microphone-with-pink-light-on-stand-ZwoWkujWP3E", by: "Altin Krasniqi", about: "a mic lit pink in a dim room" },
  "s10-headset-on-stand": { stock: "1608692747054-b4ed998abc2a", page: "https://unsplash.com/photos/black-and-silver-headphones-on-black-table-_o_VLY3CP8g", by: "Thamara Maura", about: "a headset on a stand by the blinds" },
  // ffmpeg applies the iPhone EXIF rotation itself, so the crop is in upright pixels (4284x5712).
  // The top third of this photo is a game's end screen on the monitor: start the crop below it.
  "p02-sleepy-cat-on-desk": { photo: "IMG_2746.jpeg", crop: "crop=2088:3712:900:2000", about: "your cat asleep on your desk (the monitor is cropped out)" },
};

export function bgPath(key) {
  return path.join(BG_DIR, `${key}.jpg`);
}

export function bgSourceNote(key) {
  const b = BACKGROUNDS[key];
  if (!b) throw new Error(`unknown background ${key}`);
  return b.photo
    ? `your photo ${b.photo}: ${b.about}`
    : `free Unsplash photo by ${b.by} (${b.page}): ${b.about}`;
}

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr || r.error}`);
}

function probeSize(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf8" });
  return r.stdout.trim();
}

async function stockFile(b) {
  const file = path.join(STOCK_DIR, `${b.stock}.jpg`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(STOCK_DIR, { recursive: true });
  // A 9:16 centre crop at full slide resolution straight from Unsplash's image CDN.
  const url = `https://images.unsplash.com/photo-${b.stock}?w=2160&h=3840&fit=crop&q=90&fm=jpg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status}) for ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

export async function buildBackground(key) {
  const b = BACKGROUNDS[key];
  const out = bgPath(key);
  fs.mkdirSync(BG_DIR, { recursive: true });
  if (b.photo) {
    ffmpeg(["-i", path.join(PHOTOS, b.photo), "-frames:v", "1", "-vf", `${b.crop},scale=2160:3840:flags=lanczos`, "-q:v", "2", out]);
  } else {
    const src = await stockFile(b);
    ffmpeg(["-i", src, "-frames:v", "1", "-vf", "scale=2160:3840:force_original_aspect_ratio=increase:flags=lanczos,crop=2160:3840", "-q:v", "2", out]);
  }
  const size = probeSize(out);
  if (size !== "2160,3840") throw new Error(`${key}: expected 2160x3840, got ${size}`);
  return out;
}

export async function ensureBackgrounds(keys, { force = false, log = console.log } = {}) {
  for (const key of keys) {
    if (!BACKGROUNDS[key]) throw new Error(`unknown background ${key}`);
    if (!force && fs.existsSync(bgPath(key))) continue;
    log(`  building background ${key}`);
    await buildBackground(key);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const keys = args.filter((a) => a !== "--force");
  for (const k of keys) if (!BACKGROUNDS[k]) throw new Error(`unknown background ${k}`);
  await ensureBackgrounds(keys.length ? keys : Object.keys(BACKGROUNDS), { force });
  console.log(`backgrounds ready in ${BG_DIR}`);
}
