// scripts/generate-app-icons.mjs — regenerates DuoQueue's Aurora app icon set.
//
// The mark: two soft glowing orbs — pink up-left, violet down-right — overlapping
// about 40% in the center, with a faint lighter highlight where they blend. This
// mirrors AuroraBackground.tsx's pink/violet pairing (src/components/AuroraBackground.tsx)
// but bolder/bigger, since an icon has to read at 60px instead of filling a screen.
//
// Run: node scripts/generate-app-icons.mjs
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "..", "apps", "mobile", "assets");

const BG = "#14101F";
const PINK = "#CB427B";
const VIOLET = "#8452F5";
const HIGHLIGHT = "#F3ECFF";

const CANVAS = 1024;
const CENTER = CANVAS / 2;

/** A radial-gradient disc def: solid-ish core, soft glow falloff at the rim. */
function glowGradientDef(id, color) {
  return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${color}" stop-opacity="1" />
    <stop offset="55%" stop-color="${color}" stop-opacity="0.92" />
    <stop offset="85%" stop-color="${color}" stop-opacity="0.45" />
    <stop offset="100%" stop-color="${color}" stop-opacity="0" />
  </radialGradient>`;
}

/**
 * The duo mark: two overlapping glow discs + a soft highlight at the blend point.
 * `radius`/`offset` control size and how far apart the two centers sit — offset is
 * derived elsewhere from radius to keep ~40% overlap between the two circles.
 */
function duoMark({ size = CANVAS, radius, offset, highlightOpacity = 0.5 }) {
  const c = size / 2;
  const pink = { x: c - offset, y: c - offset };
  const violet = { x: c + offset, y: c + offset };
  const highlightR = radius * 0.55;
  return `<defs>
      ${glowGradientDef("pinkGlow", PINK)}
      ${glowGradientDef("violetGlow", VIOLET)}
      <radialGradient id="highlight" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${HIGHLIGHT}" stop-opacity="${highlightOpacity}" />
        <stop offset="100%" stop-color="${HIGHLIGHT}" stop-opacity="0" />
      </radialGradient>
    </defs>
    <circle cx="${pink.x}" cy="${pink.y}" r="${radius}" fill="url(#pinkGlow)" />
    <circle cx="${violet.x}" cy="${violet.y}" r="${radius}" fill="url(#violetGlow)" opacity="0.94" />
    <circle cx="${c}" cy="${c}" r="${highlightR}" fill="url(#highlight)" />`;
}

/** Given a target "reach" (max distance from canvas center a disc may extend to),
 * returns {radius, offset} that keep ~40% overlap between the two discs.
 * Derivation: offset = 0.4243 * radius (for 40% overlap), reach = offset*sqrt(2) + radius = 1.6 * radius. */
function sizeForReach(reach) {
  const radius = Math.round(reach / 1.6);
  const offset = Math.round(radius * 0.4243);
  return { radius, offset };
}

// Bold/full-bleed sizing for the base icon and splash (no adaptive-icon safe-zone
// constraint) — reach ~416px on a 1024 canvas, ~9% margin to the edge.
const ICON_SIZING = sizeForReach(416);
// Android adaptive icons only guarantee the center 66% circle is never masked off —
// diameter 1024*0.66 = 676, radius 338. Keep a small buffer under that.
const SAFE_SIZING = sizeForReach(320);

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
  const iconSvg = svgDoc(duoMark(ICON_SIZING), { background: BG });
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
  const foregroundSvg = svgDoc(duoMark(SAFE_SIZING));
  const foregroundBuffer = await sharp(Buffer.from(foregroundSvg)).resize(CANVAS, CANVAS).png().toBuffer();
  writeFileSync(path.join(ASSETS, "android-icon-foreground.png"), foregroundBuffer);
  console.log("wrote android-icon-foreground.png");

  // 3. android-icon-background.png — solid field with a faint corner wash (pink
  //    up-left, violet down-right — same pairing as the mark, just much fainter).
  const backgroundInner = `<defs>
      <radialGradient id="washPink" cx="12%" cy="12%" r="60%">
        <stop offset="0%" stop-color="${PINK}" stop-opacity="0.16" />
        <stop offset="100%" stop-color="${PINK}" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="washViolet" cx="88%" cy="88%" r="60%">
        <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0.16" />
        <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="${CANVAS}" height="${CANVAS}" fill="url(#washPink)" />
    <rect width="${CANVAS}" height="${CANVAS}" fill="url(#washViolet)" />`;
  const backgroundSvg = svgDoc(backgroundInner, { background: BG });
  const backgroundBuffer = await sharp(Buffer.from(backgroundSvg)).resize(CANVAS, CANVAS).png().toBuffer();
  writeFileSync(path.join(ASSETS, "android-icon-background.png"), backgroundBuffer);
  console.log("wrote android-icon-background.png");

  // 4. android-icon-monochrome.png — solid white-alpha silhouette, no gradients.
  //    Same geometry as the foreground so the themed-icon silhouette matches the mark.
  const c = CENTER;
  const { radius, offset } = SAFE_SIZING;
  const monoInner = `<circle cx="${c - offset}" cy="${c - offset}" r="${radius}" fill="#FFFFFF" />
    <circle cx="${c + offset}" cy="${c + offset}" r="${radius}" fill="#FFFFFF" />`;
  const monoSvg = svgDoc(monoInner);
  const monoBuffer = await sharp(Buffer.from(monoSvg)).resize(CANVAS, CANVAS).png().toBuffer();
  writeFileSync(path.join(ASSETS, "android-icon-monochrome.png"), monoBuffer);
  console.log("wrote android-icon-monochrome.png");

  // 5. splash-icon.png — the mark, transparent bg, full bold sizing (no adaptive
  //    safe-zone constraint here — it sits centered on the splash backgroundColor).
  const splashSvg = svgDoc(duoMark(ICON_SIZING));
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
