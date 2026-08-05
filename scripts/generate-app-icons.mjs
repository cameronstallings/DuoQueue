// scripts/generate-app-icons.mjs — regenerates DuoQueue's Volt app icon set.
//
// The mark: Cameron's interlocked-rings monogram — an O-ring and a Q-ring in a
// true chain weave (O over Q up top, Q over O below), hue-free: one warm ink at
// two strengths so the mark doubles as the umbrella dev-company brand on any
// colorway. The in-app vector twin lives in
// apps/mobile/src/components/Logo.tsx — keep the geometry constants in sync.
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
 * Shared geometry for the rings monogram (both weave and open variants).
 */
function ringGeometry(scale) {
  const R = CANVAS * 0.21 * scale; // ring centerline radius
  const W = R * 0.46; // stroke weight
  const d = R * 1.5; // center-to-center distance — bands cross, holes stay open
  // Nudge ~1.2% left: the Q's nub adds right-side mass, this recenters optically.
  const nudge = CANVAS * 0.012;
  const cxA = CENTER - nudge - d / 2;
  const cxB = CENTER - nudge + d / 2;
  const halo = W * 0.42; // knockout breathing gap around ring A
  // Q tail: a round nub riding the band's outer edge at 45° bottom-right.
  const k = Math.SQRT1_2;
  const nubDist = R + W * 0.42;
  const tail = {
    cx: cxB + nubDist * k, cy: CENTER + nubDist * k, r: W * 0.56,
  };
  return { R, W, cxA, cxB, cy: CENTER, halo, tail };
}

/** Warm neutral ink — never an app accent; the mark stays brand-neutral. */
const INK = "#F5F3EE";


/** Solid duo-gray: INK pre-blended 58% toward the dark field. The weave needs
 * the Q to paint OVER the O at one crossing, so translucency is not an option —
 * a 58%-opacity stroke would tint where it overlaps instead of covering. */
const DUO_SOLID = "#92918D";

/** True chain interlock, everything round: full Q circle under, O over it,
 * then the Q's bottom-crossing segment repainted on top (butt caps — its ends
 * sit on the visible Q band in the same color, so the joins are seamless).
 * Crossings sit at ±acos(-d/2R) = ±138.6° off B's leftward axis; the overlay
 * segment spans that ±22.5°. */
function ringsMark(scale = FULL_SCALE, ink = INK, duo = DUO_SOLID) {
  const { R, W, cxA, cxB, cy, tail } = ringGeometry(scale);
  const s = ((138.59 - 22.5) * Math.PI) / 180;
  const e = ((138.59 + 22.5) * Math.PI) / 180;
  const seg = `M ${cxB + R * Math.cos(s)} ${cy + R * Math.sin(s)} A ${R} ${R} 0 0 1 ${cxB + R * Math.cos(e)} ${cy + R * Math.sin(e)}`;
  return `<circle cx="${cxB}" cy="${cy}" r="${R}" fill="none" stroke="${duo}" stroke-width="${W}" />
    <circle cx="${tail.cx}" cy="${tail.cy}" r="${tail.r}" fill="${duo}" />
    <circle cx="${cxA}" cy="${cy}" r="${R}" fill="none" stroke="${ink}" stroke-width="${W}" />
    <path d="${seg}" fill="none" stroke="${duo}" stroke-width="${W}" />`;
}

/** Open-arc variant for single-color silhouettes (Android themed icon,
 * notification): with one color the over/under weave is invisible, so the
 * round-capped open Q carries the pairing instead. */
function ringsMarkOpen(scale = FULL_SCALE, ink = "#FFFFFF") {
  const { R, W, cxA, cxB, cy, tail } = ringGeometry(scale);
  const a = (103 * Math.PI) / 180;
  const sx = cxB + R * Math.cos(-a);
  const sy = cy + R * Math.sin(-a);
  const ex = cxB + R * Math.cos(a);
  const ey = cy + R * Math.sin(a);
  return `<path d="M ${sx} ${sy} A ${R} ${R} 0 1 1 ${ex} ${ey}" fill="none" stroke="${ink}" stroke-width="${W}" stroke-linecap="round" />
    <circle cx="${tail.cx}" cy="${tail.cy}" r="${tail.r}" fill="${ink}" />
    <circle cx="${cxA}" cy="${cy}" r="${R}" fill="none" stroke="${ink}" stroke-width="${W}" />`;
}

function ringsMarkMono(scale = SAFE_SCALE) {
  return ringsMarkOpen(scale, "#FFFFFF");
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
  const iconSvg = svgDoc(ringsMark(FULL_SCALE), { background: BG });
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
  const foregroundSvg = svgDoc(ringsMark(SAFE_SCALE));
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
  const monoSvg = svgDoc(ringsMarkMono(SAFE_SCALE));
  const monoBuffer = await sharp(Buffer.from(monoSvg)).resize(CANVAS, CANVAS).png().toBuffer();
  writeFileSync(path.join(ASSETS, "android-icon-monochrome.png"), monoBuffer);
  console.log("wrote android-icon-monochrome.png");

  // 5. splash-icon.png — the mark, transparent bg, full bold sizing (no adaptive
  //    safe-zone constraint here — it sits centered on the splash backgroundColor).
  const splashSvg = svgDoc(ringsMark(FULL_SCALE));
  const splashBuffer = await sharp(Buffer.from(splashSvg)).resize(CANVAS, CANVAS).png().toBuffer();
  writeFileSync(path.join(ASSETS, "splash-icon.png"), splashBuffer);
  console.log("wrote splash-icon.png");

  // 6. favicon.png — 48x48 downsize of the icon (not re-rendered from SVG, so it's
  //    a literal "version of icon.png" per spec).
  const faviconBuffer = await sharp(iconBuffer).resize(48, 48).png().toBuffer();
  writeFileSync(path.join(ASSETS, "favicon.png"), faviconBuffer);
  console.log("wrote favicon.png");

  // 7. notification-icon.png — Android status-bar icon: the OS renders ONLY the
  //    alpha channel (tinted with expo-notifications' `color`), so this must be
  //    white-on-transparent, not the colored adaptive-icon foreground. 96x96 is
  //    the xxhdpi reference size; the plugin downscales for lower densities.
  const notificationSvg = svgDoc(ringsMarkMono(FULL_SCALE));
  const notificationBuffer = await sharp(Buffer.from(notificationSvg)).resize(96, 96).png().toBuffer();
  writeFileSync(path.join(ASSETS, "notification-icon.png"), notificationBuffer);
  console.log("wrote notification-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
