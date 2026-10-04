#!/usr/bin/env node
// Builds the photo backgrounds the slideshows use: 2160x3840 JPGs (2x the slide size) in
// cache/bg/. Stills come from Cameron's own RAW takes, tone-mapped with his approved look;
// photos come from Pictures\duoqueue-filming, cropped so no game screen and no other person
// is in frame. render.mjs imports BACKGROUNDS for the caption notes.
//
//   node backgrounds.mjs                    build the missing ones
//   node backgrounds.mjs --force            rebuild all of them
//   node backgrounds.mjs --force <key> ...  rebuild only these keys
//
// Needs ffmpeg with libplacebo on PATH (the gyan.dev full build has it).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BG_DIR = path.join(HERE, "cache", "bg");
const VIDEOS = process.env.UGC_DIR || "C:\\Users\\stall\\Videos\\UGC";
const PHOTOS = process.env.PHOTO_DIR || "C:\\Users\\stall\\Pictures\\duoqueue-filming";

// The approved UGC tone map (Videos\UGC\tools\render_cut.py), skin smoothing scaled 2x for 4K.
const TONEMAP =
  "libplacebo=w=2160:h=3840:tonemapping=bt.2390:colorspace=bt709:color_primaries=bt709:" +
  "color_trc=bt709:range=pc:format=yuvj420p,bilateral=sigmaS=12:sigmaR=0.045:planes=1";
// The week-2 grade he approved (the white room was too bright).
const WEEK2 = ",eq=gamma=0.86:contrast=1.04,curves=all='0/0 0.75/0.70 1/0.94'";

// key -> where it comes from and what it shows (the "about" line goes into caption.txt).
// Never add IMG_6075 or IMG_6236 (other people), IMG_2785 (shirtless selfie) or IMG_2825 (sword).
export const BACKGROUNDS = {
  "v01-w1-thinking-hand-on-chin": { take: "week-1\\RAW - FF15.MOV", t: 16.845, about: "you mid-sentence, hand at your chin, looking at the camera" },
  "v02-w1-eyes-down-serious": { take: "week-1\\RAW - FF15.MOV", t: 43.128, about: "you looking down, serious" },
  "v03-w1-heavy-lidded-unimpressed": { take: "week-1\\RAW - Just launched.MOV", t: 61.995, about: "close-up, heavy-lidded and tired-looking" },
  "v04-w1-dead-straight-stare": { take: "week-1\\RAW - Solo queue again.MOV", t: 0, about: "close-up, dead-straight stare at the camera" },
  "v05-w1-head-tilt-deadpan": { take: "week-1\\RAW - Solo queue again.MOV", t: 18.762, about: "head tilt, deadpan 'really?' look" },
  // 40.85: head tipped back, glaring down at the camera, mouth open (41.26 was calm, hand at collar)
  "v06-w1-exasperated-head-back": { take: "week-1\\RAW - Solo queue again.MOV", t: 40.85, about: "head tipped back, glaring down at the camera mid-word, exasperated" },
  // 61.74: mid-rant eye-roll. The fist at 61.8 sat behind the text panel, so the face carries it now.
  "v07-w1-ranting-squint": { take: "week-1\\RAW - Solo queue again.MOV", t: 61.74, about: "mid-rant, head tilted, rolling your eyes, irritated" },
  "v08-w2-side-glance-pensive": { take: "week-2\\RAW - Can't even queue.MOV", t: 22.445, about: "side glance, thinking it over" },
  "v09-w2-pointing-at-viewer": { take: "week-2\\RAW - Can't even queue.MOV", t: 115.978, about: "pointing at the viewer" },
  "v10-w2-closeup-deflated-looking-down": { take: "week-2\\RAW - Can't even queue.MOV", t: 110.328, about: "close-up, looking down, deflated" },
  "v11-w2-hand-over-face-eyes-shut": { take: "week-2\\RAW - Five in a row.MOV", t: 95.645, about: "eyes shut, hand over your face, worn out" },
  "v12-w2-flat-unimpressed-stare": { take: "week-2\\RAW - Five in a row.MOV", t: 99.428, about: "flat, unimpressed stare at the camera" },
  "v13-w2-one-finger-up": { take: "week-2\\RAW - Friends quit.MOV", t: 3.728, about: "one finger up, looking to the side" },
  "v14-w2-eyes-down-alone": { take: "week-2\\RAW - Friends quit.MOV", t: 52.512, about: "eyes half shut, turned away, drowsy" },
  "v15-w2-closeup-determined-stare": { take: "week-2\\RAW - Friends quit.MOV", t: 76.828, about: "close-up, calm determined stare" },
  "v16-w2-explaining-brow-raised": { take: "week-2\\RAW - Can't even queue.MOV", t: 72.895, about: "explaining, one brow raised" },
  // his shoulder at the right edge is cropped away, then scaled back up to 9:16
  "v17-w2-empty-room": { take: "week-2\\RAW - Couldn't climb.MOV", t: 142.212, crop: "crop=1250:2222:0:800,scale=2160:3840:flags=lanczos", about: "your empty apartment, nobody in frame" },
  // photos: ffmpeg applies the iPhone EXIF rotation itself, so crops are in upright pixels (4284x5712)
  "p01-cat-closeup-staring": { photo: "IMG_2557.jpeg", crop: "crop=3213:5712:750:0", about: "your orange cat staring into the lens" },
  // the top third of this photo is a game's end screen on the monitor: start the crop below it
  "p02-sleepy-cat-on-desk": { photo: "IMG_2746.jpeg", crop: "crop=2088:3712:900:2000", about: "your cat asleep on your desk (the monitor is cropped out)" },
  "p03-two-cats-at-window": { photo: "IMG_2820.jpeg", crop: "crop=3213:5712:640:0", about: "your two cats at the window" },
};

export function bgPath(key) {
  return path.join(BG_DIR, `${key}.jpg`);
}

export function bgSourceNote(key) {
  const b = BACKGROUNDS[key];
  if (!b) throw new Error(`unknown background ${key}`);
  return b.photo
    ? `your photo ${b.photo}: ${b.about}`
    : `a still from your raw take ${b.take} at ${b.t.toFixed(1)} s: ${b.about}`;
}

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr || r.error}`);
}

function probeSize(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf8" });
  return r.stdout.trim();
}

export function buildBackground(key) {
  const b = BACKGROUNDS[key];
  const out = bgPath(key);
  fs.mkdirSync(BG_DIR, { recursive: true });
  if (b.photo) {
    ffmpeg(["-i", path.join(PHOTOS, b.photo), "-frames:v", "1", "-vf", `${b.crop},scale=2160:3840:flags=lanczos`, "-q:v", "2", out]);
  } else {
    const week2 = b.take.startsWith("week-2");
    const vf = TONEMAP + (week2 ? WEEK2 : "") + (b.crop ? `,${b.crop}` : "");
    ffmpeg(["-ss", String(b.t), "-i", path.join(VIDEOS, b.take), "-an", "-frames:v", "1", "-vf", vf, "-q:v", "2", out]);
  }
  const size = probeSize(out);
  if (size !== "2160,3840") throw new Error(`${key}: expected 2160x3840, got ${size}`);
  return out;
}

export function ensureBackgrounds(keys, { force = false, log = console.log } = {}) {
  for (const key of keys) {
    if (!BACKGROUNDS[key]) throw new Error(`unknown background ${key}`);
    if (!force && fs.existsSync(bgPath(key))) continue;
    log(`  building background ${key}`);
    buildBackground(key);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const keys = args.filter((a) => a !== "--force");
  for (const k of keys) if (!BACKGROUNDS[k]) throw new Error(`unknown background ${k}`);
  ensureBackgrounds(keys.length ? keys : Object.keys(BACKGROUNDS), { force });
  console.log(`backgrounds ready in ${BG_DIR}`);
}
