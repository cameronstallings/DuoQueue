// scripts/generate-launch-splash.ts — draws the iOS native splash: the O and the Q apart.
//
// The launch intro (apps/mobile/src/features/launch/LaunchIntro.tsx) opens on RingsLock at
// progress 0 and woven 0, drawn over this image, and hides the native splash only once it is on
// screen. So this image has to BE that frame: the same shapes from the same geometry module, in
// the same order (the Q ring and its nub, then the O ring; the weave is off until the lock), each
// ring moved RING_TRAVEL_UNITS from its locked place, in the dark palette the overlay uses.
//
// iOS draws the image into a SPLASH_IMAGE_WIDTH-point square centred on the screen (app.json's
// expo-splash-screen imageWidth, which launchTiming.test.ts ties to the constant). The square is
// centred where RingsLock's box is centred, at LAUNCH_MARK_W points per locked-mark width. It is
// drawn at the @3x size, so the @3x asset expo cuts from it is this file unchanged.
//
// Android keeps splash-icon.png (scripts/generate-app-icons.mjs): see ANDROID_SPLASH_IMAGE_WIDTH.
//
// Run: pnpm tsx scripts/generate-launch-splash.ts
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import path from "node:path";

import {
  LAUNCH_PALETTE,
  ringsApartBounds,
  SPLASH_IMAGE_PX,
  splashViewBox,
} from "../apps/mobile/src/features/launch/launchTiming";
import { RING_TRAVEL_UNITS } from "../apps/mobile/src/features/match/matchMoment";
import { CXA, CXB, CY, NUB, R, W } from "../apps/mobile/src/theme/logo-geometry";

const OUT = path.join(__dirname, "..", "apps", "mobile", "assets", "splash-rings-apart.png");

async function main() {
  const box = splashViewBox();
  const reach = ringsApartBounds();
  // Fail loudly rather than ship a splash with a ring cut off at the edge of its square.
  if (reach.left <= box.x || reach.right >= box.x + box.size || reach.top <= box.y || reach.bottom >= box.y + box.size) {
    throw new Error(`the rings apart (${JSON.stringify(reach)}) do not fit the splash square (${JSON.stringify(box)})`);
  }

  const t = RING_TRAVEL_UNITS;
  const { ink, duo } = LAUNCH_PALETTE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SPLASH_IMAGE_PX}" height="${SPLASH_IMAGE_PX}" viewBox="${box.x} ${box.y} ${box.size} ${box.size}">
  <g transform="translate(${t} 0)">
    <circle cx="${CXB}" cy="${CY}" r="${R}" fill="none" stroke="${duo}" stroke-width="${W}" />
    <circle cx="${NUB.cx}" cy="${NUB.cy}" r="${NUB.r}" fill="${duo}" />
  </g>
  <g transform="translate(${-t} 0)">
    <circle cx="${CXA}" cy="${CY}" r="${R}" fill="none" stroke="${ink}" stroke-width="${W}" />
  </g>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== SPLASH_IMAGE_PX || meta.height !== SPLASH_IMAGE_PX) {
    throw new Error(`rendered ${meta.width}x${meta.height}, expected ${SPLASH_IMAGE_PX}x${SPLASH_IMAGE_PX}`);
  }
  writeFileSync(OUT, png);
  console.log(`wrote ${path.relative(process.cwd(), OUT)} (${SPLASH_IMAGE_PX}x${SPLASH_IMAGE_PX})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
