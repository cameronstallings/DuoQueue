// scripts/build-site.mjs — builds the public duoqueue.io site into site/.
//
// Zero dependencies on purpose (matches the rest of this repo's scripts/ policy):
// only node:fs, node:path, node:url. No markdown library, no bundler, no CDN.
// Every page is fully self-contained HTML with an inline <style> block and inline
// SVG, and the only sub-resources any page requests are five .woff2 files served
// from this same origin. No third-party request of any kind, from any page. That
// property is load-bearing twice over: it is what makes the site fast on a phone
// on cellular, and it is what lets the privacy policy say there is no analytics or
// advertising script on duoqueue.io without a caveat.
//
// What this does:
//   docs/legal/privacy-policy.md   -> site/privacy/index.html
//   docs/legal/terms-of-service.md -> site/terms/index.html
//   (hand-written, not from markdown):
//     site/index.html                     the landing page, form and all
//     site/waitlist/index.html            the same page at its canonical-ish path
//     site/tt|ig|yt/index.html            the same page, one hidden field different
//     site/waitlist/thanks/index.html     post-submit success
//     site/waitlist/try-again/index.html  post-submit "fix one of two things"
//   plus site/CNAME, site/.nojekyll, site/favicon.png, site/og.png
//
// Run: node scripts/build-site.mjs
//
// ---------------------------------------------------------------------------
// DELIBERATE GUARD — READ BEFORE TOUCHING:
//
// docs/legal/*.md contain `TODO(Cameron):` and `TODO(lawyer):` markers next to
// facts nobody has filled in yet (effective dates, the legal entity name, a
// DMCA agent, a liability cap, etc.), plus two closing disclaimer paragraphs
// that literally say "this is a draft, not legal advice, do not publish until
// reviewed." None of that is fit to show a real user or App Review.
//
// So before this script writes anything, it scans the raw source markdown for
// the literal substrings "TODO(Cameron)" or "TODO(lawyer)" — on ANY line, not
// just ones that look like an actionable instruction — and refuses to build at
// all if it finds one, printing every file:line it found so they're easy to
// clear one by one. This is intentional and it is not a bug: a legal page
// with "TODO" sitting in it is worse than no legal page, and the whole reason
// this script exists is to keep a half-finished draft from ever reaching
// site/. Do not loosen or remove this check to "get it building" — fix the
// source markdown instead.
//
// Three more guards have since joined it, all the same shape (refuse to write
// anything rather than publish something wrong):
//   * the LAUNCH GUARD, so a "launched" site whose only call to action is a
//     dead App Store link cannot be built (see PHASE below);
//   * the FONT GUARD, so a missing .woff2 is a loud failure instead of a
//     silent fallback to system sans on every page;
//   * the CONTRAST GUARD, so a colour edit that drops a text pair below WCAG
//     AA fails the build with the measured ratio (see CONTRAST_PAIRS).
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, statSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LEGAL_DIR = path.join(ROOT, "docs", "legal");
const SITE_DIR = path.join(ROOT, "site");
const APP_ASSETS = path.join(ROOT, "apps", "mobile", "assets");

// ---------------------------------------------------------------------------
// PHASE — the one line that turns this from a waitlist site into a launched one.
//
// A committed constant rather than an environment variable, on purpose: the flip
// is one line, it lands in git as the record of exactly when the site changed,
// and it cannot be forgotten by a shell that did not export a variable.
//
// PHASE controls three things and nothing else: the hero's call to action, what
// the waitlist page's body is (a form, or "we are live, here is the link"), and
// what the closing lockup's slab points at.
// ---------------------------------------------------------------------------
const PHASE = "waitlist"; // "waitlist" | "launched"
const APP_STORE_URL = null; // "https://apps.apple.com/us/app/duoqueue/id<AppleID>"

// The public form endpoint (supabase/functions/waitlist-signup). The project ref
// is not a secret and is already committed in scripts/db/*.ps1 and shipped inside
// the app binary as EXPO_PUBLIC_SUPABASE_URL.
const WAITLIST_ENDPOINT = "https://oflexcazqfuvcikrewnb.supabase.co/functions/v1/waitlist-signup";

const SITE_ORIGIN = "https://duoqueue.io";
const SUPPORT_EMAIL = "support@duoqueue.io";
const CUSTOM_DOMAIN = "duoqueue.io";

// ---------------------------------------------------------------------------
// THE DESIGN SYSTEM, and where every number in it came from.
//
// This site is the landing surface for three finished ad campaigns, so it is not
// designed here — it is transcribed from them. The campaign's own source of truth
// is marketing/video/src/frag/ground.ts and src/carousel/, and every value below
// is copied from there rather than eyeballed against a render.
//
// THE ONE RULE THE WHOLE SYSTEM RESTS ON: light ground, dark product.
//
// DuoQueue is off-black #0A0B09 with chartreuse #CDFF3D, and chartreuse is the
// only colour that makes it recognisable. Measured on this ground it is 1.05:1
// (1.17:1 on pure white), which is not "low contrast", it is invisible — a filled
// chartreuse shape on warm off-white has no silhouette at all, and a button is
// read by its silhouette before its words. On the app's own off-black it is
// 16.88:1. So chartreuse NEVER goes on the light ground. It lives inside dark
// elements: a dark slab, a dark button, a dark card. For accent type on the light
// ground the accent is the app's own answer to the same question, lightColors.volt
// #4A6B00, which is what the app itself uses when it is on paper.
//
// That is also why this site has no dark mode any more. It used to be dark-first
// with a prefers-color-scheme swap, which meant a visitor tapping through from a
// light-ground ad with their phone in dark mode landed on an inverted page and the
// campaign match was gone — and, worse, the chartreuse rule inverts with it. A
// page that has to decide per-visitor which of two palettes chartreuse is legal in
// will get it wrong for half of them. color-scheme: light is declared explicitly
// so the browser also stops force-darkening the form controls.
// ---------------------------------------------------------------------------

// marketing/video/src/frag/ground.ts:88-92, verbatim. The sweep is 178 degrees and
// not 180 because a gradient exactly on the axis bands into horizontal stripes; two
// degrees of tilt breaks the stripe into a diagonal. The pool is a soft light
// source behind the objects, so the brightest pixel on the page is where the
// product is rather than in an empty gap.
const GROUND = {
  base: "#F6F3EA",
  sweep: "linear-gradient(178deg, #FAF8F2 0%, #F6F3EA 52%, #F3EFE5 100%)",
  pool: "radial-gradient(56% 32% at 42% 58%, rgba(255,255,251,0.5) 0%, rgba(255,255,251,0) 74%)",
  // Darkest stop of the sweep. Every contrast pair below is measured against THIS
  // rather than against `base`, so a ratio that passes at the top of the page
  // cannot fail at the bottom of it.
  darkest: "#F3EFE5",
};

// marketing/video/src/frag/ground.ts:105-111 (INK), which is itself
// apps/mobile/src/theme/tokens.ts. Nothing here is an authored colour.
const INK = {
  type: "#161A0F", // lightColors.text
  muted: "#5C6450", // lightColors.textMuted
  accent: "#4A6B00", // lightColors.volt — chartreuse's own resolution on paper
  brand: "#CDFF3D", // darkColors.voltRaw — legal ONLY inside a dark element
  slab: "#0A0B09", // darkColors.background
  field: "#FFFFFF", // lightColors.surface
  rule: "#C9CFBB", // lightColors.border
};

// The app's LIGHT palette, for the product fragments. These are objects made of the
// real thing, so they are drawn in the real tokens — apps/mobile/src/theme/tokens.ts,
// `lightColors`, verbatim.
//
// It was the DARK palette until Cameron committed the campaign to light: "i think we
// should just commit to the light UI as the main one we use". That is a real trade and
// the measurement is on record. A light-themed app substitutes an olive for chartreuse
// in every control it draws, so the brand colour all but leaves the product: the same
// swap measured across the films took pro-a from 0.330% chartreuse on screen to 0.027%.
//
// What saves it here, and what a static page can do that a film could not, is that the
// CTA is FURNITURE rather than footage. The waitlist slab below is ours to colour, and
// it stays off-black with raw #CDFF3D at 16.88:1. So the product reads light and the one
// moment of decision still carries the brand.
//
// The other consequence is structural: a light fragment on a light ground has almost no
// tonal step left, so `border` is no longer a detail. It is the only thing separating an
// object from the paper, and the cast shadow underneath it is the other. Neither is
// decoration on this palette.
const APP = {
  background: "#F2F4EB",
  surface: "#FFFFFF",
  surfaceAlt: "#E7EBDB",
  border: "#C9CFBB",
  text: "#161A0F",
  textMuted: "#5C6450",
  volt: "#4A6B00", // lightColors.volt — the olive the app resolves chartreuse to on paper
  onVolt: "#F7F9F0",
  amber: "#8F5E00", // lightColors.overlap.many — three or more games in common
};

// marketing/video/src/frag/ground.ts:241-257. One perspective container and one
// rotation for every fragment on the page, so several differently shaped objects
// read as several views from one camera position rather than several separately
// art-directed rectangles. Positive rotateY pushes the right edge away and brings
// the left edge forward, which throws the shadow down and to the right, away from
// the reading direction. The shadow is two layers because one never works: a tight
// contact shadow that says the object is a millimetre off the surface, and a long
// soft cast that says the surface is lit.
const TILT = {
  perspective: "2400px",
  origin: "44% 54%",
  transform: "rotateY(7deg) rotateX(2deg)",
  // The object the campaign's shadow was authored for. ground.ts:237 draws an
  // 844px-wide card on a 1080px frame; every length in FRAG_SHADOW_LAYERS below is
  // a ratio of THAT width, which is the entire point.
  authoredFor: 844,
};

// A shadow is geometry, not a colour, and geometry does not survive being copied
// onto an object of a different size.
//
// The campaign's cast layer is a 92px blur at a 44px offset on an 844px card:
// 10.9% and 5.2% of the object. Pasted unscaled onto a fragment that renders 303px
// wide on a phone, the same numbers are 30.4% and 14.5% — a shadow three times too
// big for its object, which stops reading as "this card is lifted off the paper"
// and starts reading as a grey rectangle lying next to it. Measured on the built
// page before this scaled: 25.1% of the fragments band was clean ground against the
// ads' 48.5%, and the mono caption under each fragment sat inside the cast at
// 4.10:1 — under WCAG AA on the phone, which is the priority device.
//
// So every length is stored as a ratio of the object's width and the two alphas do
// not move: the shadow keeps the campaign's exact optical relationship to its
// object at any size, which is the thing that was actually being copied. Alpha is
// deliberately left alone — dimming the shadow would have hidden the contrast
// failure without fixing the composition, and the ads' ground is not a paler
// version of this one, it is a cleaner one.
//
// THIS ARRAY IS THE ONE DEFINITION. Both the CSS (fragShadowCss) and the contrast
// guard (fragShadowPx -> groundUnderCaption) read it, so a future edit that
// un-scales the shadow moves the guard's numbers too and fails the build instead of
// quietly shipping the regression again. `marketing/video/src/frag/ground.ts:257`
// is where these six numbers and two alphas come from; nothing here is authored.
const FRAG_SHADOW_LAYERS = [
  { x: 16, y: 10, blur: 26, spread: 0, alpha: 0.1 }, // contact: a millimetre off the paper
  { x: 38, y: 44, blur: 92, spread: -20, alpha: 0.28 }, // cast: the surface is lit
];
/** The shadow's ink, from ground.ts. Warm, because the ground is warm; a neutral
 *  grey shadow on this paper reads as dirt. */
const FRAG_SHADOW_INK = [41, 34, 18];

/** The layers resolved to real pixels for an object of `objectWidth`. This is what
 *  the browser actually paints, and it is what the contrast guard measures. */
function fragShadowPx(objectWidth) {
  const k = objectWidth / TILT.authoredFor;
  return FRAG_SHADOW_LAYERS.map((l) => ({
    x: l.x * k,
    y: l.y * k,
    blur: l.blur * k,
    spread: l.spread * k,
    alpha: l.alpha,
  }));
}

/** `unit` is either "px" against an explicit width (the fallback) or "cqw", which
 *  is 1% of the fragment container's inline size — i.e. of the object's own width,
 *  measured by the browser, so no breakpoint carries a hand-typed number and the
 *  scale cannot drift when the grid changes. */
function fragShadowCss({ width = null, unit = "cqw" } = {}) {
  const ink = `rgba(${FRAG_SHADOW_INK.join(",")}`;
  const v =
    unit === "cqw"
      ? (n) => `${+((n / TILT.authoredFor) * 100).toFixed(4)}cqw`
      : (n) => `${+((n / TILT.authoredFor) * width).toFixed(2)}px`;
  return FRAG_SHADOW_LAYERS.map(
    (l) =>
      `${v(l.x)} ${v(l.y)} ${v(l.blur)}` +
      (l.spread ? ` ${v(l.spread)}` : "") +
      ` ${ink},${l.alpha})`
  ).join(", ");
}

// The narrowest object the layout ever produces (320px viewport, 2x20px inset).
// The px fallback is computed at this width on purpose: a browser too old for
// container query units gets a shadow sized for the SMALLEST object rather than
// the largest, so the failure mode is a shadow that is slightly too tight, never
// one that swallows the caption underneath it.
const FRAG_MIN_WIDTH = 280;

// The gap between an object and its caption. 22px was measured on the 303px phone
// object; held as a ratio it keeps the caption a constant distance out of the cast
// shadow at every object size — which is the other half of the AA fix, because a
// fixed 22px puts the caption back inside the cast on any object wider than ~310px.
// The clamp bounds are the CSS clamp's bounds; captionGapPx() reproduces the clamp
// so the guard measures the gap the browser will actually use.
const CAPTION_GAP = { ratio: 22 / 303, minPx: 22, maxPx: 52 };
const CAPTION_GAP_CQW = +(CAPTION_GAP.ratio * 100).toFixed(3);
const captionGapPx = (objectWidth) =>
  Math.min(CAPTION_GAP.maxPx, Math.max(CAPTION_GAP.minPx, CAPTION_GAP.ratio * objectWidth));

// THE GRID, as ratios of the campaign's 1080px field so they survive being poured
// into a viewport of any width.
//
//   X0        118/1080  = 10.93%  one left edge, for the type AND every object
//   TYPE_CAP   76/1080  =  7.04%  display cap
//   LEADING          1.34         measured baseline-to-baseline off 02-the-match
//   LABEL      26/1080  =  2.41%  the mono furniture, at 0.18em tracking
//   CTA        68/1080  =  6.30%  the end card's call to action
//   WORDMARK  152/1080  = 14.07%  at +2% tracking
//
// The leading is the one that looks wrong written down. 1.34 is loose for a display
// face and it is deliberate: the campaign sets it there so a fixed line box holds
// the FACE rather than the caps (at 1.02 the descender of the q in "queue" clips),
// and measured off the finished frames the baselines really are 1.34 apart. Setting
// it tighter here would make the page's headline a different picture from the ad's.
const GRID = {
  x0: "clamp(20px, 10.93%, 118px)",
  display: "clamp(34px, 8.4vw, 76px)",
  leading: 1.34,
  label: "clamp(11px, 2.41vw, 26px)",
  cta: "clamp(21px, 5.4vw, 44px)",
  wordmark: "clamp(42px, 13.6vw, 148px)",
};

// The five faces, subsetted and committed by scripts/site-fonts/subset.py. Family
// names are the app's token values verbatim (apps/mobile/src/theme/tokens.ts), so
// the site, the app and the ad campaign all name the same typefaces the same way.
const FACES = [
  { file: "unbounded-700.woff2", family: "Unbounded", weight: 700 },
  { file: "manrope-800.woff2", family: "Manrope", weight: 800 },
  { file: "manrope-700.woff2", family: "Manrope", weight: 700 },
  { file: "manrope-500.woff2", family: "Manrope", weight: 500 },
  { file: "plex-mono-600.woff2", family: "IBM Plex Mono", weight: 600 },
];

const SANS = `Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const DISPLAY = `Unbounded, ${SANS}`;
const MONO = `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

// ---------------------------------------------------------------------------
// Contrast guard.
//
// pnpm audit:contrast reads apps/mobile/src/theme/tokens.ts and has never covered
// this site, so until now the site's pairs were hand-computed in a plan document
// and then trusted. They are computed here instead, every build, and a pair that
// drops below its WCAG AA threshold fails the build with the number. 3.0 is the
// large-text threshold (>=24px, or >=18.66px bold), which is what the display and
// call-to-action sizes above are; everything else is held to 4.5.
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return (
    "#" +
    [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")
  );
}
function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Blends `ink` toward `bg` at `inkWeight` (0-1) — the same 58%-ink / 42%-background
 * ratio the mark uses in both the app and the campaign (marketing/video/src/
 * components/Mark.tsx:30-33), so the site's mark is the identical two tones. */
function blend(ink, bg, inkWeight) {
  const [ir, ig, ib] = hexToRgb(ink);
  const [br, bg2, bb] = hexToRgb(bg);
  return rgbToHex([
    ir * inkWeight + br * (1 - inkWeight),
    ig * inkWeight + bg2 * (1 - inkWeight),
    ib * inkWeight + bb * (1 - inkWeight),
  ]);
}

// ---------------------------------------------------------------------------
// THE SHADOW-AWARE PART OF THE CONTRAST GUARD
//
// The first version of this guard modelled the ground as a flat #F3EFE5 and
// declared every pair on the page passing. It was wrong about the one pair that
// actually failed, because the ground under a fragment is not the ground: the
// fragment's cast shadow darkens it, and the mono caption sits directly in the
// path of that cast. Measured on the built page, the caption's background went
// from #F3EFE5 to as dark as #D4D0C6 and the pair fell from 5.58:1 to 4.02:1,
// under AA on the priority device, while this function was printing a pass.
//
// So the guard now composites the shadow before it measures. A CSS box-shadow's
// blur radius r is defined as a Gaussian of sigma = r/2 applied to the shadow
// rectangle, so the layer's coverage at a distance d beyond that rectangle's edge
// is the normal tail Phi(-d / sigma). Everything below is in units of the object's
// own width, because that is how fragShadow() and CAPTION_GAP_CQW now define it —
// which means the model has one answer, not one answer per breakpoint.
// ---------------------------------------------------------------------------

/** Abramowitz & Stegun 7.1.26. Max absolute error 1.5e-7 — far finer than the
 *  8-bit colour channels this feeds. */
function erf(x) {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-a * a);
  return s * y;
}
/** Standard normal CDF. */
const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/** Coverage of one blurred shadow layer at `d` px below its rectangle's bottom
 *  edge. Inside the rectangle (d <= 0) it is effectively solid. */
function shadowCoverage({ alpha, blur, d }) {
  if (blur <= 0) return d <= 0 ? alpha : 0;
  return alpha * normCdf(-d / (blur / 2));
}

/** src (with alpha) composited over an opaque dst. */
function over(src, alpha, dstHex) {
  const [dr, dg, db] = hexToRgb(dstHex);
  return rgbToHex([
    src[0] * alpha + dr * (1 - alpha),
    src[1] * alpha + dg * (1 - alpha),
    src[2] * alpha + db * (1 - alpha),
  ]);
}

/**
 * The ground colour under a fragment's caption, at an object of width `w`.
 * Returns the darkest value the caption's top edge can sit on.
 *
 * It reads fragShadowPx() and captionGapPx() — the same two functions the CSS is
 * generated from — rather than re-stating the geometry. That is what makes this a
 * guard and not a second opinion: un-scale the shadow, or pin the caption gap back
 * to a constant, and these numbers move and the build stops.
 */
function groundUnderCaption(w) {
  const gap = captionGapPx(w);
  // Each layer's shadow rectangle sits `y + spread` below the object's bottom edge
  // (a negative spread pulls the rectangle back up), and its coverage decays over
  // the blur from there. The caption's TOP edge is the worst case; every pixel of
  // the caption below it is further away and lighter.
  let clear = 1;
  for (const l of fragShadowPx(w)) {
    clear *= 1 - shadowCoverage({ alpha: l.alpha, blur: l.blur, d: gap - (l.y + l.spread) });
  }
  const combined = 1 - clear;
  return {
    hex: over(FRAG_SHADOW_INK, combined, GROUND.darkest),
    alpha: combined,
    gap: +gap.toFixed(1),
  };
}

/** Every object width the layout actually produces, worst first. 280 is a 320px
 *  viewport at the phone inset; 660 is a 1600px viewport's two-column stage. */
const FRAG_WIDTHS = [280, 303, 415, 520, 582, 660];

const CONTRAST_PAIRS = [
  { what: "body / caption ink on the ground", fg: INK.type, bg: GROUND.darkest, min: 4.5 },
  { what: "muted ink (eyebrow, captions) on the ground", fg: INK.muted, bg: GROUND.darkest, min: 4.5 },
  { what: "accent word and links on the ground", fg: INK.accent, bg: GROUND.darkest, min: 4.5 },
  { what: "typed email in the field", fg: INK.type, bg: INK.field, min: 4.5 },
  { what: "chartreuse call to action on the dark slab", fg: INK.brand, bg: INK.slab, min: 3.0 },
  { what: "ground-coloured type on the dark slab", fg: GROUND.base, bg: INK.slab, min: 4.5 },
  { what: "app text on app surface", fg: APP.text, bg: APP.surface, min: 4.5 },
  { what: "app muted text on app surfaceAlt", fg: APP.textMuted, bg: APP.surfaceAlt, min: 4.5 },
  { what: "overlap amber on app surface", fg: APP.amber, bg: APP.surface, min: 4.5 },
  { what: "onVolt ink on the chartreuse send button", fg: APP.onVolt, bg: APP.volt, min: 4.5 },
];

function checkContrast() {
  const failures = [];
  for (const pair of CONTRAST_PAIRS) {
    const ratio = contrastRatio(pair.fg, pair.bg);
    const line = `  ${ratio.toFixed(2).padStart(6)}:1  (needs ${pair.min.toFixed(1)})  ${pair.fg} on ${pair.bg}  ${pair.what}`;
    if (ratio < pair.min) failures.push(line);
    else console.log(line);
  }
  // The caption pairs, measured against the shadow-darkened ground rather than
  // against clean paper. This is the check that the flat-ground version of this
  // guard was missing; it is what the 4.02:1 failure would have tripped.
  console.log("\nCaption ink on the ground UNDER a fragment's cast shadow:");
  let worst = null;
  for (const w of FRAG_WIDTHS) {
    const g = groundUnderCaption(w);
    const ratio = contrastRatio(INK.muted, g.hex);
    const line =
      `  ${ratio.toFixed(2).padStart(6)}:1  (needs 4.5)  ${INK.muted} on ${g.hex}  ` +
      `object ${String(w).padStart(3)}px, caption gap ${g.gap}px, shadow alpha ${g.alpha.toFixed(3)}`;
    if (ratio < 4.5) failures.push(line);
    else console.log(line);
    if (worst === null || ratio < worst) worst = ratio;
  }
  console.log(`  worst caption pair across every object width: ${worst.toFixed(2)}:1`);

  // Not a pass/fail pair — a printed reminder. If this number ever climbs, someone
  // has changed the ground, and the entire "chartreuse only inside dark elements"
  // rule that this design rests on has to be re-argued rather than quietly dropped.
  console.log(
    `  ${contrastRatio(INK.brand, GROUND.base).toFixed(2).padStart(6)}:1  (informational)   ` +
      `${INK.brand} on ${GROUND.base}  chartreuse on the ground: why it is never used there`
  );
  if (failures.length) {
    console.error("\nREFUSING TO BUILD: contrast below WCAG AA.\n");
    failures.forEach((f) => console.error(f));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Rings mark — geometry ported directly from the `ringGeometry` / `ringsMark`
// functions in scripts/generate-app-icons.mjs (the source of truth for the app
// icon), which is also what marketing/video/src/components/Mark.tsx draws. The
// two tones are ink and ink blended 58% toward the app's own paper, computed
// rather than typed, so the site's mark equals the ad's mark exactly.
// ---------------------------------------------------------------------------
const MARK_CANVAS = 1024;
const MARK_CENTER = MARK_CANVAS / 2;
const MARK_INK = INK.type;
const MARK_DUO = blend(INK.type, "#F2F4EB", 0.58); // lightColors.background

function ringGeometry(scale) {
  const R = MARK_CANVAS * 0.21 * scale;
  const W = R * 0.46;
  const d = R * 1.5;
  const nudge = MARK_CANVAS * 0.012;
  const cxA = MARK_CENTER - nudge - d / 2;
  const cxB = MARK_CENTER - nudge + d / 2;
  const k = Math.SQRT1_2;
  const nubDist = R + W * 0.42;
  const tail = { cx: cxB + nubDist * k, cy: MARK_CENTER + nubDist * k, r: W * 0.56 };
  return { R, W, cxA, cxB, cy: MARK_CENTER, tail };
}

/** Chain-weave rings mark as an inline SVG string. Sized in CSS by the caller. */
function ringsMarkSvg({ scale = 1, size = 32, className = "brand-mark", label = "DuoQueue" } = {}) {
  const { R, W, cxA, cxB, cy, tail } = ringGeometry(scale);
  const s = ((138.59 - 27.5) * Math.PI) / 180;
  const e = ((138.59 + 27.5) * Math.PI) / 180;
  const seg = `M ${cxB + R * Math.cos(s)} ${cy + R * Math.sin(s)} A ${R} ${R} 0 0 1 ${cxB + R * Math.cos(e)} ${cy + R * Math.sin(e)}`;
  const ink = "var(--mark-ink)";
  const duo = "var(--mark-duo)";
  const a11y = label ? ` role="img" aria-label="${escapeHtml(label)}"` : ` aria-hidden="true"`;
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 ${MARK_CANVAS} ${MARK_CANVAS}" xmlns="http://www.w3.org/2000/svg"${a11y}>
    <circle cx="${cxB}" cy="${cy}" r="${R}" fill="none" stroke="${duo}" stroke-width="${W}" />
    <circle cx="${tail.cx}" cy="${tail.cy}" r="${tail.r}" fill="${duo}" />
    <circle cx="${cxA}" cy="${cy}" r="${R}" fill="none" stroke="${ink}" stroke-width="${W}" />
    <path d="${seg}" fill="none" stroke="${duo}" stroke-width="${W}" />
  </svg>`;
}

// ---------------------------------------------------------------------------
// TODO guard
// ---------------------------------------------------------------------------

/** Scans raw markdown text for `TODO(Cameron)` / `TODO(lawyer)` markers.
 * Deliberately a plain substring match with no "does it end in a colon"
 * cleverness — the two closing disclaimer paragraphs in these docs mention
 * both marker names without a trailing colon, and those paragraphs are just
 * as unfit to publish as an unfilled date field. Returns every hit so the
 * caller can report all of them at once instead of one-at-a-time. */
function findTodoMarkers(relPath, text) {
  const markers = [];
  const lines = text.split(/\r?\n/);
  const pattern = /TODO\(Cameron\)|TODO\(lawyer\)/;
  lines.forEach((line, i) => {
    if (pattern.test(line)) {
      markers.push({ file: relPath, line: i + 1, text: line.trim() });
    }
  });
  return markers;
}

// ---------------------------------------------------------------------------
// Markdown -> HTML
//
// Compact, line-based converter covering exactly what docs/legal/*.md use:
// headings (# / ## / ###), paragraphs, **bold**, *italic*, `code spans`,
// [links](url) (including relative ./file.md links and #anchor links),
// unordered lists (with one level of nesting), ordered lists, GFM-style
// pipe tables (header + |---|---| separator, no alignment colons), and
// horizontal rules (---). No blockquote support: neither source document
// uses one, so it's left out rather than carried as dead code.
// ---------------------------------------------------------------------------

/** GitHub-style heading slug, used both to id headings and to resolve
 * in-page #anchor links like [Section 9](#9-age-restriction). */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const DOC_LINK_MAP = {
  "privacy-policy.md": "/privacy/",
  "terms-of-service.md": "/terms/",
};

/** Rewrites a markdown link target for the published site. Absolute URLs,
 * mailto: links, and #anchors pass through untouched. Relative links to a
 * markdown file are mapped to the site path of the page it becomes, per
 * DOC_LINK_MAP above. Any other relative .md link (e.g. a link to
 * trust-and-safety.md, which isn't part of this build) falls back to the
 * same-shaped site path even though nothing is published there yet, rather
 * than leaving a raw .md link that would 404 immediately either way. */
function rewriteLink(url) {
  if (/^[a-z]+:/i.test(url) || url.startsWith("#")) return url;
  if (url.endsWith(".md")) {
    const base = url.replace(/^\.\//, "").split("/").pop();
    if (DOC_LINK_MAP[base]) return DOC_LINK_MAP[base];
    return "/" + base.replace(/\.md$/, "") + "/";
  }
  return url;
}

/** Inline markdown within a single block of text: escape HTML first, then
 * code spans, then links, then bold, then italic — in that order so bold's
 * `**` is fully consumed before the italic pass looks for lone `*`, and so
 * a `*italic run containing **bold*** correctly nests (verified against the
 * closing disclaimer paragraph in terms-of-service.md, which does exactly
 * this). */
function renderInline(raw) {
  let text = escapeHtml(raw);
  text = text.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${rewriteLink(url.trim())}">${label}</a>`);
  text = text.replace(/\*\*([^*]+)\*\*/g, (_, b) => `<strong>${b}</strong>`);
  text = text.replace(/\*([^*]+)\*/g, (_, i) => `<em>${i}</em>`);
  return text;
}

/** Builds a (possibly one-level-nested) <ul>/<ol> from a flat run of list
 * items carrying their original indent width. Items with indent > 0
 * immediately following an indent-0 item are nested under it — that's the
 * only nesting shape either source document uses (privacy-policy.md's
 * "Deleted accounts" bullet is the sole example). */
function buildList(items, ordered) {
  const tag = ordered ? "ol" : "ul";
  let html = `<${tag}>`;
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    let j = i + 1;
    const nested = [];
    while (j < items.length && items[j].indent > item.indent) {
      nested.push(items[j]);
      j++;
    }
    html += `<li>${renderInline(item.text)}`;
    if (nested.length) html += buildList(nested, ordered);
    html += `</li>`;
    i = j;
  }
  html += `</${tag}>`;
  return html;
}

function isTableSeparator(line) {
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line.trim());
}

function parseTableRow(line) {
  let l = line.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|")) l = l.slice(0, -1);
  return l.split("|").map((c) => c.trim());
}

function mdToHtml(markdown) {
  // Strip HTML comments before anything else. The source documents carry an internal
  // "this is a draft for legal review" note at the top as an HTML comment — it must
  // survive for whoever edits the markdown next, and must never reach the published
  // page, where it would tell users the terms might be wrong. Without this the
  // converter escapes it and renders it as visible body text, which is the exact
  // failure it was meant to avoid.
  markdown = markdown.replace(/<!--[\s\S]*?-->/g, "");
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let title = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule (exact "---"; table separators always start with "|"
    // or contain multiple dash-runs separated by "|", so there's no clash).
    if (line.trim() === "---") {
      out.push("<hr>");
      i++;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      if (level === 1 && title === null) title = text;
      out.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      i++;
      continue;
    }

    // Table: current line has a "|" and the next line is a separator row.
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = parseTableRow(line);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
        bodyRows.push(parseTableRow(lines[i]));
        i++;
      }
      let table = '<div class="table-scroll"><table><thead><tr>';
      table += headerCells.map((c) => `<th>${renderInline(c)}</th>`).join("");
      table += "</tr></thead><tbody>";
      for (const row of bodyRows) {
        table += "<tr>" + row.map((c) => `<td>${renderInline(c)}</td>`).join("") + "</tr>";
      }
      table += "</tbody></table></div>";
      out.push(table);
      continue;
    }

    // Ordered list
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)\d+\.\s+(.*)$/);
        if (!m) break;
        items.push({ indent: m[1].length, text: m[2] });
        i++;
      }
      out.push(buildList(items, true));
      continue;
    }

    // Unordered list
    const unorderedMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (unorderedMatch) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)-\s+(.*)$/);
        if (!m) break;
        items.push({ indent: m[1].length, text: m[2] });
        i++;
      }
      out.push(buildList(items, false));
      continue;
    }

    // Paragraph: consume consecutive plain lines until a blank line or the
    // start of another block.
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      lines[i].trim() !== "---" &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^(\s*)-\s+/.test(lines[i]) &&
      !/^(\s*)\d+\.\s+/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length) {
      out.push(`<p>${renderInline(paraLines.join(" "))}</p>`);
    } else {
      // Safety net: unrecognized line that none of the above consumed
      // (shouldn't happen given what these documents contain, but avoids an
      // infinite loop if a future edit adds syntax this converter doesn't
      // handle yet).
      out.push(`<p>${renderInline(lines[i])}</p>`);
      i++;
    }
  }

  return { html: out.join("\n"), title };
}

// ---------------------------------------------------------------------------
// "Last updated" resolution
// ---------------------------------------------------------------------------

/** Looks for a "**Effective date:** <value>" line in the raw markdown and
 * uses it verbatim if present and TODO-free. Otherwise falls back to the
 * source file's mtime, clearly labeled as a placeholder — per the build
 * spec, this is a deliberate fallback, not a silent guess. */
function resolveLastUpdated(sourceFilePath, markdownText, { fallbackNote } = {}) {
  if (markdownText) {
    const m = markdownText.match(/\*\*Effective date:\*\*\s*(.+)/);
    if (m) {
      const value = m[1].trim();
      if (!/TODO\(/.test(value)) {
        return { label: value, isPlaceholder: false };
      }
    }
  }
  const date = statSync(sourceFilePath).mtime.toISOString().slice(0, 10);
  const note =
    fallbackNote || "derived from the source file's last-modified time, and replaced once an effective date is set";
  return { label: `${date} (${note})`, isPlaceholder: true };
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const FONT_FACE_CSS = FACES.map(
  (f) => `@font-face{font-family:"${f.family}";src:url(/fonts/${f.file}) format("woff2");font-weight:${f.weight};font-style:normal;font-display:swap;}`
).join("\n  ");

const CSS = `
  ${FONT_FACE_CSS}

  :root {
    --ground: ${GROUND.base};
    --ink: ${INK.type};
    --muted: ${INK.muted};
    --accent: ${INK.accent};
    --brand: ${INK.brand};
    --slab: ${INK.slab};
    --field: ${INK.field};
    --rule: ${INK.rule};
    --mark-ink: ${MARK_INK};
    --mark-duo: ${MARK_DUO};
    --x0: ${GRID.x0};
    --app-bg: ${APP.background};
    --app-surface: ${APP.surface};
    --app-alt: ${APP.surfaceAlt};
    --app-border: ${APP.border};
    --app-text: ${APP.text};
    --app-muted: ${APP.textMuted};
    --app-volt: ${APP.volt};
    --app-on-volt: ${APP.onVolt};
    --app-amber: ${APP.amber};
    /* One ground, no scheme swap. See the design-system note in build-site.mjs. */
    color-scheme: light;
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

  body {
    /* Pool over sweep over base: the lit surface the whole campaign sits on. */
    background-color: var(--ground);
    background-image: ${GROUND.pool}, ${GROUND.sweep};
    background-attachment: fixed, fixed;
    color: var(--ink);
    font-family: ${SANS};
    font-weight: 500;
    font-size: 17px;
    line-height: 1.6;
    letter-spacing: -0.005em;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
  a:hover { text-decoration-thickness: 2px; }
  :focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

  .skip-link {
    position: absolute; left: -9999px; top: 0;
    background: var(--slab); color: var(--brand); padding: 0.75em 1em; text-decoration: none;
  }
  .skip-link:focus { left: 0.5em; top: 0.5em; z-index: 20; }

  /* ---- shared measure ---------------------------------------------------- */
  /* One left edge for the type and for every object, exactly as the campaign
     does it: 118/1080 of the field, clamped so it stops growing past the
     literal number the ads use. */
  .wrap { max-width: 1180px; margin: 0 auto; padding-left: var(--x0); padding-right: var(--x0); }

  /* ---- header ------------------------------------------------------------ */
  header.site-header { padding: 22px 0 4px; }
  header.site-header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 1em; flex-wrap: wrap; }
  .brand { display: inline-flex; align-items: baseline; gap: 0.42em; color: var(--ink); text-decoration: none; }
  .brand .brand-mark { align-self: center; }
  .brand span {
    font-family: ${DISPLAY}; font-weight: 700; font-size: 19px; letter-spacing: 0.02em; line-height: 1;
  }
  .brand:hover { text-decoration: none; }
  header.site-header nav { display: flex; gap: 1.1em; flex-wrap: wrap; }
  header.site-header nav a {
    font-family: ${MONO}; font-weight: 600; font-size: 11px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--muted); text-decoration: none;
  }
  header.site-header nav a:hover { color: var(--accent); text-decoration: underline; }

  /* ---- the mono furniture ------------------------------------------------ */
  .eyebrow {
    font-family: ${MONO}; font-weight: 600; font-size: ${GRID.label};
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted);
    margin: 0 0 1.1em;
  }

  /* ---- display type ------------------------------------------------------ */
  /* Manrope 800 at -2% is the campaign's headline face and tracking. The accent
     word is the app's own olive resolution of chartreuse on paper, and there is
     exactly one of them per headline, which is the campaign's rule too. */
  h1.display, h2.display {
    font-family: ${SANS}; font-weight: 800;
    font-size: ${GRID.display}; line-height: ${GRID.leading}; letter-spacing: -0.02em;
    color: var(--ink); margin: 0 0 0.42em; text-wrap: balance;
  }
  .display .key { color: var(--accent); }

  .lede { font-size: clamp(17px, 2.1vw, 22px); line-height: 1.5; margin: 0 0 0.7em; max-width: 30ch; }
  .sub { color: var(--muted); font-size: clamp(15px, 1.7vw, 18px); margin: 0 0 1.9em; max-width: 38ch; }

  /* ---- hero -------------------------------------------------------------- */
  main { display: block; }
  /* THE HERO GRID IS THREE NAMED AREAS, NOT TWO COLUMNS.
     The type, the form and the product object are separate grid children so the
     composition can be re-cut per viewport SHAPE rather than only per width. On a
     phone they stack in reading order. On a tall desktop window the type and the
     form share the left column with the object beside them, which is the ad's
     composition. On a short landscape window — the shape where a stacked hero puts
     the button below the fold — the form moves next to the type instead of under
     it. Same markup, same order in the DOM, three cuts. */
  section.hero { padding: 34px 0 60px; }
  .hero-grid {
    display: grid; grid-template-columns: 1fr; gap: 0;
    grid-template-areas: "copy" "act" "aside";
    align-items: start;
  }
  .hero-copy { grid-area: copy; }
  .hero-act { grid-area: act; }
  .hero-aside { grid-area: aside; }

  /* ---- the form ---------------------------------------------------------- */
  /* Sharp corners. Every piece of the campaign's own furniture is square (the end
     card's slab, the swipe cue) and every piece of the PRODUCT carries the app's
     radii. The form is furniture, so it is square; the fragments below are the
     product, so they are not. */
  form.signup { max-width: 460px; }
  .field-label {
    display: block; font-family: ${MONO}; font-weight: 600; font-size: 11px;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px;
  }
  input[type="email"] {
    width: 100%; display: block;
    background: var(--field); color: var(--ink);
    border: 1.5px solid var(--ink); border-radius: 0;
    padding: 15px 16px; font-family: ${SANS}; font-weight: 500; font-size: 17px; line-height: 1.3;
    appearance: none;
  }
  input[type="email"]::placeholder { color: var(--muted); opacity: 1; }
  input[type="email"]:focus { outline: 3px solid var(--accent); outline-offset: 2px; }

  /* 24px, not the browser's 13px default: WCAG 2.5.8 wants a 24x24 target and this
     is the one control between a visitor and the list. The label is the same height
     and is bound to the input, so the whole line is the target. */
  .adult { display: flex; align-items: center; gap: 11px; margin: 16px 0 20px; }
  .adult input[type="checkbox"] {
    flex: none; width: 24px; height: 24px; margin: 0; accent-color: var(--slab);
  }
  .adult label { font-size: 15px; line-height: 24px; min-height: 24px; color: var(--ink); cursor: pointer; }

  /* THE END CARD'S SLAB, which is the one element of this campaign that has
     survived ten design rounds, used here as the page's primary control. Off-black
     fill, raw chartreuse words, square. In a feed the shape of a button is read
     before the words in it are, and chartreuse has no shape on this ground. */
  .cta {
    display: block; width: 100%; text-align: center; cursor: pointer;
    background: var(--slab); color: var(--brand);
    border: 1.5px solid var(--slab); border-radius: 0;
    padding: 0.36em 0.6em 0.42em;
    font-family: ${SANS}; font-weight: 800; font-size: ${GRID.cta}; line-height: 1.3;
    letter-spacing: -0.02em;
    text-decoration: none;
  }
  .cta:hover { background: #000; border-color: #000; text-decoration: none; }
  .cta:active { transform: translateY(1px); }

  .promise { font-size: 15px; line-height: 1.5; margin: 16px 0 0; max-width: 44ch; }
  .fineprint { font-size: 13.5px; line-height: 1.55; color: var(--muted); margin: 8px 0 0; max-width: 46ch; }

  /* The honeypot. Off-canvas rather than display:none, because some form-filling
     bots skip anything that is not rendered. tabindex, autocomplete and aria-hidden
     on the input itself keep it away from keyboards and screen readers. */
  .hp { position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }

  /* ---- the stage: isolated product fragments ----------------------------- */
  /* One perspective container for every object on the page, so the fragments read
     as several views from one camera position. Copied from the campaign's TILT. */
  section.stage { padding: 22px 0 64px; }
  .fragments { display: grid; grid-template-columns: 1fr; gap: 46px; perspective: ${TILT.perspective}; align-items: start; }
  /* container-type makes the fragment the query container its own object measures
     itself against, which is what lets the shadow below be written once as a ratio
     of the object instead of as a number per breakpoint. */
  .fragment { max-width: 520px; container-type: inline-size; }
  .object {
    transform-origin: ${TILT.origin};
    transform: ${TILT.transform};
    /* px first for anything without container query units, cqw second. A browser
       that understands cqw takes the second and the shadow tracks the object at
       every width; one that does not drops it as invalid and keeps the first. */
    box-shadow: ${fragShadowCss({ width: FRAG_MIN_WIDTH, unit: "px" })};
    box-shadow: ${fragShadowCss()};
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    border-radius: 10px;
    /* MEASURED OFF 02-the-match.png, not chosen. In the ad the dark slab frames
       the amber chip by 28px left / 20px right / 13px top / 17px bottom on an
       835px slab — about 2.9% of the object's width horizontally and 1.8%
       vertically, an asymmetric frame that is tighter top-to-bottom than it is
       side-to-side. A uniform 18px was 6.28%, roughly double, and it is why the
       chip filled 54.8% of its slab's height on the page against 82.9% in the ad:
       the cards read as mostly empty black instead of as product. */
    padding: 6px 10px;
    padding: 1.8cqw 2.9cqw;
  }
  /* The object was display:flex, which made its single child a flex ITEM and so
     shrink-to-fit: the chat composer drew at 152px inside a 303px card, 57% of the
     width it was given, and read as an unloaded placeholder rather than as the
     product. Block layout gives every fragment's content the full content box. */
  .fragment .object > * { width: 100%; }
  /* The gap under the object is part of the shadow's geometry, not decoration.
     The cast layer reaches (44 - 20) / 844 of the object's width below its bottom
     edge and then fades over a 92/844 blur; at a fixed 22px the caption sat inside
     that reach on any object wider than about 310px and lost contrast to it. Held
     at the same ratio as the shadow, the caption sits at a constant, measured
     distance out of the cast at every object size — see the shadow model in
     checkContrast(). */
  .caption {
    font-family: ${MONO}; font-weight: 600; letter-spacing: 0.14em;
    font-size: 11.5px;
    font-size: clamp(11.5px, 3.8cqw, 15px);
    text-transform: uppercase; color: var(--muted);
    margin: 22px 0 0;
    margin-top: clamp(${CAPTION_GAP.minPx}px, ${CAPTION_GAP_CQW}cqw, ${CAPTION_GAP.maxPx}px);
  }

  /* THE PRODUCT IS SET IN cqw, NOT px.
     Every size in this block is a percentage of the object's own width, so a
     fragment fills its frame identically at 280px on a small phone and at 580px in
     a desktop column. It replaced a set of fixed px sizes that made the badge 11px
     — smaller than this page's own 15.5px body copy, and the smallest type on the
     page, for the element that is the second-largest thing on the ad frame the
     visitor just watched. The ratios are measured from the ads: the badge spans
     73.1% of the frame there and about 45.8% here before this change.
     Each rule keeps a px fallback first for browsers without container units. */

  /* The overlap read, drawn from SwipeCard.tsx's overlapLabel() at the "many"
     tier, whose ink is darkColors.overlap.many. Mono, uppercase, outlined,
     3px corners: the app's chip geometry. */
  .overlap {
    display: inline-flex; border: 1px solid var(--app-amber); border-radius: 3px;
    background: var(--app-surface); padding: 0.52em 0.86em;
  }
  .overlap span {
    font-family: ${MONO}; font-weight: 600;
    font-size: clamp(13px, 4.2vw, 26px);
    font-size: clamp(13px, 5.4cqw, 34px);
    letter-spacing: 0.08em; color: var(--app-amber); white-space: nowrap;
  }

  /* The game chips, from Chip.tsx: a sharp 3px mono tag, label in chipText and
     the skill level after a middle dot in caption. */
  .chips { display: flex; flex-wrap: wrap; gap: 0.6em; }
  .chip {
    display: inline-flex; align-items: baseline; gap: 0.42em;
    border: 1px solid var(--app-border); border-radius: 3px; padding: 0.5em 0.72em;
    font-size: clamp(11.5px, 3.4vw, 21px);
    font-size: clamp(11.5px, 4.3cqw, 26px);
  }
  .chip b {
    font-family: ${MONO}; font-weight: 600; font-size: 1em; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--app-muted);
  }
  .chip i { font-style: normal; font-size: 1.08em; color: var(--app-muted); opacity: 0.8; }

  /* The chat composer, from app/chat/[matchId].tsx: surfaceAlt field with a 6px
     radius and a 40px round chartreuse send button. This is the one place raw
     chartreuse is filled at size anywhere on this site, and it is legal because it
     is inside a dark object. */
  .composer {
    display: flex; align-items: center; gap: 0.62em;
    font-size: clamp(15px, 4.4vw, 27px);
    font-size: clamp(15px, 5.6cqw, 34px);
  }
  .composer .box {
    flex: 1; background: var(--app-alt); border: 1px solid var(--app-border); border-radius: 6px;
    padding: 0.72em 0.92em; color: var(--app-muted); font-size: 1em; line-height: 1.45;
  }
  .composer .send {
    flex: none; width: 2.62em; height: 2.62em; border-radius: 999px; background: var(--app-volt);
    display: flex; align-items: center; justify-content: center;
  }
  .composer .send svg { width: 1.3em; height: 1.3em; }
  .composer .send svg { display: block; }

  /* ---- the plain version ------------------------------------------------- */
  section.plain { padding: 12px 0 66px; }
  .plain-list { display: grid; grid-template-columns: 1fr; gap: 28px; margin: 0; padding: 0; list-style: none; }
  .plain-list li { border-top: 1px solid var(--rule); padding-top: 18px; }
  .plain-list h3 {
    font-family: ${SANS}; font-weight: 800; font-size: 20px; letter-spacing: -0.02em;
    margin: 0 0 6px; color: var(--ink);
  }
  .plain-list p { margin: 0; color: var(--muted); font-size: 15.5px; line-height: 1.55; max-width: 42ch; }

  /* ---- the closing lockup ------------------------------------------------ */
  /* The campaign's end card, standing still. Proportions are FragEnd.tsx's, taken
     as ratios of the 1080 field: mark 250, wordmark 152 at +2% tracking, 40px gaps,
     the slab 26 below at 22x42 padding, the URL 44 in mono at +12% tracking. */
  section.lockup { padding: 20px 0 78px; text-align: center; }
  /* The lockup breaks the page's own grid, exactly as the end card breaks the
     campaign's: the wordmark is the widest element in the frame, running to about
     88.5% of the field where every other element stops at the 10.93% inset. So this
     one section gets the end card's own margin (62/1080 = 5.7%) instead. */
  .lockup .wrap { padding-left: clamp(12px, 5.7%, 62px); padding-right: clamp(12px, 5.7%, 62px); }
  .lockup-inner { display: flex; flex-direction: column; align-items: center; gap: clamp(16px, 3.7vw, 40px); }
  /* The end card draws the mark at 250 on a 1080 field, but its SVG is cropped tight
     to the rings and this one carries the app icon's full 1024 canvas, whose ink
     occupies 83.1% of it. So the box is scaled by 1/0.831 to put the same amount of
     ink on the page: measured, the mark is then 26% of the wordmark's width, which is
     what 06-the-waitlist.png measures (248 / 956). */
  .lockup .brand-mark { width: clamp(101px, 27.7vw, 300px); height: auto; margin-bottom: -2%; }
  /* 6.38em is the measured advance of "duoqueue" in Unbounded 700 at +2% tracking,
     so 13.6vw lands the wordmark at ~87% of the viewport, which is where the end
     card puts it (measured 956/1080 on 06-the-waitlist.png). */
  .wordmark {
    font-family: ${DISPLAY}; font-weight: 700; font-size: ${GRID.wordmark};
    line-height: 1.16; letter-spacing: 0.02em; color: var(--ink); white-space: nowrap;
  }
  /* The end card sets its call to action at 68 on a 1080 field (6.3%) with 22x42 of
     padding, which is a much larger slab than the hero's in-form button. Same element,
     two jobs: in the form it is a control sized to the field above it, and here it is
     the campaign's closing frame. */
  .lockup .cta {
    display: inline-block; width: auto; margin-top: 2px;
    font-size: clamp(24px, 6.3vw, 76px); padding: 0.32em 0.62em 0.38em;
  }
  .url {
    font-family: ${MONO}; font-weight: 600; font-size: clamp(14px, 3.2vw, 30px);
    letter-spacing: 0.12em; color: var(--ink);
  }

  /* ---- outcome pages ----------------------------------------------------- */
  section.outcome { padding: 8vh 0 12vh; }
  .outcome .display { max-width: 16ch; }
  .outcome p { max-width: 44ch; }

  /* ---- legal + support --------------------------------------------------- */
  /* The legal documents contain long unbreakable tokens (email addresses, file paths
     in code spans). At 320px they pushed the page 8px wider than the viewport, which
     is a horizontal scrollbar on the two pages App Review opens. */
  article { max-width: 68ch; padding: 26px 0 40px; overflow-wrap: anywhere; }
  article h1 { font-family: ${SANS}; font-weight: 800; font-size: clamp(28px, 5vw, 40px); line-height: 1.18; letter-spacing: -0.02em; margin: 0 0 0.4em; }
  article h2 { font-family: ${SANS}; font-weight: 800; font-size: 1.28em; line-height: 1.3; letter-spacing: -0.015em; margin: 1.9em 0 0.6em; padding-top: 0.7em; border-top: 1px solid var(--rule); }
  article h2:first-child { border-top: none; padding-top: 0; margin-top: 0; }
  /* The source documents put a --- before most section headings, which used to draw
     the markdown's rule and the heading's own rule as two lines 20px apart. */
  article hr + h2 { border-top: none; padding-top: 0; margin-top: 0.7em; }
  article h3 { font-family: ${MONO}; font-weight: 600; font-size: 0.78em; margin: 1.5em 0 0.5em; color: var(--muted); text-transform: uppercase; letter-spacing: 0.14em; }
  article p { margin: 0 0 1em; }
  article ul, article ol { margin: 0 0 1em; padding-left: 1.4em; }
  article li { margin: 0.35em 0; }
  article li > ul, article li > ol { margin-top: 0.35em; }
  article hr { border: none; border-top: 1px solid var(--rule); margin: 2em 0; }
  article strong { font-weight: 700; color: var(--ink); }
  article code {
    background: rgba(22,26,15,0.05); border: 1px solid var(--rule);
    padding: 0.15em 0.4em; font-size: 0.86em; font-family: ${MONO}; font-weight: 600;
  }

  .table-scroll { overflow-x: auto; margin: 0 0 1.4em; border: 1px solid var(--rule); }
  table { border-collapse: collapse; width: 100%; min-width: 480px; font-size: 0.9em; }
  th, td { text-align: left; padding: 0.6em 0.75em; border-bottom: 1px solid var(--rule); vertical-align: top; }
  thead th { background: rgba(22,26,15,0.04); color: var(--muted); font-weight: 700; white-space: nowrap; }
  tbody tr:last-child td { border-bottom: none; }

  section.card { border: 1px solid var(--rule); padding: 1.5em; margin: 1.6em 0; max-width: 68ch; }
  section.card h2 { margin-top: 0; border-top: none; padding-top: 0; }

  /* ---- footer ------------------------------------------------------------ */
  footer.site-footer { border-top: 1px solid var(--rule); padding: 24px 0 44px; color: var(--muted); font-size: 13.5px; }
  footer.site-footer nav { margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; }
  footer.site-footer a { color: var(--muted); }
  footer.site-footer a:hover { color: var(--accent); }

  /* ---- wide viewports ---------------------------------------------------- */
  /* The hero becomes two columns and the product moves up beside the form, which
     is the campaign's own composition (left-aligned column of type, object off to
     the side) laid into a landscape field. On a phone it stays one column and the
     product sits below the fold on purpose: the ad already spent nine seconds
     showing the product, so the first screen's only job is to close. */
  @media (min-width: 900px) {
    /* Tall desktop: type over form on the left, object on the right spanning both.
       This is what the page looked like before the hero became three areas, and it
       is the composition the campaign's stills use. */
    .hero-grid {
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      grid-template-areas: "copy aside" "act aside";
      grid-template-rows: auto auto;
      column-gap: 64px; row-gap: 0;
      align-items: start;
    }
    .hero-aside { align-self: center; }
    /* ONE object beside the type, not three. The campaign's second rule is that a
       fragment owns its frame: pull one element out and draw it large. Three small
       plates stacked here would restate the section below it and shrink every one of
       them to do it. */
    .hero-aside { perspective: ${TILT.perspective}; display: block; container-type: inline-size; }
    section.hero { padding: 44px 0 76px; }

    /* TWO columns below, not three, because the third object is already in the
       hero. The badge and its caption used to render twice on a desktop page —
       once beside the form and again as the first fragment, the same object under
       the same sentence 700px apart. Exactly one of the two is in the DOM's
       rendered tree at any width (display:none also removes it from the
       accessibility tree), so neither sighted nor screen-reader visitors get it
       twice, and neither loses it. Dropping to two columns is also what lets the
       remaining objects grow from 286px to about 580px: the product gets bigger by
       showing less of it, which is the campaign's whole fragment argument. */
    .fragments { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 46px; align-items: start; }
    .fragment.frag-lead { display: none; }
    .fragment { max-width: none; }
    .plain-list { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 34px; }
  }
  @media (max-width: 899px) {
    /* Below 900 the hero is one column and the aside's object would push the form
       down the screen, so the lead fragment does its job in the stage instead. */
    .hero-aside { display: none; }
  }

  /* SHORT SINGLE-COLUMN WINDOWS. Two shapes fail the "button on the first screen"
     test with the phone layout's default type: a 320x568 handset, where the stack
     runs 86px past the fold, and a 899x700 window, where the layout is still one
     column but 8.4vw has grown the headline to 75px and the stack runs 112px past.
     Same remedy as the desktop tier — the type steps down and the rhythm tightens,
     nothing is removed — and it is keyed on height so a normal phone held normally
     never sees it. The lede is the sentence carrying "18+" and "not dating", so it
     is the least compressed thing here and never goes below 15.5px. */
  @media (max-width: 899px) and (max-height: 760px) {
    section.hero { padding: 20px 0 40px; }
    h1.display { font-size: clamp(30px, 7.2vw, 52px); margin-bottom: 0.28em; }
    .lede { font-size: clamp(15.5px, 4.3vw, 19px); margin-bottom: 0.5em; }
    .sub { font-size: clamp(13.5px, 3.6vw, 16px); margin-bottom: 1.15em; }
    .eyebrow { font-size: clamp(10.5px, 2.41vw, 15px); margin-bottom: 0.75em; }
    .field-label { margin-bottom: 6px; }
    input[type="email"] { padding: 13px 14px; }
    .adult { margin: 12px 0 14px; }
    .cta { font-size: clamp(21px, 5.1vw, 34px); }
  }

  /* ---- short landscape windows ------------------------------------------- */
  /* The hero is 1005px tall at its full size, which puts the button's bottom edge
     at y=870 no matter how short the window is. Measured: fine at 1440x900, but
     130px below the fold on a MacBook with browser chrome (1440x740), 210px below
     on the commonest laptop size (1366x660), and at 1280x600 the input's own top
     edge is at the fold. A desktop visitor arriving from the ad saw a headline and
     no form.
     This block is keyed on HEIGHT, not width, so the full-size campaign
     composition survives on every window tall enough to hold it and only a window
     that cannot gets the compressed one. Nothing is removed — the display drops
     one step, the vertical rhythm tightens, and the aside shrinks. */
  /* The second clause is not redundant. The full-size composition needs room in
     BOTH axes: at exactly 900px wide the two-column hero squeezes the type column
     to about 430px, the 76px headline wraps to three lines, and the button lands
     at y=981 — below the fold even in a 920px-tall window. So anything under
     1200px wide gets the compressed hero whatever its height. */
  @media (min-width: 900px) and (max-height: 940px),
         (min-width: 900px) and (max-width: 1199px) {
    section.hero { padding: 24px 0 44px; }
    .hero-grid { column-gap: 48px; }
    h1.display { font-size: clamp(34px, 5.1vw, 58px); margin-bottom: 0.3em; }
    .lede { font-size: clamp(16px, 1.42vw, 19px); margin-bottom: 0.45em; }
    .sub { font-size: clamp(14px, 1.18vw, 16px); margin-bottom: 1.1em; }
    .eyebrow { margin-bottom: 0.7em; }
    .field-label { margin-bottom: 5px; }
    input[type="email"] { padding: 12px 14px; font-size: 16px; }
    .adult { margin: 12px 0 14px; }
    .cta { font-size: clamp(21px, 3.3vw, 34px); }
    .promise { margin-top: 12px; }
  }

  /* SHORT AND WIDE: the form moves BESIDE the type, not under it.
     Below about 760px of viewport height, compressing the stack stops being
     enough — measured, the button's bottom edge sits at y=689 however hard the
     block above squeezes, because the eyebrow, a two-line 58px headline, a
     three-line lede and a three-line sub are 400px of type before the field
     starts. Stacking is simply the wrong shape for a landscape window.
     So the second column stops being the product and becomes the form. The form
     then starts at the top of its own column instead of at the bottom of 400px of
     copy, which is what puts it on the first screen at 1366x660 and 1280x600 —
     the two commonest laptop shapes, and the two that failed. The product is not
     lost, it is the next thing down the page. */
  @media (min-width: 900px) and (max-height: 760px) {
    section.hero { padding: 20px 0 34px; }
    .hero-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 460px);
      grid-template-areas: "copy act";
      grid-template-rows: auto;
      column-gap: clamp(32px, 5vw, 72px);
      align-items: start;
    }
    .hero-aside { display: none; }
    .hero-copy .sub { margin-bottom: 0; }
    /* The aside is gone, so the lead fragment comes back into the stage: the
       object and its caption exist exactly once at every viewport, never zero
       times and never twice. */
    .fragments { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 40px; }
    .fragment.frag-lead { display: block; }
  }
`;

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

function pageShell({
  title,
  description,
  bodyHtml,
  canonical,
  footerNote,
  noindex = false,
  ogImage = "/og.png",
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
${canonical ? `<link rel="canonical" href="${canonical}">` : ""}
${noindex ? `<meta name="robots" content="noindex">` : ""}
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/favicon.png">
<meta name="theme-color" content="${GROUND.base}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="DuoQueue">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${SITE_ORIGIN}${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
${canonical ? `<meta property="og:url" content="${canonical}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<style>${CSS}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/">${ringsMarkSvg({ size: 26 })}<span>duoqueue</span></a>
    <nav>
      <a href="/privacy/">Privacy</a>
      <a href="/terms/">Terms</a>
      <a href="/#support">Support</a>
    </nav>
  </div>
</header>
<main id="main">
${bodyHtml}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>DuoQueue is an 18+ app for finding people to play games with. It is platonic, not dating.${footerNote ? ` ${escapeHtml(footerNote)}` : ""}</p>
    <nav>
      <a href="/">Home</a> <span aria-hidden="true">&middot;</span>
      <a href="/privacy/">Privacy Policy</a> <span aria-hidden="true">&middot;</span>
      <a href="/terms/">Terms of Service</a> <span aria-hidden="true">&middot;</span>
      <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
    </nav>
  </div>
</footer>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// The product fragments.
//
// Redrawn in HTML and CSS from the app's own source rather than screenshotted.
// Three reasons, in order of how much they mattered:
//
//   1. The campaign's fragments are crops of an iPhone screen recording that
//      contains photographs of real people. None of that is in the repository
//      (marketing/video/public/footage and out/ are both gitignored), and putting
//      a real person's face on a landing page is a consent decision this build
//      should not make on anybody's behalf.
//   2. Drawn in CSS it is crisp at every device pixel ratio and weighs nothing.
//   3. It is genuinely the product: the strings are the app's strings, from
//      SwipeCard.tsx's overlapLabel(), profile-labels.ts's SKILL_LABELS, and the
//      chat composer's own placeholder.
//
// They follow the campaign's isolated-fragment doctrine rather than showing a
// shrunken phone: pull ONE element out and let it own its frame. A card cropped to
// one chip renders that chip's mono type at a readable size; the same chip inside a
// whole phone screen at the same width renders it at 12px and Cameron's standing
// note on every earlier cut was that you cannot see the app.
// ---------------------------------------------------------------------------

const ARROW_UP_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${APP.onVolt}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>`;

const FRAGMENTS = [
  {
    // SwipeCard.tsx:61-63 — overlapLabel(3) returns exactly this string.
    html: `<div class="object"><div class="overlap"><span>&gt;&gt; 3 GAMES IN COMMON</span></div></div>`,
    caption: "you match on what you actually play",
  },
  {
    // Chip.tsx with label + detail; the details are SKILL_LABELS values.
    html: `<div class="object"><div class="chips">
      <span class="chip"><b>Rocket League</b><i>&middot; Ranked Grinder</i></span>
      <span class="chip"><b>Valorant</b><i>&middot; Competitive</i></span>
    </div></div>`,
    caption: "and on how they play it",
  },
  {
    // app/chat/[matchId].tsx:749-795 — the composer, placeholder and all.
    html: `<div class="object"><div class="composer">
      <div class="box">Message&hellip;</div>
      <div class="send">${ARROW_UP_SVG}</div>
    </div></div>`,
    caption: "then you talk, and queue up",
  },
];

/** `frag-lead` marks the object that the desktop hero also carries. The CSS shows
 * exactly one of the two at any viewport; see the `.frag-lead` rules. */
function fragmentsHtml(list = FRAGMENTS) {
  return list
    .map(
      (f, i) =>
        `<div class="fragment${i === 0 ? " frag-lead" : ""}">${f.html}` +
        `<p class="caption">${f.caption}</p></div>`
    )
    .join("\n      ");
}

// ---------------------------------------------------------------------------
// The waitlist page. One template, five URLs, one hidden field's difference.
//
// /, /waitlist/, /tt/, /ig/ and /yt/ all render this. The root gets the form
// because the ads' end card prints "duoqueue.io" and nothing else: a visitor who
// has to find and tap a second link before they can type an address is a visitor
// the campaign paid for and then lost. The three channel paths are short enough to
// live in a social bio and give per-channel attribution with no analytics SDK, no
// cookie and no query-string JavaScript.
// ---------------------------------------------------------------------------

const HERO_LEDE = "DuoQueue is an 18+ app for finding people to play games with. It is not dating.";
const HERO_SUB =
  "You match on the games you play, the hours you are online, and how you like to play them. Then you talk, and queue up.";

function signupForm(source) {
  return `
      <form class="signup" id="waitlist-form" method="post" action="${WAITLIST_ENDPOINT}">
        <label class="field-label" for="email">Your email</label>
        <input id="email" type="email" name="email" placeholder="you@example.com"
               autocomplete="email" inputmode="email" spellcheck="false"
               maxlength="254" required>

        <div class="hp" aria-hidden="true">
          <label for="company">Company</label>
          <input id="company" type="text" name="company" tabindex="-1" autocomplete="off">
        </div>

        <div class="adult">
          <input id="adult" type="checkbox" name="adult" value="yes" required>
          <label for="adult">I am 18 or older</label>
        </div>

        <input type="hidden" name="source" value="${source}">
        <button class="cta" type="submit">join the waitlist</button>
      </form>
      <p class="promise">One email, on the day it goes live. That is the only one you get.</p>
      <p class="fineprint">We do not share your address. No analytics, no trackers and no cookies on this page &mdash; submitting the form sets one 30-minute anti-bot cookie on our backend&rsquo;s own domain, and nothing else. See the <a href="/privacy/">Privacy Policy</a>.</p>`;
}

/** The launched-phase body. Built now rather than left as a TODO so the flip in
 * 1.6 is one constant and not a rewrite under time pressure on release day. */
function launchedCta() {
  return `
      <p><a class="cta" href="${APP_STORE_URL}" style="max-width:460px;">download on the app store</a></p>
      <p class="promise">DuoQueue is live. If you joined the waitlist, the email is already on its way.</p>`;
}

function waitlistBody({ source }) {
  const action = PHASE === "launched" ? launchedCta() : signupForm(source);
  const slabHref = PHASE === "launched" ? APP_STORE_URL : "#waitlist-form";
  const slabLabel = PHASE === "launched" ? "download duoqueue" : "join the waitlist";

  return `
<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${PHASE === "launched" ? "Out now" : "The waitlist"}</p>
        <h1 class="display">queue up<br>with a <span class="key">duo</span></h1>
        <p class="lede">${HERO_LEDE}</p>
        <p class="sub">${HERO_SUB}</p>
      </div>
      <div class="hero-act">
${action}
      </div>
      <div class="hero-aside">
        ${FRAGMENTS[0].html}
        <p class="caption">${FRAGMENTS[0].caption}</p>
      </div>
    </div>
  </div>
</section>

<section class="stage">
  <div class="wrap">
    <h2 class="eyebrow">What you are joining</h2>
    <div class="fragments">
      ${fragmentsHtml()}
    </div>
  </div>
</section>

<section class="plain">
  <div class="wrap">
    <h2 class="eyebrow">The plain version</h2>
    <ul class="plain-list">
      <li>
        <h3>18+ only</h3>
        <p>DuoQueue is for adults. The box on that form is you telling us your age. It is not us checking it, and we do not pretend otherwise.</p>
      </li>
      <li>
        <h3>Platonic, not dating</h3>
        <p>You are looking for someone to play with. The profile is games, hours and playstyle, and there is nothing romantic anywhere in the app.</p>
      </li>
      <li>
        <h3>Everyone starts together</h3>
        <p>The whole list gets the app on the same day on purpose, so the first people in find someone to play with instead of an empty screen.</p>
      </li>
    </ul>
  </div>
</section>

<section class="lockup">
  <div class="wrap">
    <div class="lockup-inner">
      ${ringsMarkSvg({ size: 250, label: "" })}
      <div class="wordmark">duoqueue</div>
      <a class="cta" href="${slabHref}">${slabLabel}</a>
      <div class="url">${CUSTOM_DOMAIN}</div>
    </div>
  </div>
</section>
`;
}

/** The support and legal block. Lives on the root page only, because that is the
 * URL registered as the app's Support URL and the one App Review opens. */
function supportSection() {
  return `
<section class="plain" id="support">
  <div class="wrap">
    <section class="card">
      <h2>Support</h2>
      <p>Questions, account issues, or anything else? Reach us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
      <p>Report a safety concern: if you need to report abuse, harassment, or other user-content issues, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. Reports can also be filed directly in the app from a profile or conversation.</p>
      <p><a href="/privacy/">Privacy Policy</a> and <a href="/terms/">Terms of Service</a>.</p>
    </section>
  </div>
</section>
`;
}

function buildWaitlistPage({ source, canonical, includeSupport }) {
  return pageShell({
    title:
      PHASE === "launched"
        ? "DuoQueue: find your duo"
        : "DuoQueue: join the waitlist",
    description:
      "DuoQueue is an 18+ app for finding people to play games with. Platonic, not dating. Join the waitlist and get one email the day it goes live.",
    canonical,
    bodyHtml: waitlistBody({ source }) + (includeSupport ? supportSection() : ""),
  });
}

// ---------------------------------------------------------------------------
// The two outcome pages.
//
// There is no JavaScript on this site, so a static page cannot read a query
// string and there is no way to render one page in several states. Two pages
// instead. Everything the endpoint knows that a visitor does not need to know
// (accepted, already on the list, honeypot tripped, rate limited) lands on
// /waitlist/thanks/, so a prober learns nothing and no real person is ever told
// their signup failed when the row exists. /waitlist/try-again/ is reachable only
// for the two things a human can actually fix.
//
// Both are noindex: they are states, not pages, and a search result pointing at
// "You are on the list" would be a dead end for somebody who is not.
// ---------------------------------------------------------------------------

function buildThanksPage() {
  const body = `
<section class="outcome">
  <div class="wrap">
    <p class="eyebrow">The waitlist</p>
    <h1 class="display">you are <span class="key">on the list</span></h1>
    <p class="lede">We will email you once, the day DuoQueue goes live. Nothing before that, nothing after.</p>
    <p class="sub">Add ${SUPPORT_EMAIL} to your contacts so it does not land in spam.</p>
    <p class="fineprint">Changed your mind, or joined by accident? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and we will take you off.</p>
  </div>
</section>

<section class="lockup">
  <div class="wrap">
    <div class="lockup-inner">
      ${ringsMarkSvg({ size: 250, label: "" })}
      <div class="wordmark">duoqueue</div>
      <div class="url">${CUSTOM_DOMAIN}</div>
    </div>
  </div>
</section>
`;
  return pageShell({
    title: "You are on the list | DuoQueue",
    description: "You joined the DuoQueue waitlist. We will email you once, the day it goes live.",
    bodyHtml: body,
    noindex: true,
  });
}

function buildTryAgainPage() {
  const body = `
<section class="outcome">
  <div class="wrap">
    <p class="eyebrow">The waitlist</p>
    <h1 class="display">we could not <span class="key">add that one</span></h1>
    <p class="lede">Either the address did not look like an email address, or the 18 or older box was not ticked.</p>
    <p class="sub">DuoQueue is 18+ only, so that box is not optional.</p>
    <p><a class="cta" href="/#waitlist-form" style="max-width:340px;">try again</a></p>
    <p class="fineprint">Still not working? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and we will add you by hand.</p>
  </div>
</section>
`;
  return pageShell({
    title: "Try again | DuoQueue",
    description: "That signup did not go through. Check the address and the 18 or older box.",
    bodyHtml: body,
    noindex: true,
  });
}

// ---------------------------------------------------------------------------
// Legal pages
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE POSTAL ADDRESS COMES FROM THE EDGE FUNCTION, NOT FROM HERE.
//
// It used to be written out five times: the welcome email's footer, a "Mailing
// address" line in each of the two legal documents, the arbitration opt-out
// sentence, and the DMCA agent. Five copies of a fact that is going to change,
// where missing one leaves a published legal page disagreeing with the email
// that links to it about where the company can be served.
//
// supabase/functions/_shared/org.ts owns it, because `supabase functions deploy`
// bundles only what it can reach from the entrypoint and cannot reach out here.
// So the runtime that SENDS the email owns the value and this build borrows it,
// by parsing the literal out of that file.
//
// Parsed rather than imported: this script is deliberately zero-dependency and
// runs under plain node, while that file is Deno TypeScript. A regex over one
// string literal is the whole cost, and the failure mode is loud.
// ---------------------------------------------------------------------------
const ORG_TS = path.join(ROOT, "supabase", "functions", "_shared", "org.ts");

function readPostalAddress() {
  if (!existsSync(ORG_TS)) {
    throw new Error(`build-site: ${ORG_TS} is missing; the legal pages cannot be built without it`);
  }
  const src = readFileSync(ORG_TS, "utf8");
  const m = /export const POSTAL_ADDRESS\s*=\s*"([^"]+)"/.exec(src);
  if (!m) {
    throw new Error(
      "build-site: could not parse POSTAL_ADDRESS out of supabase/functions/_shared/org.ts. " +
        "If that constant was renamed or turned into a template literal, update this reader — " +
        "do not hardcode the address back into the legal documents.",
    );
  }
  return m[1];
}

/** Substitutes the address tokens and refuses to publish a page still carrying one.
 *
 * The unresolved-token check is the point of the whole arrangement. A page that shipped
 * reading "Mailing address: {{POSTAL_ADDRESS}}" would be worse than the duplication it
 * replaced, so a leftover token fails the build the same way a TODO marker does. */
function substituteOrgTokens(markdown, srcFile) {
  const address = readPostalAddress();
  const out = markdown
    .replace(/\{\{POSTAL_ADDRESS_WITH_NAME\}\}/g, `DuoQueue, ${address}`)
    .replace(/\{\{POSTAL_ADDRESS\}\}/g, address);

  const leftover = /\{\{[A-Z_]+\}\}/.exec(out);
  if (leftover) {
    throw new Error(
      `build-site: ${srcFile} still contains the unresolved token ${leftover[0]} after substitution. ` +
        "Every {{TOKEN}} in docs/legal/*.md must be handled here before the page is written.",
    );
  }
  return out;
}

function buildLegalPage({ srcFile, destDir, description, canonical }) {
  const srcPath = path.join(LEGAL_DIR, srcFile);
  const markdown = substituteOrgTokens(readFileSync(srcPath, "utf8"), srcFile);
  const { html, title } = mdToHtml(markdown);
  const lastUpdated = resolveLastUpdated(srcPath, markdown);
  const pageHtml = pageShell({
    title: title ? `${title} | DuoQueue` : "DuoQueue",
    description,
    canonical,
    bodyHtml: `<div class="wrap"><article>\n${html}\n</article></div>`,
    footerNote: `Last updated: ${lastUpdated.label}${lastUpdated.isPlaceholder ? ". Placeholder, see script header." : ""}`,
  });
  const outDir = path.join(SITE_DIR, destDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "index.html"), pageHtml, "utf8");
  return path.join(outDir, "index.html");
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

function checkPhase() {
  if (PHASE !== "waitlist" && PHASE !== "launched") {
    console.error(`REFUSING TO BUILD: PHASE is "${PHASE}"; it must be "waitlist" or "launched".`);
    process.exit(1);
  }
  if (PHASE === "launched") {
    if (!APP_STORE_URL || APP_STORE_URL.includes("<AppleID>")) {
      console.error(
        "REFUSING TO BUILD: PHASE is \"launched\" but APP_STORE_URL is not set.\n\n" +
          "  scripts/build-site.mjs: const APP_STORE_URL = " +
          String(APP_STORE_URL) +
          "\n\n" +
          "A launched landing page whose only call to action is a dead link is the same\n" +
          "failure as a legal page with a TODO in it, so it gets the same treatment. Put\n" +
          "the real App Store URL (the Apple ID is in App Store Connect) in that constant\n" +
          "and re-run."
      );
      process.exit(1);
    }
  }
}

function checkFonts() {
  const missing = [];
  for (const face of FACES) {
    const p = path.join(SITE_DIR, "fonts", face.file);
    try {
      if (statSync(p).size === 0) missing.push(`${face.file} (empty)`);
    } catch {
      missing.push(`${face.file} (not found)`);
    }
  }
  if (missing.length) {
    console.error(
      "REFUSING TO BUILD: brand typefaces missing from site/fonts/.\n\n" +
        missing.map((m) => `  ${m}`).join("\n") +
        "\n\nThese are committed subsets. If they really are gone, regenerate them:\n" +
        "  python -m pip install --target <outside-this-repo> fonttools brotli\n" +
        "  PYTHONPATH=<that> python scripts/site-fonts/subset.py\n\n" +
        "This is a hard failure rather than a fallback because a missing face does not\n" +
        "look broken, it looks like a different, worse design set in the system sans."
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  checkPhase();

  const legalFiles = [
    { srcFile: "privacy-policy.md", label: "docs/legal/privacy-policy.md" },
    { srcFile: "terms-of-service.md", label: "docs/legal/terms-of-service.md" },
  ];

  // TODO guard runs across both files before anything is written.
  const allMarkers = [];
  for (const f of legalFiles) {
    const text = readFileSync(path.join(LEGAL_DIR, f.srcFile), "utf8");
    allMarkers.push(...findTodoMarkers(f.label, text));
  }
  if (allMarkers.length > 0) {
    console.error("REFUSING TO BUILD: unresolved TODO markers found in legal source documents.\n");
    for (const m of allMarkers) {
      console.error(`  ${m.file}:${m.line}: ${m.text}`);
    }
    console.error(
      `\n${allMarkers.length} marker(s) total across ${legalFiles.length} file(s). ` +
        "Resolve them in docs/legal/ (including the closing draft-disclaimer paragraphs, " +
        "which name the markers themselves) and re-run this script."
    );
    process.exit(1);
  }

  checkFonts();
  console.log("Contrast, measured against the sweep's darkest stop:");
  checkContrast();
  console.log("");

  mkdirSync(SITE_DIR, { recursive: true });
  const written = [];

  function write(relPath, contents) {
    const full = path.join(SITE_DIR, relPath);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents, "utf8");
    written.push(relPath);
  }

  // The landing page and its four aliases. `/` carries the support block because
  // it is the URL registered with App Store Connect; the aliases canonicalise to
  // it so five URLs serving one page is not four duplicate-content pages.
  write("index.html", buildWaitlistPage({ source: "direct", canonical: `${SITE_ORIGIN}/`, includeSupport: true }));
  write("waitlist/index.html", buildWaitlistPage({ source: "direct", canonical: `${SITE_ORIGIN}/`, includeSupport: false }));
  for (const [dir, source] of [["tt", "tt"], ["ig", "ig"], ["yt", "yt"]]) {
    write(`${dir}/index.html`, buildWaitlistPage({ source, canonical: `${SITE_ORIGIN}/`, includeSupport: false }));
  }
  write("waitlist/thanks/index.html", buildThanksPage());
  write("waitlist/try-again/index.html", buildTryAgainPage());

  const privacyOut = buildLegalPage({
    srcFile: "privacy-policy.md",
    destDir: "privacy",
    description: "DuoQueue's Privacy Policy: what we collect, why, and who we share it with.",
    canonical: `${SITE_ORIGIN}/privacy/`,
  });
  written.push(path.relative(SITE_DIR, privacyOut).split(path.sep).join("/"));

  const termsOut = buildLegalPage({
    srcFile: "terms-of-service.md",
    destDir: "terms",
    description: "DuoQueue's Terms of Service.",
    canonical: `${SITE_ORIGIN}/terms/`,
  });
  written.push(path.relative(SITE_DIR, termsOut).split(path.sep).join("/"));

  // CNAME and .nojekyll are emitted here rather than living only on the gh-pages
  // branch. That gap is why this branch's history reads "Delete CNAME" then
  // "Create CNAME": a deploy that mirrors site/ over the worktree removed the
  // custom domain, which takes duoqueue.io down and the App Store's registered
  // Privacy Policy URL with it. Fixed at the source: site/ is now a complete,
  // self-sufficient copy of the published site.
  write("CNAME", `${CUSTOM_DOMAIN}\n`);
  // .nojekyll stops GitHub Pages running the content through Jekyll, which would
  // otherwise refuse to serve anything under a directory beginning with an
  // underscore and adds a build step nothing here needs.
  write(".nojekyll", "");

  copyFileSync(path.join(APP_ASSETS, "favicon.png"), path.join(SITE_DIR, "favicon.png"));
  written.push("favicon.png");

  // og.png is generated by scripts/make-og.mjs (it needs sharp, which this build
  // deliberately does not). Assert it rather than generate it, so a missing link
  // preview is visible at build time instead of on Twitter.
  try {
    if (statSync(path.join(SITE_DIR, "og.png")).size > 0) written.push("og.png (pre-existing)");
  } catch {
    console.warn("  WARNING: site/og.png is missing. Run `node scripts/make-og.mjs`.");
  }

  for (const p of written) console.log(`wrote site/${p}`);
  console.log(`\nBuilt site/ successfully (PHASE = "${PHASE}").`);
}

// Run main() only when this file is executed directly (`node
// scripts/build-site.mjs`), not when it's imported — lets a test script
// import the pure functions above without triggering a full build.
if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}

export {
  findTodoMarkers,
  mdToHtml,
  slugify,
  escapeHtml,
  renderInline,
  rewriteLink,
  resolveLastUpdated,
  ringsMarkSvg,
  contrastRatio,
  GROUND,
  INK,
  APP,
  PHASE,
};
