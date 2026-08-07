// Converts a phone screenshot into the image App Store Connect accepts for an in-app
// purchase's Review Information screenshot.
//
// The size is 640x920, and it is worth writing down why, because it is not guessable:
// this field is NOT the store-listing screenshot field and does NOT take the sizes on
// Apple's screenshot-specifications page. Uploading a real device capture (1320x2868,
// 1284x2778, 1179x2556 ...) is rejected with "The dimensions of one or more screenshots
// are wrong." So is 1024x1024, which is the *promotional image* spec and the thing most
// people reach for first. 640x920 is the size that is actually accepted.
// See https://developer.apple.com/forums/thread/813399
//
// A phone capture is roughly 1:2 and 640x920 is 1:1.44, so it cannot fit without either
// distorting or losing content. It is padded, never stretched or cropped — a reviewer
// needs to read the whole purchase screen. Padding is the app's own light-mode background
// (#F2F4EB, tokens.ts) so the result reads as one screen, not a screenshot on white.
//
// Run: node scripts/iap-review-screenshot.mjs <input.png> [output.png]
import sharp from "sharp";
import { basename, dirname, join } from "node:path";

const WIDTH = 640;
const HEIGHT = 920;
const PAPER = { r: 0xf2, g: 0xf4, b: 0xeb }; // colors.light.background

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/iap-review-screenshot.mjs <input.png> [output.png]");
  process.exit(1);
}
const output = process.argv[3] ?? join(dirname(input), basename(input).replace(/\.\w+$/, "") + "-640x920.png");

const before = await sharp(input).metadata();

await sharp(input)
  // `contain` preserves aspect ratio and pads — no stretch, no crop.
  .resize(WIDTH, HEIGHT, { fit: "contain", background: PAPER })
  // Apple rejects an alpha channel; flatten onto the same paper so the seam is invisible.
  .flatten({ background: PAPER })
  .toColorspace("srgb")
  .withMetadata({ density: 72 })
  .png({ compressionLevel: 9 })
  .toFile(output);

const after = await sharp(output).metadata();
console.log(`in : ${before.width}x${before.height}  alpha=${before.hasAlpha}  ${before.space}`);
console.log(`out: ${after.width}x${after.height}  alpha=${after.hasAlpha}  ${after.space}  ${after.density}dpi`);
console.log(`\nwrote ${output}`);

if (after.width !== WIDTH || after.height !== HEIGHT || after.hasAlpha) {
  console.error("\nFAILED to meet the spec — do not upload this.");
  process.exit(1);
}
console.log(`Meets the spec App Store Connect actually enforces: ${WIDTH}x${HEIGHT}, sRGB, no alpha.`);
