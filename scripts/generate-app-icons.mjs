// scripts/generate-app-icons.mjs — regenerates DuoQueue's Volt app icon set.
//
// The mark: two volt double chevrons, "»" — queue-forward. Each chevron is a
// solid right-pointing wedge polygon (`M x0,y0 L x0+w,yMid L x0,y1 Z`); the
// second sits offset right of the first at reduced opacity, echoing the
// forward-motion "next in queue" idea. Flat and geometric — no glow, no
// gradient blend — in line with the rest of the Volt restyle (see
// docs/superpowers/plans/2026-08-03-volt-restyle.md).
//
// Run: node scripts/generate-app-icons.mjs
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "..", "apps", "mobile", "assets");

const BG = "#0A0B09";
const VOLT = "#CDFF3D";

const CANVAS = 1024;
const CENTER = CANVAS / 2;

// Full-bleed (base icon.png / splash-icon.png) vs adaptive-icon safe-zone
// (android-icon-foreground.png / android-icon-monochrome.png) scale, carried
// over from the previous aurora sizing matrix: Android adaptive icons only
// guarantee the center 66% circle (radius 338 on a 1024 canvas) is never
// masked off, so the safe-zone mark is scaled down from the full-bleed one
// by the same 320/416 ratio the old reach-based sizing used.
const FULL_SCALE = 1;
const SAFE_SCALE = 320 / 416;

/**
 * Geometry for one instance of the double-chevron mark at a given scale.
 * `w` (chevron weight) is ~18% of the canvas at full scale; height is 2x
 * weight for a tall, bold wedge. The pair is nudged ~2% left of true center
 * because two right-pointing wedges read right-heavy — the offset corrects
 * the optical imbalance.
 */
function chevronGeometry(scale) {
  const w = CANVAS * 0.18 * scale;
  const h = w * 2;
  const gap = w * 0.55;
  const nudge = CANVAS * 0.02;
  const x0 = CENTER - nudge - (w + gap) / 2;
  return { x0, w, h, gap, yMid: CENTER };
}

/** A single chevron: a solid right-pointing wedge polygon. */
function chevronPath(x0, w, h, yMid) {
  const y0 = yMid - h / 2;
  const y1 = yMid + h / 2;
  return `M ${x0} ${y0} L ${x0 + w} ${yMid} L ${x0} ${y1} Z`;
}

/** The queue-forward mark in volt, at the given scale. */
function chevronMark(scale = FULL_SCALE) {
  const { x0, w, h, gap, yMid } = chevronGeometry(scale);
  return `<path d="${chevronPath(x0, w, h, yMid)}" fill="${VOLT}" />
    <path d="${chevronPath(x0 + gap, w, h, yMid)}" fill="${VOLT}" opacity="0.55" />`;
}

/** Same geometry, solid white — for the Android themed-icon silhouette, which
 * the OS tints with a single system color. */
function chevronMarkMono(scale = SAFE_SCALE) {
  const { x0, w, h, gap, yMid } = chevronGeometry(scale);
  return `<path d="${chevronPath(x0, w, h, yMid)}" fill="#FFFFFF" />
    <path d="${chevronPath(x0 + gap, w, h, yMid)}" fill="#FFFFFF" opacity="0.55" />`;
}

function svgDoc(inner, { background } = {}) {
  const bg = background ? `<rect width="${CANVAS}" height="${CANVAS}" fill="${background}" />` : "";
  return `<svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg">
    ${bg}
    ${inner}
  </svg>`;
}

async function main() {
  // 1. icon.png — mark on the dark field, plus a whisper of grain (same noise.png
  //    tile GrainOverlay.tsx uses, mirrored here since Image can't be used at build time).
  const iconSvg = svgDoc(chevronMark(FULL_SCALE), { background: BG });
  const noiseTile = readFileSync(path.join(ASSETS, "noise.png"));
  const iconBuffer = await sharp(Buffer.from(iconSvg))
    .resize(CANVAS, CANVAS)
    .composite([{ input: noiseTile, tile: true, blend: "over" }])
    .png()
    .toBuffer();
  writeFileSync(path.join(ASSETS, "icon.png"), iconBuffer);
  console.log("wrote icon.png");

  // 2. android-icon-foreground.png — mark only, transparent, sized within the
  //    adaptive-icon safe zone (center 66% circle).
  const foregroundSvg = svgDoc(chevronMark(SAFE_SCALE));
  const foregroundBuffer = await sharp(Buffer.from(foregroundSvg)).resize(CANVAS, CANVAS).png().toBuffer();
  writeFileSync(path.join(ASSETS, "android-icon-foreground.png"), foregroundBuffer);
  console.log("wrote android-icon-foreground.png");

  // 3. android-icon-background.png — flat background field, no wash or glow
  //    (Volt drops the aurora-era gradient blends everywhere else too).
  const backgroundSvg = svgDoc("", { background: BG });
  const backgroundBuffer = await sharp(Buffer.from(backgroundSvg)).resize(CANVAS, CANVAS).png().toBuffer();
  writeFileSync(path.join(ASSETS, "android-icon-background.png"), backgroundBuffer);
  console.log("wrote android-icon-background.png");

  // 4. android-icon-monochrome.png — solid white-alpha silhouette, no color.
  //    Same geometry as the foreground so the themed-icon silhouette matches the mark.
  const monoSvg = svgDoc(chevronMarkMono(SAFE_SCALE));
  const monoBuffer = await sharp(Buffer.from(monoSvg)).resize(CANVAS, CANVAS).png().toBuffer();
  writeFileSync(path.join(ASSETS, "android-icon-monochrome.png"), monoBuffer);
  console.log("wrote android-icon-monochrome.png");

  // 5. splash-icon.png — the mark, transparent bg, full bold sizing (no adaptive
  //    safe-zone constraint here — it sits centered on the splash backgroundColor).
  const splashSvg = svgDoc(chevronMark(FULL_SCALE));
  const splashBuffer = await sharp(Buffer.from(splashSvg)).resize(CANVAS, CANVAS).png().toBuffer();
  writeFileSync(path.join(ASSETS, "splash-icon.png"), splashBuffer);
  console.log("wrote splash-icon.png");

  // 6. favicon.png — 48x48 downsize of the icon (not re-rendered from SVG, so it's
  //    a literal "version of icon.png" per spec).
  const faviconBuffer = await sharp(iconBuffer).resize(48, 48).png().toBuffer();
  writeFileSync(path.join(ASSETS, "favicon.png"), faviconBuffer);
  console.log("wrote favicon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
