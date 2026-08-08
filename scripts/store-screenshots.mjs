// Resizes iPhone captures to a size App Store Connect accepts for store listing
// screenshots (the 6.9" bucket, which ASC auto-scales down to every smaller iPhone).
//
// Unlike the IAP review screenshot (scripts/iap-review-screenshot.mjs, 640x920, padded),
// these are stretched to the exact target rather than padded: letterbox bars would show
// on the actual product page. Every Face-ID iPhone is within ~0.5% of the target aspect
// (1170x2532 is 2.164:1, 1320x2868 is 2.173:1), so the distortion is not perceptible.
// An iPhone SE is a genuinely different shape — do not feed one of those in.
//
// Run: node scripts/store-screenshots.mjs <file-or-dir> [--size 1290x2796] [--out <dir>]
import sharp from "sharp";
import { readdirSync, statSync, mkdirSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

const ACCEPTED = { "1320x2868": [1320, 2868], "1290x2796": [1290, 2796], "1260x2736": [1260, 2736] };

const args = process.argv.slice(2);
const input = args[0];
if (!input) {
  console.error("usage: node scripts/store-screenshots.mjs <file-or-dir> [--size 1320x2868] [--out <dir>]");
  console.error("accepted sizes: " + Object.keys(ACCEPTED).join(", "));
  process.exit(1);
}
// indexOf returns -1 when the flag is absent, and args[-1 + 1] is the input path — so the
// presence check has to come first, not a bare `?? default`.
const sizeIdx = args.indexOf("--size");
const sizeKey = sizeIdx === -1 ? "1320x2868" : args[sizeIdx + 1];
const target = ACCEPTED[sizeKey];
if (!target) {
  console.error(`unknown size "${sizeKey}". accepted: ${Object.keys(ACCEPTED).join(", ")}`);
  process.exit(1);
}
const outIdx = args.indexOf("--out");
const outDir = outIdx === -1 ? null : args[outIdx + 1];

const isDir = statSync(input).isDirectory();
const files = isDir
  ? readdirSync(input)
      .filter((f) => /\.(png|jpe?g)$/i.test(f) && !f.includes("-asc"))
      .map((f) => join(input, f))
      .sort()
  : [input];

if (!files.length) {
  console.error("no .png/.jpg files found in " + input);
  process.exit(1);
}

const dest = outDir ?? (isDir ? join(input, "asc") : null);
if (dest) mkdirSync(dest, { recursive: true });

let failed = 0;
for (const file of files) {
  const stem = basename(file, extname(file));
  const out = join(dest ?? dirname(file), `${stem}-asc.png`);
  const before = await sharp(file).metadata();

  await sharp(file)
    // `fill` hits the exact dimensions ASC demands. See the note above on why a sub-half-
    // percent stretch is the right trade against visible bars on the product page.
    .resize(target[0], target[1], { fit: "fill" })
    .flatten({ background: "#FFFFFF" })
    .toColorspace("srgb")
    .withMetadata({ density: 72 })
    .png({ compressionLevel: 9 })
    .toFile(out);

  const after = await sharp(out).metadata();
  const ok = after.width === target[0] && after.height === target[1] && !after.hasAlpha;
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${basename(file)}  ${before.width}x${before.height} -> ${after.width}x${after.height}`,
  );
}

console.log(`\n${files.length - failed}/${files.length} written${dest ? " to " + dest : ""} at ${sizeKey}.`);
if (failed) process.exit(1);
