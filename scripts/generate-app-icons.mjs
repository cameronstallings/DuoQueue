// scripts/generate-app-icons.mjs — regenerates DuoQueue's Volt app icon set.
//
// The mark: Cameron's interlocked-rings monogram (an O-ring and a Q-ring woven
// together — the duo, locked), re-hued for Volt: volt ring over ink-white ring
// with knocked-out crossings. Flat and geometric — no glow, no gradient blend —
// in line with the rest of the Volt restyle. The in-app vector twin lives in
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
 * Geometry for the interlocked-rings monogram (Cameron's logo, re-hued for
 * Volt): an O-ring and a Q-ring woven together — the duo, locked. Ring A
 * (volt) passes over ring B (ink-white) with a knocked-out halo at both
 * crossings, done with an SVG mask so the gap is true transparency (required
 * for the adaptive-foreground / monochrome / notification variants — a
 * painted background halo would ghost on transparent canvases).
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

/** The rings mark — deliberately hue-free: DuoQueue doubles as the umbrella
 * dev-company brand, so the mark is one warm ink at two strengths (front ring
 * full, Q ring ~58%) and sits on any app's colorway. The weave gap is
 * transparent. */
const INK = "#F5F3EE";
const DUO_OPACITY = 0.58;

function ringsMark(scale = FULL_SCALE, ink = INK, _maskId = "weave", duoOpacity = DUO_OPACITY) {
  const { R, W, cxB, cy, tail } = ringGeometry(scale);
  // The Q is a true arc with ROUND end-caps (no mask slice — a masked cut left
  // a flat edge where the front ring crossed it). ±103° off the leftward axis
  // pulls each cap back far enough to leave the weave's breathing gap.
  const a = (103 * Math.PI) / 180;
  const sx = cxB + R * Math.cos(-a);
  const sy = cy + R * Math.sin(-a);
  const ex = cxB + R * Math.cos(a);
  const ey = cy + R * Math.sin(a);
  const { cxA } = ringGeometry(scale);
  return `<g opacity="${duoOpacity}">
      <path d="M ${sx} ${sy} A ${R} ${R} 0 1 1 ${ex} ${ey}" fill="none" stroke="${ink}" stroke-width="${W}" stroke-linecap="round" />
      <circle cx="${tail.cx}" cy="${tail.cy}" r="${tail.r}" fill="${ink}" />
    </g>
    <circle cx="${cxA}" cy="${cy}" r="${R}" fill="none" stroke="${ink}" stroke-width="${W}" />`;
}

/** Solid-white silhouette variant for the Android themed icon + notification
 * icon: both rings full-strength — these render as alpha masks, and a faded
 * ring would tint weakly. The weave gaps still carry the interlock. */
function ringsMarkMono(scale = SAFE_SCALE) {
  return ringsMark(scale, "#FFFFFF", "weaveMono", 1);
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
