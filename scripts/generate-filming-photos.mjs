// scripts/generate-filming-photos.mjs — turns Cameron's own photos into the demo-profile
// photo set used ONLY when filming marketing footage.
//
// Why this exists, and why it is separate from assets/demo/:
//
// The 14 abstract avatars in assets/demo/ (scripts/generate-demo-avatars.mjs) are what App
// Review approved, and their own header explains the constraint: only the flagged review
// account can see them, so they must never be mistakable for a photo of a real person. That
// was right for review and those files are not touched here.
//
// Filming is a different job. The 60-second app recording is the raw material for two of the
// four marketing video formats, so whatever the deck looks like on camera is what the
// marketing looks like, and a deck of abstract geometry reads as placeholder art. This
// produces a parallel set from real photos, selected with `--filming` on the seed script,
// and reverted by re-seeding without the flag.
//
// Two output shapes per source photo, because the seed uploads the same image for both the
// `profile` and `header` roles and they are cropped very differently by the app:
//   *-profile.png  1024x1024  square; the avatar, often rendered small and circular
//   *-header.png   1200x1600  3:4 portrait; the deck card cover, contentFit="cover"
// A single square file cover-fitted onto a portrait card crops top and bottom, which
// decapitates anyone whose face is not dead centre. Hence two crops, not one.
//
// Cropping uses sharp's `attention` strategy rather than a centre crop: it picks the region
// with the highest visual salience, which lands on faces and animals far more reliably than
// the geometric centre does. Verified per-photo by eye after generation, because "usually
// reliable" is not the same as reliable.
//
// EXIF is stripped from every output. The source photos carry no GPS (checked), but camera
// metadata has no business shipping in marketing assets, and the app's own upload pipeline
// strips EXIF for user photos, so this path should not be the exception.
//
// Source photos live outside the repo by default, since they are personal photographs of
// identifiable people and do not belong in git. Only the processed outputs are committed.
//
// Run: node scripts/generate-filming-photos.mjs [sourceDir]
import sharp from "sharp";
import { readdirSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_DIR = process.argv[2] ?? "C:/Users/stall/Pictures/duoqueue-filming";
const OUT_DIR = path.join(__dirname, "..", "assets", "demo-filming");
const ABSTRACT_DIR = path.join(__dirname, "..", "assets", "demo");

const PROFILE_SIZE = 1024;
const HEADER_W = 1200;
const HEADER_H = 1600;

if (!existsSync(SOURCE_DIR)) {
  console.error(`source directory not found: ${SOURCE_DIR}`);
  console.error("Put the photos there, or pass a directory as the first argument.");
  process.exit(1);
}

// The persona order in seed-review-demo.mjs. Filming photos are assigned to these in order,
// so the personas most likely to be on camera get real photos first. Any persona beyond the
// number of available source photos keeps its abstract avatar, which is why this script
// reports the split rather than silently covering it up.
const AVATAR_NAMES = readdirSync(ABSTRACT_DIR)
  .filter((f) => f.endsWith(".png"))
  .sort();

const sources = readdirSync(SOURCE_DIR)
  .filter((f) => /\.(jpe?g|png|heic)$/i.test(f))
  .sort();

if (sources.length === 0) {
  console.error(`no images found in ${SOURCE_DIR}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

console.log(`${sources.length} source photo(s), ${AVATAR_NAMES.length} demo personas\n`);

let made = 0;
for (const [i, src] of sources.entries()) {
  const target = AVATAR_NAMES[i];
  if (!target) {
    console.log(`skipping ${src}: more photos than personas`);
    continue;
  }
  const stem = target.replace(/\.png$/, "");
  const inPath = path.join(SOURCE_DIR, src);

  for (const [suffix, w, h] of [
    ["profile", PROFILE_SIZE, PROFILE_SIZE],
    ["header", HEADER_W, HEADER_H],
  ]) {
    const outPath = path.join(OUT_DIR, `${stem}-${suffix}.png`);
    await sharp(inPath)
      // Applies the EXIF orientation flag as real pixels. Five of these photos are stored
      // landscape with orientation 6, so without this every crop would be sideways.
      .rotate()
      .resize(w, h, { fit: "cover", position: sharp.strategy.attention })
      .png({ compressionLevel: 9 })
      .toFile(outPath); // sharp drops metadata unless withMetadata() is called
    made++;
  }
  console.log(`${src.padEnd(20)} -> ${stem}-{profile,header}.png`);
}

console.log(`\nwrote ${made} files to assets/demo-filming/`);

const covered = Math.min(sources.length, AVATAR_NAMES.length);
if (covered < AVATAR_NAMES.length) {
  console.log(
    `\n${covered} of ${AVATAR_NAMES.length} personas have real photos. The remaining ` +
      `${AVATAR_NAMES.length - covered} keep their abstract avatars.`,
  );
  console.log(`Add more photos to ${SOURCE_DIR} and re-run to cover them.`);
}

// Verify rather than assume: re-read every output and confirm the dimensions and the absence
// of metadata, because a silently wrong crop is only visible once it is already on camera.
console.log("\nverifying...");
let bad = 0;
for (const f of readdirSync(OUT_DIR).filter((n) => n.endsWith(".png"))) {
  const m = await sharp(path.join(OUT_DIR, f)).metadata();
  const wantW = f.endsWith("-profile.png") ? PROFILE_SIZE : HEADER_W;
  const wantH = f.endsWith("-profile.png") ? PROFILE_SIZE : HEADER_H;
  const okDims = m.width === wantW && m.height === wantH;
  const okMeta = !m.exif;
  if (!okDims || !okMeta) {
    bad++;
    console.log(`  FAIL ${f}: ${m.width}x${m.height} exif:${m.exif ? "present" : "none"}`);
  }
}
console.log(bad === 0 ? "all outputs correct: exact dimensions, no EXIF" : `${bad} file(s) wrong`);
process.exit(bad === 0 ? 0 : 1);
