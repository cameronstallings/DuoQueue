// scripts/build-site.mjs — builds the public duoqueue.io site into site/.
//
// Zero dependencies on purpose (matches the rest of this repo's scripts/ policy):
// only node:fs, node:path, node:url. No markdown library, no bundler, no CDN.
// Every page is fully self-contained HTML with an inline <style> block and inline
// SVG, and the only sub-resources any page requests are five .woff2 files served
// from this same origin, plus, on the landing page and its aliases, the launch film
// and its poster (FILM below), also from this same origin and played by a plain
// <video> element with no script. No third-party request of any kind, from any page. That
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
//   and, committed rather than generated (like og.png and the fonts):
//     site/assets/duoqueue-launch.mp4          the launch film, shown on the landing page
//     site/assets/duoqueue-launch-poster.jpg   its poster frame
//   The film section is built only when both files are present, so a page never points at
//   a missing video; the build's last line says whether it went in.
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
// The CTA used to be the answer to that. It was FURNITURE rather than footage, so it kept
// the off-black slab with raw #CDFF3D at 16.88:1 and the one moment of decision still
// carried the brand. That worked while the page's product fragments were ALSO dark: the
// button belonged to a family of dark objects on light paper. After the light commitment
// every fragment turned white with a #C9CFBB hairline and the button became the only
// off-black object left on a warm cream page - it stopped being the loudest member of a
// family and became the only thing shouting. Cameron's note, verbatim: "so blunt and ugly
// being black and neon yellow ... too harsh on the eyes, it does not match the landing
// page at all."
//
// So the CTA is now the app's OWN light-theme primary button, which is the same move the
// rest of this file already makes everywhere else: `volt` #4A6B00 as the fill and `onVolt`
// #F7F9F0 as the label, at radius.button = 6, with the app's own scale(0.97) press. That
// is literally what apps/mobile/src/components/Button.tsx renders on paper, and it is
// already what the message-send button in the third fragment on this page looks like.
//
// The measured trade, stated rather than hidden. The label pair goes 16.88:1 -> 5.82:1 and
// the SILHOUETTE - the fill against the paper, which is what a button is read by before its
// words - goes 17.18:1 -> 5.39:1. That is the real cost and it is why everything else about
// the button got LOUDER to pay for it: it gains a cast shadow in the page's own shadow ink
// so it is a lifted object rather than a hole punched in the paper, it gains air above it,
// and it deepens to `voltDim` #3B5600 (7.27:1 silhouette) under the pointer. A deep olive
// is also the only chromatic mass on a neutral warm ground, which black was not.
//
// What it costs the brand: raw chartreuse now appears nowhere on the rendered page except
// inside the skip link's dark slab. That is the rule holding, not the rule breaking - a
// chartreuse fill on this ground has no silhouette at 1.05:1 - but it is a real loss and
// it belongs in the record rather than in a footnote.
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
  voltDim: "#3B5600", // lightColors.voltDim — the app's own pressed/dimmed volt
  onVolt: "#F7F9F0",
  amber: "#8F5E00", // lightColors.overlap.many — three or more games in common
};

// THE FILM: the launch video, on the landing page and its four aliases.
//
// Committed media under site/assets/, like og.png and the fonts, because it is rendered
// elsewhere (the Hyperframes launch render) and this build is zero-dependency. It is played
// by a plain <video> element: native controls, no script, which is what lets the privacy
// policy keep saying there is no JavaScript on the site. Muted, so browsers allow it to play
// itself; loop, so it holds on a phone that scrolls back to it; playsinline, so iOS does not
// throw it into the fullscreen player.
//
// AUTOPLAY IS THE ONE TRADE HERE. With no script there is no way to honour Reduce Motion for
// a video: the CSS media query can stop an animation but cannot stop a <video> from playing.
// The native controls are the pause (WCAG 2.2.2), and browsers pause a muted autoplay video
// while it is off screen. If that is not enough, set autoplay to false and the film waits on
// its poster for a tap on every device.
const FILM = {
  video: "assets/duoqueue-launch.mp4",
  poster: "assets/duoqueue-launch-poster.jpg",
  // darkColors.background in apps/mobile/src/theme/tokens.ts, which is also the film's own
  // ground to within a unit, so the frame shows no seam while the poster loads.
  ground: "#0A0B09",
  autoplay: true,
};

/** Both files present and non-empty. The section is left out otherwise, loudly. */
function filmPresent() {
  return [FILM.video, FILM.poster].every((rel) => {
    try {
      return statSync(path.join(SITE_DIR, rel)).size > 0;
    } catch {
      return false;
    }
  });
}

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
  // Held as numbers as well as a string, because THE TILT IS NOW ANIMATED and the arrival
  // below has to be able to add to it. marketing/video/src/pro/motion.ts is blunt about why
  // it had to become one: it names this exact pair of angles, as a "CONSTANT, NEVER
  // ANIMATED tilt", as "three failures in one line ... it never changes, which is the entire
  // difference between a 3D move and a Dribbble mockup".
  rotY: 7,
  rotX: 2,
  get transform() {
    return `rotateY(${this.rotY}deg) rotateX(${this.rotX}deg)`;
  },
  // The object the campaign's shadow was authored for. ground.ts:237 draws an
  // 844px-wide card on a 1080px frame; every length in FRAG_SHADOW_LAYERS below is
  // a ratio of THAT width, which is the entire point.
  authoredFor: 844,
};

// ---------------------------------------------------------------------------
// THE ARRIVAL, transcribed frame for frame from marketing/video/src/pro/motion.ts.
//
// That file measured it off the reference reels rather than inventing it: an object
// arrives ROTATED AND OVERSIZED UNDER BLUR and unwinds to flat over eight frames, then
// keeps contracting for another thirty-four. Both halves matter. The eight frames are the
// arrival; the thirty-four are "what stops an arrival from being a snap followed by a
// frozen picture", and dropping them is how a page ends up with a 267ms pop.
//
// Opacity IGNITES at 25% of the travel rather than starting from zero, so the object is
// never a ghost fading up: by the time it is visible at all it is most of the way through
// its rotation. That is the difference between this and a fade-in-up preset.
//
// Everything is stored in the film's own frames and converted here, once, so that a future
// reader can put this file and motion.ts side by side and see the same numbers.
const ARRIVAL = {
  fps: 30,
  frames: 8, // the arrival
  settle: 34, // the slow post-arrival contraction
  rotY: 18, // relative to the object's resting TILT, not absolute
  rotX: -12,
  rotZ: -3,
  scale: 1.18,
  landed: 1.05,
  blur: 24,
  ignite: 0.25,
};
const ms = (frames) => Math.round((frames / ARRIVAL.fps) * 1000);
/** The arrival and the settle run as ONE animation so the object never stops moving
 *  between them; these are the keyframe offsets that splice the two curves together. */
const ARRIVAL_TOTAL = ms(ARRIVAL.frames + ARRIVAL.settle);
const AT_LANDED = +((ms(ARRIVAL.frames) / ARRIVAL_TOTAL) * 100).toFixed(2);
const AT_IGNITE = +((ms(ARRIVAL.frames * ARRIVAL.ignite) / ARRIVAL_TOTAL) * 100).toFixed(2);
/** The pose an object is in when it is `k` of the way out of its arrival (1 = fully
 *  displaced, 0 = at rest on the TILT). */
const arrivalPose = (k, scale) =>
  `rotateY(${+(TILT.rotY + ARRIVAL.rotY * k).toFixed(2)}deg) ` +
  `rotateX(${+(TILT.rotX + ARRIVAL.rotX * k).toFixed(2)}deg) ` +
  `rotateZ(${+(ARRIVAL.rotZ * k).toFixed(2)}deg) scale(${scale})`;

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

// ---------------------------------------------------------------------------
// THE CALL TO ACTION'S SHADOW.
//
// The button lost 17.18:1 of silhouette when it stopped being off-black (see the design
// note above). A cast shadow is how it gets presence back without getting harshness back:
// an object that sits ON the paper is read before an object that is merely a different
// colour from it, and it is the same read the fragments already get.
//
// It is NOT the fragments' shadow. Theirs is a ratio of the object's width because it is
// copying an optical relationship from a film; this one is in fixed pixels because the
// button is furniture at a known size (250px on the smallest phone, 460px in the form) and
// because a cast that scaled with a 460px button would put 24px of grey under the sentence
// beneath it. Same ink, though - rgba(41,34,18) - because the page has ONE light source and
// a second shadow colour would give it two.
//
// Straight down, with no x offset, because unlike the fragments the button is not tilted:
// it faces the reader square-on, so its light falls on it square-on.
//
// checkContrast() reads this array and composites it before measuring the two sentences
// that sit under the button, exactly as it already does for the fragments' captions.
const CTA_SHADOW_LAYERS = [
  { x: 0, y: 2, blur: 5, spread: 0, alpha: 0.16 }, // contact: it is resting on the paper
  { x: 0, y: 12, blur: 26, spread: -8, alpha: 0.3 }, // cast: the paper is lit
];
/** Hover lifts it 2px, so the cast lengthens and softens the way a real one does. The
 *  guard measures this one too, because it is the darker of the two states. */
const CTA_SHADOW_HOVER = [
  { x: 0, y: 3, blur: 7, spread: 0, alpha: 0.16 },
  { x: 0, y: 20, blur: 38, spread: -10, alpha: 0.34 },
];
/** Pressed, the object touches the paper and the cast collapses to the contact layer. */
const CTA_SHADOW_PRESS = [{ x: 0, y: 1, blur: 3, spread: 0, alpha: 0.18 }];

/** The gap between the button's bottom edge and the first sentence under it (`.promise`).
 *  16px is the existing margin; it is named here so the guard measures the real one. */
const CTA_PROMISE_GAP = 16;

const shadowCss = (layers, ink) =>
  layers
    .map(
      (l) =>
        `${l.x}px ${l.y}px ${l.blur}px` +
        (l.spread ? ` ${l.spread}px` : "") +
        ` rgba(${ink.join(",")},${l.alpha})`
    )
    .join(", ");

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
  // THE INSET GROWS FROM 20px TO 118px AND THEN STOPS.
  //
  // This was `clamp(20px, 10.93%, 118px)`, which is the campaign's ratio written out
  // literally, and the 20px floor in it never once applied: 10.93% only falls under 20px
  // below a 183px viewport. Measured on the built page, a 320px phone was therefore getting
  // a 35px inset - 70px of a 320px screen, 22% of the display, spent on margin - which is
  // why FRAG_MIN_WIDTH's own comment ("320px viewport, 2x20px inset") disagreed with the
  // browser by 30px, why the lede broke at 32 characters there, and why the button's bottom
  // edge sat 21px off the fold on the smallest phone in the list.
  //
  // So the inset is now the line THROUGH the two points the design actually names: 20px at
  // 320px and 118px at 1080px, held flat above that. 20 + 98 * (vw - 320) / 760 is
  // 12.9vw - 21.26px, and the clamp still pins both ends.
  //
  // It is <= the old value at every width and equal to it from 1080 up (1024px moves by
  // 0.8px, 1080px and wider not at all), so the campaign's composition is untouched
  // everywhere it was ever right and only the phone gets its 30px back.
  x0: "clamp(20px, 12.9vw - 21.26px, 118px)",
  display: "clamp(34px, 8.4vw, 76px)",
  leading: 1.34,
  label: "clamp(11px, 2.41vw, 26px)",
  cta: "clamp(21px, 5.4vw, 44px)",
  wordmark: "clamp(42px, 13.6vw, 148px)",
};

// ---------------------------------------------------------------------------
// THE VERTICAL SCALE, AND WHY IT IS THE HORIZONTAL ONE.
//
// The page's vertical gaps used to be whatever fell out of each section: 22/64 under the
// stage, 12/66 under the plain version, 20/78 under the lockup, 34/60 in the hero, 46
// between fragments. Nine numbers, none of them related to each other or to anything the
// campaign measures, which is how a page ends up with a 428px hole in it and no way to
// argue that the hole is wrong — if every gap is arbitrary, no gap can be too big.
//
// So the vertical rhythm is now the SAME four measurements the campaign already uses
// horizontally, on the same 1080px field, and there are only four:
//
//   G1   26/1080 =  2.41%   the mono step. It is GRID.label exactly — the size of the
//                           furniture type IS the tightest gap on the page, which is not a
//                           coincidence, it is the same measurement used twice. This is the
//                           gap that holds one plate to the next inside the scene, and it is
//                           deliberately SMALLER than a plate's cast shadow reaches (see
//                           FRAG_SHADOW_LAYERS: the cast clears 8.3% of the object's width
//                           below its bottom edge), so a plate's shadow lands on the plate
//                           BELOW it rather than on bare paper. That is the whole depth
//                           argument of the composition and it is a spacing value.
//   G2   40/1080 =  3.70%   the end card's own internal gap (FragEnd.tsx), already used by
//                           .lockup-inner. Block to block inside one composition.
//   G3   62/1080 =  5.74%   the end card's margin. Between the parts of a section.
//   G4  118/1080 = 10.93%   the grid's own inset, GRID.x0's own ceiling. Section to section,
//                           so the page's biggest vertical gap is exactly its horizontal one
//                           and the field reads as square rather than as a tall ribbon.
//
// Each is written the way GRID.x0 is: a vw ratio between a floor and the literal number the
// campaign uses, so a 320px phone gets a proportionate gap rather than the desktop one.
// Nothing on the recomposed page uses a vertical gap that is not one of these four, with a
// single stated exception — the gap between a plate and its caption, which is not rhythm at
// all but shadow geometry (CAPTION_GAP), and is a ratio of the OBJECT rather than of the
// field for the reason its own note gives.
const RHYTHM = {
  g1: "clamp(10px, 2.41vw, 26px)",
  g2: "clamp(16px, 3.70vw, 40px)",
  g3: "clamp(24px, 5.74vw, 62px)",
  g4: "clamp(36px, 10.93vw, 118px)",
};

// THE SCENE'S THREE DEPTHS, in the stage's own perspective.
//
// marketing/video/src/pro/Plane.tsx takes a `z` per plane for exactly this — "extra Z, in
// the stage's perspective, for layers that live at different depths ... what makes a camera
// move produce parallax rather than a zoom" — and the film's own recede is -520 at a 1400px
// perspective (film.ts RECEDE.z), which is 37% of the camera distance. This page's camera is
// 2400px and its objects are furniture rather than a subject being pushed out of frame, so
// the separation is small on purpose: +-46px is 1.9% of the perspective, which projects to
// about +-2% of apparent size. That is under the threshold at which anyone would call it a
// size difference and over the threshold at which the three plates stop looking coplanar.
//
// It is also what makes the scroll parallax below honest rather than decorative: the plates
// really are at three depths, so moving them at three rates is showing the reader something
// true about the composition instead of animating for the sake of it.
const DEPTH = { back: -46, mid: 0, front: 46 };

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
function groundUnder(layers, gap, ink = FRAG_SHADOW_INK, base = GROUND.darkest) {
  // Each layer's shadow rectangle sits `y + spread` below the object's bottom edge
  // (a negative spread pulls the rectangle back up), and its coverage decays over
  // the blur from there. The text's TOP edge is the worst case; every pixel of
  // it below that is further away and lighter.
  let clear = 1;
  for (const l of layers) {
    clear *= 1 - shadowCoverage({ alpha: l.alpha, blur: l.blur, d: gap - (l.y + l.spread) });
  }
  const combined = 1 - clear;
  return { hex: over(ink, combined, base), alpha: combined, gap: +gap.toFixed(1) };
}

/** The ground under a fragment's caption, at an object of width `w`. */
function groundUnderCaption(w) {
  return groundUnder(fragShadowPx(w), captionGapPx(w));
}

/** The ground under the two sentences below the call to action, in whichever of its
 *  three states casts the longest shadow. Same model, same ink, different geometry —
 *  see CTA_SHADOW_LAYERS for why the button's shadow is in px and the fragments' is
 *  not. `extra` is how far below `.promise` a second line sits. */
function groundUnderCta(layers, extra = 0) {
  return groundUnder(layers, CTA_PROMISE_GAP + extra);
}

/** EVERY OBJECT WIDTH THE LAYOUT CAN PRODUCE — a swept range, not a list of samples.
 *
 * This used to be twelve hand-picked numbers, each annotated with the viewport that
 * produced it. That shape of guard rots silently: the numbers are only true until the
 * next time the grid moves, and nothing fails when they stop being true. It had already
 * rotted. Sweeping the built page continuously — every measure from 300 to 1700 CSS px,
 * two at a time, reading `.object`'s painted box — produces widths from 252.7 to 637.0,
 * and of the twelve widths the old list named, the recomposed scene actually draws ONE.
 * Thirty-three real widths were going through a guard that had never seen them, and the
 * floor was set 12px ABOVE the narrowest object the layout can actually draw.
 *
 * So the range is swept instead. The two ends, both measured rather than reasoned:
 *
 *   252.7  the narrowest, at a 300px measure — a 320px phone whose browser reserves a
 *          20px scrollbar. Below the old 265 floor, i.e. previously unchecked.
 *   637.0  the widest, at about 806px of measure. This is the PROJECTED box: DEPTH.front
 *          puts the front plate 46px toward the camera in a 2400px perspective and scales
 *          it — and its cast shadow — by 1.0195, and `getBoundingClientRect` already has
 *          that in it. So the projection needs no separate entry the way it used to.
 *
 * The bounds below carry margin past both measurements and the guard checks every
 * integer between them. They stop well short of ~716px, where `captionGapPx` hits
 * CAPTION_GAP.maxPx, the caption gap stops tracking the shadow that is darkening the
 * ground beneath it, and the pair starts falling — which is what the 640px ceiling in
 * the @container rule exists to prevent. If the layout ever draws an object wider than
 * FRAG_WIDTH_CEIL, widen this range and let the guard tell you whether it still passes,
 * rather than trusting that it does. */
const FRAG_WIDTH_FLOOR = 250;
const FRAG_WIDTH_CEIL = 660;
const FRAG_WIDTHS = Array.from(
  { length: FRAG_WIDTH_CEIL - FRAG_WIDTH_FLOOR + 1 },
  (_, i) => FRAG_WIDTH_FLOOR + i
);

const CONTRAST_PAIRS = [
  { what: "body / caption ink on the ground", fg: INK.type, bg: GROUND.darkest, min: 4.5 },
  { what: "muted ink (eyebrow, captions) on the ground", fg: INK.muted, bg: GROUND.darkest, min: 4.5 },
  { what: "accent word and links on the ground", fg: INK.accent, bg: GROUND.darkest, min: 4.5 },
  { what: "typed email in the field", fg: INK.type, bg: INK.field, min: 4.5 },
  // The last dark element on the page, and therefore the only legal home chartreuse has
  // left on it. It is the skip link, which is off-canvas until a keyboard finds it.
  { what: "chartreuse on the skip link's dark slab", fg: INK.brand, bg: INK.slab, min: 4.5 },
  { what: "ground-coloured type on the dark slab", fg: GROUND.base, bg: INK.slab, min: 4.5 },
  { what: "app text on app surface", fg: APP.text, bg: APP.surface, min: 4.5 },
  { what: "app muted text on app surfaceAlt", fg: APP.textMuted, bg: APP.surfaceAlt, min: 4.5 },
  { what: "overlap amber on app surface", fg: APP.amber, bg: APP.surface, min: 4.5 },
  // The DUO LOCKED label and its two bracket glyphs, which are the app's own volt on the
  // app's own surface. The middle plate is the only place on the page where volt is TYPE
  // rather than a button fill, so it gets the 4.5 that type is held to and not the 3.0 a
  // control's silhouette gets.
  { what: "volt label and brackets on app surface (the DUO LOCKED plate)", fg: APP.volt, bg: APP.surface, min: 4.5 },
  // The film is the page's one large dark object. Its type is burned into the video, so
  // the only pair this page owns is its edge: the frame against the paper.
  { what: "the film's dark ground against the paper (its silhouette)", fg: FILM.ground, bg: GROUND.darkest, min: 3.0 },

  // THE CALL TO ACTION, in all three of its states.
  //
  // Four pairs, not one, because a button is read twice: once as a shape and once as a
  // word. The label pairs are held at 4.5 even though `GRID.cta` is 21px at its smallest
  // (large-text territory, where 3.0 would do) because the label is the sentence the whole
  // page exists to get read and there is no reason to spend the headroom.
  //
  // The SILHOUETTE pairs are the ones that matter here and they are new. WCAG 1.4.11 asks
  // 3.0 of a control's boundary against what is behind it, and this is exactly the number
  // that the off-black slab used to win 17.18:1 without trying. It is the measurement that
  // says whether a softer button is still a button.
  { what: "onVolt label on the volt call to action", fg: APP.onVolt, bg: APP.volt, min: 4.5 },
  { what: "onVolt label on voltDim (hover / press fill)", fg: APP.onVolt, bg: APP.voltDim, min: 4.5 },
  { what: "volt FILL against the ground (the button's silhouette)", fg: APP.volt, bg: GROUND.darkest, min: 3.0 },
  { what: "voltDim FILL against the ground (hover silhouette)", fg: APP.voltDim, bg: GROUND.darkest, min: 3.0 },
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
  const describe = (w) => {
    const g = groundUnderCaption(w);
    const ratio = contrastRatio(INK.muted, g.hex);
    return {
      ratio,
      line:
        `  ${ratio.toFixed(2).padStart(6)}:1  (needs 4.5)  ${INK.muted} on ${g.hex}  ` +
        `object ${String(w).padStart(3)}px, caption gap ${g.gap}px, shadow alpha ${g.alpha.toFixed(3)}`,
    };
  };
  // Every integer width in the range is checked; only the two ends and the worst are
  // printed, because 411 near-identical lines would bury everything else in this report.
  let worst = null;
  let worstW = null;
  for (const w of FRAG_WIDTHS) {
    const { ratio, line } = describe(w);
    if (ratio < 4.5) failures.push(line);
    if (worst === null || ratio < worst) {
      worst = ratio;
      worstW = w;
    }
  }
  console.log(`${describe(FRAG_WIDTH_FLOOR).line}   <- floor`);
  console.log(`${describe(worstW).line}   <- worst`);
  console.log(`${describe(FRAG_WIDTH_CEIL).line}   <- ceiling`);
  console.log(
    `  worst caption pair across all ${FRAG_WIDTHS.length} object widths ` +
      `from ${FRAG_WIDTH_FLOOR} to ${FRAG_WIDTH_CEIL}px: ${worst.toFixed(2)}:1 (at ${worstW}px)`
  );

  // THE SAME CHECK FOR THE CALL TO ACTION'S NEW SHADOW.
  //
  // The button gained a cast shadow to buy back the presence it lost when it stopped being
  // off-black, and directly under that shadow sit the two sentences a visitor reads to
  // decide whether to type an address: `.promise` in ink and `.fineprint` in muted ink.
  // The fragments' captions have already failed this exact check once, at 4.02:1, while a
  // flat-ground model printed a pass — so the button's shadow gets modelled before it
  // ships rather than after.
  //
  // `.fineprint` is the pair that can actually fail: it is the muted ink, which starts at
  // 5.39:1 on clean paper with only 0.89 of headroom. It sits a line lower, so it gets the
  // gap plus one `.promise` line box (15px at 1.5) plus its own 8px margin.
  console.log("\nInk on the ground UNDER the call to action's cast shadow:");
  const CTA_STATES = [
    ["at rest", CTA_SHADOW_LAYERS],
    ["hovered (the longest cast)", CTA_SHADOW_HOVER],
    ["pressed", CTA_SHADOW_PRESS],
  ];
  const CTA_TEXT = [
    [".promise (ink)", INK.type, 0],
    [".fineprint (muted ink)", INK.muted, 15 * 1.5 + 8],
  ];
  for (const [state, layers] of CTA_STATES) {
    for (const [label, fg, extra] of CTA_TEXT) {
      const g = groundUnderCta(layers, extra);
      const ratio = contrastRatio(fg, g.hex);
      const line =
        `  ${ratio.toFixed(2).padStart(6)}:1  (needs 4.5)  ${fg} on ${g.hex}  ` +
        `${label}, button ${state}, gap ${g.gap}px, shadow alpha ${g.alpha.toFixed(3)}`;
      if (ratio < 4.5) failures.push(line);
      else console.log(line);
    }
  }

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
    --app-volt-dim: ${APP.voltDim};
    --app-on-volt: ${APP.onVolt};
    --app-amber: ${APP.amber};
    /* One ground, no scheme swap. See the design-system note in build-site.mjs. */
    color-scheme: light;

    /* ---- MOTION, from two sources and no third -------------------------------
       The four durations are the APP's (apps/mobile/src/theme/tokens.ts:138 —
       motion = { instant: 90, quick: 140, base: 200, deliberate: 260 }), so a control on
       this page reacts on the same clock as the same control inside the app.

       The two arrival numbers are the CAMPAIGN's, converted from frames at 30fps:
       marketing/video/src/pro/motion.ts sets ARRIVAL.frames = 8 (267ms) and
       ARRIVAL.settle = 34 (1133ms). That file is worth reading before touching any of
       this, because it is where the numbers were measured off the reference reels frame
       by frame, and because it names the exact failure this page had: a constant,
       never-animated tilt, which it calls "the entire difference between a 3D move and
       a Dribbble mockup".

       --ease-out is the strong ease-out the animate skill specifies, and it is also, to
       within a rounding error, the quintic-out that ARRIVAL is authored on: the flattest
       standard curve, which is what "arrives already at speed and stops without a bump"
       looks like. --ease-sine-out is the settle's curve. Nothing here is hand-rolled and
       nothing here is a browser default; the built-in easings are too weak. */
    --t-instant: 90ms;
    --t-quick: 140ms;
    --t-base: 200ms;
    --t-deliberate: 260ms;
    --t-arrival: 267ms;
    --t-settle: 1133ms;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-sine-out: cubic-bezier(0.61, 1, 0.88, 1);
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
  /* On the ladder, like every other block gap on this page: G1 above the mark, nothing
     below it, because the hero's own G2 is the gap under the header and two blocks cannot
     both pay for one boundary. It was 22 and 4, which were neither. */
  header.site-header { padding: ${RHYTHM.g1} 0 0; }
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
  /* THE HERO GRID IS THREE NAMED AREAS, AND THE THIRD IS NOW THE WHOLE SCENE.
     The type, the form and the product are separate grid children so the composition can
     be re-cut per viewport SHAPE rather than only per width. On a phone they stack in
     reading order. Same markup, same order in the DOM, three cuts.

     THE SCENE MOVED IN HERE, AND THAT IS WHAT CLOSED THE HOLE. Measured on the deployed
     page at 1400x1000: the left column ran type-then-form from y=96 to y=1023, the right
     column held one object that ended at y=698, and the next heading was at y=1126. Four
     hundred and twenty-eight pixels of the right-hand column were empty, which is the
     "450px of nothing" in the note, and no spacing value fixes it — it is a column that
     runs out, and the only fix is either to fill it or not to have it.

     Both, as it turns out. The product is no longer a column beside the hero; it is the
     hero's own bottom row, full width, with the form promoted into the top row beside the
     type. That composition already existed in this file for short landscape windows,
     where it was written because "stacking is simply the wrong shape for a landscape
     window" — it is now the desktop composition at every height, because putting the form
     at the TOP of its own column rather than at the bottom of 400px of copy is strictly
     better on every desktop shape, not only on short ones. Measured, the fineprint's
     bottom edge went from y=1023 to y=449 at 1400x1000: the whole form was below the fold
     on a 1000px window before this and now the scene starts there instead.

     It also merges what used to be two sections into one, which is the other half of the
     note. The page was all the words, then all the pictures, then all the words again;
     the words and the pictures are now the same section. */
  section.hero { padding: ${RHYTHM.g2} 0 0; }
  .hero-grid {
    display: grid; grid-template-columns: 1fr; gap: 0;
    grid-template-areas: "copy" "act" "scene";
    align-items: start;
  }
  .hero-copy { grid-area: copy; }
  .hero-act { grid-area: act; }
  /* G3, not G4, and the distinction is the whole point of having a ladder. The scene and
     the type-and-form row are two parts of ONE section now, and G3 is the between-the-parts
     step; G4 is reserved for section to section, which is the boundary under the scene. Set
     as a margin on the scene rather than as the grid's row-gap because the grid's other row
     is two columns that end at different heights, and a row-gap would measure from the
     taller of them. */
  .hero-scene { grid-area: scene; margin-top: ${RHYTHM.g3}; }

  /* ---- the form ---------------------------------------------------------- */
  /* THE FORM USED TO BE SQUARE AND IS NOW THE APP'S OWN FORM.
     The old rule was that the campaign's furniture is square (the end card's slab, the
     swipe cue) and only the PRODUCT carries the app's radii, so the form was square and
     the fragments were not. That rule died with the slab: the button below is no longer
     the end card's furniture, it is apps/mobile/src/components/Button.tsx at
     radius.button = 6, so the field above it is TextField at radius.input = 6 — also 6,
     because the app gives its input and its button the same corner. Two controls a
     visitor uses in one motion should not disagree about what shape a control is. */
  form.signup { max-width: 460px; }
  .field-label {
    display: block; font-family: ${MONO}; font-weight: 600; font-size: 11px;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px;
  }
  input[type="email"] {
    width: 100%; display: block;
    background: var(--field); color: var(--ink);
    border: 1.5px solid var(--ink); border-radius: 6px; /* radius.input */
    padding: 15px 16px; font-family: ${SANS}; font-weight: 500; font-size: 17px; line-height: 1.3;
    appearance: none;
    /* Colour only, and it survives prefers-reduced-motion: a border that snaps from ink to
       accent is a state change with no transition on it, which is the one thing a 140ms
       fade genuinely improves. Nothing moves. */
    transition: border-color var(--t-quick) ease;
  }
  input[type="email"]::placeholder { color: var(--muted); opacity: 1; }
  input[type="email"]:hover { border-color: var(--accent); }
  input[type="email"]:focus { outline: 3px solid var(--accent); outline-offset: 2px; border-color: var(--accent); }

  /* 24px, not the browser's 13px default: WCAG 2.5.8 wants a 24x24 target and this
     is the one control between a visitor and the list. The label is the same height
     and is bound to the input, so the whole line is the target. */
  .adult { display: flex; align-items: center; gap: 11px; margin: 16px 0 20px; }
  .adult input[type="checkbox"] {
    flex: none; width: 24px; height: 24px; margin: 0; accent-color: var(--app-volt);
  }
  .adult label { font-size: 15px; line-height: 24px; min-height: 24px; color: var(--ink); cursor: pointer; }

  /* THE CALL TO ACTION — the app's own primary button, on paper.
     apps/mobile/src/components/Button.tsx, variant "primary": colors.volt fills it,
     colors.onVolt writes on it, radius.button rounds it, and pressing it scales it to
     0.97. All four are transcribed rather than chosen. The long version of why it stopped
     being an off-black slab with chartreuse words, and what that cost, is the design-system
     note at the top of build-site.mjs.

     IT IS STILL MEANT TO BE THE LOUDEST THING ON THE FIRST SCREEN, and it lost 17.18:1 of
     silhouette to get there, so four things pay that back and each is deliberate:
       * a cast shadow in the page's own shadow ink, so it is the only lifted piece of
         FURNITURE on the page and reads as an object sitting on the paper rather than as a
         colour printed into it (see CTA_SHADOW_LAYERS, and note that the guard composites
         it before measuring the two sentences underneath);
       * heavier vertical padding than the old slab, 0.42/0.48em against 0.36/0.42em;
       * air above it — the checkbox row's bottom margin, not the button, holds it apart;
       * a deep olive is the only chromatic mass on a neutral warm ground. Off-black had
         more luminance contrast and no colour at all; this has less of the first and all
         of the second, which is the trade Cameron asked for in those words.

     Chartreuse is not here and cannot be: 1.05:1 on this ground is not low contrast, it is
     no silhouette whatsoever. */
  .cta {
    display: block; width: 100%; text-align: center; cursor: pointer;
    background: var(--app-volt); color: var(--app-on-volt);
    border: 1.5px solid var(--app-volt); border-radius: 6px; /* radius.button */
    padding: 0.42em 0.6em 0.48em;
    font-family: ${SANS}; font-weight: 800; font-size: ${GRID.cta}; line-height: 1.3;
    letter-spacing: -0.02em;
    text-decoration: none;
    box-shadow: ${shadowCss(CTA_SHADOW_LAYERS, FRAG_SHADOW_INK)};
    /* Named properties, never 'all'. Colour moves on the app's 'quick', the lift on the
       app's 'base', and the press below drops to the app's 'instant'. */
    transition:
      background-color var(--t-quick) ease,
      border-color var(--t-quick) ease,
      box-shadow var(--t-base) var(--ease-out),
      transform var(--t-base) var(--ease-out);
  }
  /* Gated, because a touch device fires a false :hover on tap and would leave the button
     stuck in its hovered state after the finger lifts. */
  @media (hover: hover) and (pointer: fine) {
    .cta:hover {
      background: var(--app-volt-dim); border-color: var(--app-volt-dim);
      box-shadow: ${shadowCss(CTA_SHADOW_HOVER, FRAG_SHADOW_INK)};
      transform: translate3d(0, -2px, 0);
      text-decoration: none;
    }
  }
  /* The press is the app's own: scale(0.97), and the shadow collapses to its contact layer
     because the object has been pushed down onto the paper. It comes after the hover rule
     on purpose so a pressed button is never also a lifted one, and it is not gated — a
     press is the one piece of feedback a touch device must get. */
  .cta:active {
    background: var(--app-volt-dim); border-color: var(--app-volt-dim);
    box-shadow: ${shadowCss(CTA_SHADOW_PRESS, FRAG_SHADOW_INK)};
    transform: scale(0.97);
    transition-duration: var(--t-instant);
  }

  .promise { font-size: 15px; line-height: 1.5; margin: 16px 0 0; max-width: 44ch; }
  .fineprint { font-size: 13.5px; line-height: 1.55; color: var(--muted); margin: 8px 0 0; max-width: 46ch; }

  /* The honeypot. Off-canvas rather than display:none, because some form-filling
     bots skip anything that is not rendered. tabindex, autocomplete and aria-hidden
     on the input itself keep it away from keyboards and screen readers. */
  .hp { position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }

  /* ---- THE SCENE --------------------------------------------------------- */
  /* WHAT THIS REPLACED, AND WHY IT IS A RECOMPOSITION RATHER THAN A SPACING PASS.
     The page used to have a section called the STAGE whose pattern was: object in a
     frame, mono caption underneath, repeat. Cameron's note on the deployed version was
     that it looked "isolated and random, all the blocks", and the diagnosis he wrote is
     the correct one: that pattern produces isolated cells BY CONSTRUCTION. Nothing in an
     arrangement of independent cells relates one cell to the next, so no amount of
     spacing tuning makes them cohere. Two objects sat in it at desktop, one of them
     hoisted into the hero, at different widths and different alignments with no shared
     edge, and a heading promising a tour was followed by a single message composer.

     WHAT IS HERE INSTEAD IS ONE OBJECT. Not three pictures on a wall — one card, sliced
     into three plates and pulled apart in Z. The composition is transcribed from the two
     places the campaign already solved this, and both were re-read before it was built:

       out/_static/feed-light.png — the badge and the card share a centre axis, are within
       a percent of each other in width, sit a fraction of their own height apart, and the
       upper one's cast shadow lands ON the lower one. That is the whole trick and it does
       NOT involve occluding anything: the shadow is what says which of the two is in
       front. The reference does not overlap its objects and neither does this.

       out/_directions/pro-a-light.mp4 f300 and f9 — two planes, two velocities, one
       camera (src/pro/film.ts states it in those words). The far plane is not a peer, it
       is receded: pushed back in Z, defocused and washed toward the paper, so it becomes
       ground for the near one. src/pro/Plane.tsx's z prop and film.ts's RECEDE are the
       two mechanisms, and both are ported here — z as DEPTH, recede as the hover veil.

     SO THE SCENE IS: three plates, ONE shared left edge (the page's own x0 — ground.ts's
     first rule and the thing that stops several differently shaped objects reading as
     several unrelated slides), ONE shared width, three depths, and a gap between them of
     RHYTHM.g1, which is smaller than the cast shadow reaches. Each plate's shadow
     therefore falls on the plate below it. They read as one stack of glass on a table
     rather than as three cards in three frames, and the depth is provable rather than
     asserted: it is in the shadows at rest and in the parallax on scroll.

     AND THE COPY IS INSIDE IT, not in a zone above or below it. Once the scene is wide
     enough to hold two columns (a container query, so it keys on the scene's own measure
     rather than on the window's), each plate's sentence sits BESIDE it, vertically
     centred on that plate's band. Type and object share a horizontal line instead of
     stacking into a cell, which is the other half of the note: the page was "all the
     words, then all the pictures, then all the words again". */
  .scene {
    /* Named, so the beats below can query the SCENE's measure. The scene is the hero's
       full-width bottom row on a desktop and a phone-width column on a handset, and what
       decides whether a sentence fits beside a plate is that measure, never the window's:
       the same 760px of scene is the same composition at any viewport that produces it. */
    container-type: inline-size;
    container-name: scene;
  }
  /* G2 under the head against G3 above it: the eyebrow belongs to the stack, so the gap
     that binds it there has to be smaller than the gap that separates it from the form. */
  .scene > .eyebrow { margin: 0 0 ${RHYTHM.g2}; }
  /* ONE RULE, TWO CONSEQUENCES: THE GAP UNDER A PLATE IS ALWAYS SHADOW GEOMETRY.
     A plate's cast layer clears about 8.3% of its width below its bottom edge before it
     fades. What sits in that band decides the gap, and there are only two possibilities:

       TYPE sits there in the stacked cut, so the gap is CAPTION_GAP — the same ratio, for
       the same reason, as the gap that used to sit under every fragment on the old page.
       It keeps the next sentence out of the cast, which is a measured WCAG AA requirement
       and not a rhythm value (see the shadow model in checkContrast()).

       ANOTHER PLATE sits there in the two-column cut, because the sentences have moved out
       of the column. Nothing needs protecting from the shadow any more, so the gap drops
       to RHYTHM.g1 and the shadow lands on the plate below — which is the depth cue
       feed-light.png uses, and the reason the stack reads as one object.

     Written as a cqi of the SCENE rather than of the plate because .stack is not the
     plate's query container; in the stacked cut the two are within a few percent of each
     other, and where they differ the scene is the wider, so the gap errs long. */
  .stack {
    display: flex; flex-direction: column;
    gap: 22px;
    gap: clamp(${CAPTION_GAP.minPx}px, ${CAPTION_GAP_CQW}cqi, ${CAPTION_GAP.maxPx}px);
  }

  /* THE BEAT: one plate and the sentence that names it.
     THE SENTENCE COMES FIRST, in the DOM and, in the stacked cut, on the page. Under the
     plate it was 22px from the plate above it and 10px from the plate below it on a phone
     — bound by proximity to the wrong object, which is the one thing a caption cannot be.
     Above the plate, the small gap is the one INSIDE a beat and the large gap is the one
     BETWEEN beats, so proximity and meaning agree; and the gap that has to clear the cast
     shadow becomes the between-beats gap, which is the one that wanted to be large anyway.
     The two constraints stopped fighting when the caption moved. */
  .beat { display: grid; grid-template-columns: minmax(0, 1fr); row-gap: ${RHYTHM.g1}; }

  /* THE PLATE'S FRAME, and it carries the camera — which is a correction, not a move.
     perspective reaches an element's DIRECT CHILDREN only. It used to sit on the
     fragments grid with the tilted .object two levels down, so it never applied: measured
     on the built page with a translateZ(600px) probe, a grandchild of the perspective
     element came back 216.74px before and 216.74px after, i.e. no foreshortening at all,
     while the hero's object — whose .hero-aside carries the perspective and whose .object
     is its direct child — went 200px to 266.67px, exactly 2400/(2400-600). So the stage's
     "REAL 3D" was an affine shear, and .object > * { translateZ(14px) } was a no-op.
     The perspective is on the plate's own frame now, which is the same construction
     .hero-aside already used and the one that measurably works.

     ONE CAMERA ANGLE, THREE CAMERA POSITIONS, and the trade is stated rather than hidden.
     A single shared 3D rendering context would need transform-style: preserve-3d on every
     element between the perspective and the plate, and layout containment forces
     transform-style to flat — which container-type: inline-size implies, and which the
     container-query shadow below cannot do without. So each plate is projected by its own
     camera at the same distance and the same origin. What that costs is inter-plate
     parallax at rest; what it keeps is that all three are seen at the same angle from the
     same height, which is the part that makes them read as one view. The parallax the
     composition does claim is the scroll one, and that is real.

     perspective-origin sits on the LEFT EDGE rather than at the centre, and that is what
     protects the shared edge: a plate pushed +46px toward the camera grows about 2%, and
     centred that would push its left edge 6px past x0 while its neighbours stayed put —
     three left edges instead of one, which is the exact failure ground.ts's MEASURE note
     warns about. Anchored at 0%, the depth expresses itself entirely on the right edge and
     in height, so the stack fans open toward the air rather than into the type. */
  .plate-box {
    container-type: inline-size;
    perspective: ${TILT.perspective};
    perspective-origin: 0% 50%;
    /* --pm is set once on .stack so every plate is the same width. One shared edge on the
       left (the page's x0) and one shared edge on the right is what makes three plates
       read as three slices of one card rather than as three objects. */
    width: 100%;
    max-width: var(--pm, 640px);
  }
  .object {
    transform-origin: ${TILT.origin};
    /* THE DEPTH IS IN THE TRANSFORM, not in three hand-tuned sizes. --z is DEPTH.back /
       .mid / .front, set per beat; at a 2400px perspective it projects to about -2% / 0 /
       +2% of apparent size, which is why the plates do not need three different widths to
       stop looking coplanar. Defaults to 0 so an object outside the scene is unaffected. */
    transform: translateZ(var(--z, 0px)) ${TILT.transform};
    /* REAL 3D, not a picture of it. preserve-3d puts the card's CONTENTS on their own
       plane (see .object > * below) instead of flattening them into the card's face, so
       the 7deg rotation projects the chip and the card edge by different amounts and the
       object has a measurable thickness. It is the cheapest genuinely three-dimensional
       thing on this page and it costs one declaration and no motion at all. */
    transform-style: preserve-3d;
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
  .object > * {
    width: 100%;
    /* 14px forward of the card face, under a 2400px perspective: about 0.6% of parallax,
       which is small on purpose. The point is not that you see the offset, it is that the
       object stops being a flat rectangle with a picture of a tilt printed on it. This is
       the declaration that was inert until the perspective moved onto .plate-box. */
    transform: translateZ(14px);
  }

  /* THE TILT ANSWERS THE POINTER.
     motion.ts's whole complaint about a fixed tilt is that it never changes. Here it does:
     the object comes 26px forward and turns 40% of the way back toward square-on, which is
     what happens to a card when you pick it up to look at it. Under the 2400px perspective
     the translateZ scales the whole object — its cast shadow included — by 1.1%, so the
     shadow grows with the lift rather than being animated separately.

     IT IS ONLY THE TRANSFORM, and that is a measurement rather than a preference. The first
     version also grew the cast shadow 1.5x on hover, which is the obvious way to say
     "lifted"; composited through the same shadow model the contrast guard uses, it took the
     mono caption directly beneath the object from 4.83:1 to about 4.4:1 — under WCAG AA,
     on hover, on the line that explains what the object is. A 1.15x version came out near
     4.6:1, which is inside the model's own error bars. So the shadow does not move, and the
     reason is written down rather than rediscovered. */
  @media (hover: hover) and (pointer: fine) {
    .plate-box .object { transition: transform var(--t-deliberate) var(--ease-out); }
    .beat:hover .object {
      transform: translateZ(calc(var(--z, 0px) + 26px)) rotateY(${+(TILT.rotY * 0.6).toFixed(2)}deg) rotateX(${+(TILT.rotX * 0.6).toFixed(2)}deg);
    }

    /* THE OTHER TWO PLATES RECEDE, which is the campaign's own law rather than a flourish.
       marketing/video/src/pro/film.ts states it as the rule that decides what is on the
       frame at any instant: there is ONE peer element, and when something else becomes the
       subject the rest "pushes back in Z, drops to 30% and takes a soft blur" (RECEDE).
       Picking up one plate makes it the subject, so the other two stop being peers.

       IT IS OPACITY ONLY, AT 0.86, AND NOT THE FILM'S NUMBERS. The film recedes to 0 with
       a 7px blur because its receded plane has a whole statement built in front of it and
       must stop competing. Here the two receded plates are still the reader's context, and
       a blur on a card whose type is 11px of mono reads as a rendering fault rather than
       as depth. 0.86 on a white plate over warm paper is a wash toward the ground of about
       one shadow layer's worth — enough to rank the three, not enough to hide one.

       It is also the only :has() on the page. Without it the rule would have to live on
       .stack:hover, which fires in the gaps between plates where nothing is the subject. */
    .stack:has(.beat:hover) .beat:not(:hover) .object { opacity: 0.86; }
    .plate-box .object { transition: transform var(--t-deliberate) var(--ease-out), opacity var(--t-deliberate) ease; }
  }
  /* THE SENTENCE THAT NAMES A PLATE. The campaign's mono furniture, unchanged.
     Sized against the SCENE rather than the plate, because in the two-column cut it does
     not live in the plate's container at all and a caption that changed size between the
     two cuts would be two different pieces of furniture. 48ch stops it running the full
     measure of a wide one-column scene, where an 829px line of tracked uppercase mono is
     one long ribbon rather than a label. */
  .beat-line {
    font-family: ${MONO}; font-weight: 600; letter-spacing: 0.14em;
    font-size: 11.5px;
    font-size: clamp(11.5px, 1.9cqi, 15px);
    text-transform: uppercase; color: var(--muted);
    margin: 0; max-width: 48ch;
  }
  /* THE INDEX, and it is doing two jobs rather than decorating.
     The scene's head and its three captions are the same mono furniture at the same size
     in the same ink, and on a phone the head sits 24px above the first caption: measured on
     the built page, they read as one block of two lines rather than as a title and a label.
     The index separates them at a glance, and it says the true thing about the scene, which
     is that it is a SEQUENCE — match, lock, talk, in that order, which is the app's own loop
     and the sentence the hero's sub already writes. apps/mobile/src/theme/tokens.ts calls
     this style out by name: type.tick is the app's own face for "timestamps, statuses,
     counters, index marks". Ink rather than accent, because the page's accent is spent on
     one word in the headline and a number is not the second most important thing on it. */
  .beat-line .no { color: var(--ink); margin-right: 0.85em; }

  /* THE SECOND CUT: THE SENTENCE MOVES BESIDE THE PLATE.
     Keyed on the SCENE's own measure rather than the window's, because what decides this
     is whether there is room for a second column next to a plate — and the scene is a
     full-width row on a desktop, a phone-width column on a handset, and the same 760px is
     the same answer in both. Below the threshold the beat stays stacked; the fallback for
     a browser without container queries is therefore the correct phone layout, not a
     broken desktop one.

     THIS IS THE INTERLEAVE. Above 760px each sentence sits on its plate's own horizontal
     band, so a line of type and an object share a line instead of alternating in blocks.
     It is what stops the page being all the words, then all the pictures, then all the
     words again, and it is the composition pro-a-light.mp4 uses at f440, where the Send
     fragment and the words "send a message," occupy the same band of the frame.

     ONE CEILING OF 640, IN BOTH CUTS, AND IT IS THE GUARD'S NUMBER MINUS THE DEPTH. The
     front plate is 2% larger than its box under the perspective, so 640 * 1.0195 = 652
     keeps the widest thing this layout can draw inside 660 — the widest width the contrast
     guard has ever measured, and the width above which the caption gap stops tracking the
     cast shadow. It used to be 660 flat, which was the ceiling before the plates had depth.

     THE PLATE MEASURE IS THE SCENE MINUS A FIXED CAPTION COLUMN, not a percentage of it,
     and that is what stops the product SHRINKING when the layout gains a column. A
     percentage split means the plate is smaller in two columns than it was in one at the
     same width — measured, 64cqi took a 787px scene's 640px plate down to 504px the moment
     the second column appeared, which is precisely the "the product gets smaller as the
     screen gets bigger" fault the wide-screen block below exists to prevent. Reserving
     330px (62 of gap plus a 268px sentence column) instead means the plate is 640 at every
     scene wide enough to hold two columns, and the second column takes the growth.

     The 900px threshold is then not a taste: it is where 100cqi - 330 first exceeds 570,
     which is the narrowest plate worth trading a column for. Below it the beat stacks, and
     that is also the fallback a browser without container queries gets — the correct phone
     layout, never a broken desktop one. */
  @container scene (min-width: 900px) {
    .stack {
      --pm: min(640px, calc(100cqi - 330px));
      gap: ${RHYTHM.g1};
    }
    /* Placed rather than ordered, so the DOM keeps the sentence before the object it names
       and the page keeps the object on the grid's own left edge. */
    .beat {
      grid-template-columns: minmax(0, var(--pm)) minmax(0, 1fr);
      column-gap: ${RHYTHM.g3};
      align-items: center;
    }
    .beat > .plate-box { grid-area: 1 / 1; }
    .beat > .beat-line { grid-area: 1 / 2; }
    .beat-line { max-width: 34ch; }
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

  /* THE MIDDLE BEAT, from app/match/[matchId].tsx — the celebration screen.
     It is the one moment the whole app exists to produce and the page did not have it:
     the two plates that were here read "you match on what you play" and "then you talk",
     which is a sentence with its verb missing. Its strings and its type are the screen's
     own: the label is type.label overridden to 16/22 at letterSpacing 3 (0.1875em) in
     colors.volt, and the line under it is type.body — 15/22, medium — with the screen's
     own fallback name, because a fragment on this site never carries a real person.

     THE BRACKETS ARE A CROP DECISION AND THEY ARE THE ONLY ONE HERE. In the app the two
     volt glyphs spring together around a 160px avatar at BRACKET_SIZE 64 — 0.4 of it —
     and hug it by 10px. This fragment has no photograph, for the reason the FRAGMENTS
     note gives, so they close around the words instead at the same 0.4 ratio to the
     lockup they hug. Nothing else about them changes: same glyphs, same volt, same
     proportion. They are what makes this beat recognisable as the match screen rather
     than as a green line of text, and they are the app's own mark for the moment. */
  .duo {
    display: flex; align-items: center; justify-content: center;
    gap: 0.62em;
    font-size: clamp(15px, 4.4vw, 27px);
    font-size: clamp(15px, 5.6cqw, 34px);
    padding: 0.3em 0;
  }
  .duo .bracket {
    flex: none; font-family: ${MONO}; font-weight: 600;
    font-size: 2.35em; line-height: 0.74; color: var(--app-volt);
  }
  .duo .said { text-align: center; }
  .duo .lock {
    font-family: ${MONO}; font-weight: 600; font-size: 0.94em;
    letter-spacing: 0.1875em; text-indent: 0.1875em;
    text-transform: uppercase; color: var(--app-volt);
    margin: 0 0 0.3em; line-height: 1.375; white-space: nowrap;
  }
  .duo .both {
    font-size: 0.88em; line-height: 1.467; color: var(--app-text); margin: 0;
  }

  /* ---- the plain version ------------------------------------------------- */
  /* G4 above and below, which is the page's one section-to-section gap. It used to be
     12px above and 66px below — a value that said the plain version belonged to the stage
     above it, which it does not. */
  section.plain { padding: ${RHYTHM.g4} 0; }
  .plain-list { display: grid; grid-template-columns: 1fr; gap: ${RHYTHM.g2}; margin: 0; padding: 0; list-style: none; }
  .plain-list li { border-top: 1px solid var(--rule); padding-top: ${RHYTHM.g1}; }
  .plain-list h3 {
    font-family: ${SANS}; font-weight: 800; font-size: 20px; letter-spacing: -0.02em;
    margin: 0 0 6px; color: var(--ink);
  }
  .plain-list p { margin: 0; color: var(--muted); font-size: 15.5px; line-height: 1.55; max-width: 42ch; }

  /* ---- the closing lockup ------------------------------------------------ */
  /* The campaign's end card, standing still. Proportions are FragEnd.tsx's, taken
     as ratios of the 1080 field: mark 250, wordmark 152 at +2% tracking, 40px gaps,
     the slab 26 below at 22x42 padding, the URL 44 in mono at +12% tracking. */
  /* Zero above, G4 below. The plain version's own G4 is the gap between them: two
     sections cannot each pay for the same boundary, and the old 66 + 20 was 86px of
     nothing that belonged to neither. */
  section.lockup { padding: 0 0 ${RHYTHM.g4}; text-align: center; }
  /* Only the root page carries a support block after the end card, and two sections cannot
     each pay for the same boundary — the lockup's own G4 is it. This is the same rule the
     hero's zero bottom padding follows; it is stated twice because it was broken twice. */
  section.lockup + section.plain { padding-top: 0; }
  /* The lockup breaks the page's own grid, exactly as the end card breaks the
     campaign's: the wordmark is the widest element in the frame, running to about
     88.5% of the field where every other element stops at the 10.93% inset. So this
     one section gets the end card's own margin (62/1080 = 5.7%) instead. */
  .lockup .wrap {
    padding-left: clamp(12px, 5.7%, 62px); padding-right: clamp(12px, 5.7%, 62px);
    /* Makes this the query container the two lines below measure themselves against. The
       wordmark is set in nowrap Unbounded, so it is the one element on the page that can
       physically not fit; sizing it against its OWN container instead of against the
       viewport is what makes that impossible at any width, including a widened one. */
    container-type: inline-size;
  }
  /* Already RHYTHM.g2 to the digit — the end card's own 40/1080 gap is where g2 came
     from, so this line is now the token rather than a copy of it. */
  .lockup-inner { display: flex; flex-direction: column; align-items: center; gap: ${RHYTHM.g2}; }
  /* The end card draws the mark at 250 on a 1080 field, but its SVG is cropped tight
     to the rings and this one carries the app icon's full 1024 canvas, whose ink
     occupies 83.1% of it. So the box is scaled by 1/0.831 to put the same amount of
     ink on the page: measured, the mark is then 26% of the wordmark's width, which is
     what 06-the-waitlist.png measures (248 / 956). */
  /* vw first for anything without container query units, cqi second - the same
     fallback-then-override pattern the fragments' shadow uses. 29.2cqi is 2.028x the
     wordmark's size below, which is the ratio 27.7vw and 13.6vw had between them, so the
     mark and the wordmark keep the proportion 06-the-waitlist.png measures. The 96px floor
     is the old 101px one, adjusted for the container being narrower than the viewport. */
  /* THE MARK'S EMPTY BAND IS CANCELLED, WHICH IS WHY THE END CARD USED TO HAVE A HOLE IN IT.
     Measured with getBBox() on the built page: the rings' ink occupies y 297 to 749 of the
     1024 canvas, so 29.00% of the box is transparent above the ink and 26.86% below it. At
     the 286px the mark draws on a 1400px window that is 83px of nothing over it and 77px
     under it, on top of the 40px flex gap and the 118px section gap. Measured, the gap
     between the plain version's last line and the first pixel of the mark was 222px where
     the rhythm says 118, and the gap between the mark and the wordmark was 113px where it
     says 40. Two of the three "holes" in the close were this one graphic's own padding.

     The negative margins are the measured bands exactly, so every gap in the end card is
     now INK to ink. That is also what FragEnd.tsx's own 40 is: its SVG is cropped tight to
     the rings, so the campaign's number was always ink-to-ink and this is the first version
     of the page that reproduces it rather than adding a transparent border to it.

     They are calc() of the mark's own width rather than percentages because a percentage
     margin resolves against the CONTAINING BLOCK's inline size, not the element's: the old
     -2% was -21.1px of the lockup's 1055px measure, which is not any fraction of the mark.
     --mark-w is therefore declared once and used three times. */
  .lockup .brand-mark {
    --mark-w: clamp(101px, 27.7vw, 300px);
    width: var(--mark-w); height: auto;
    margin-top: calc(var(--mark-w) * -0.29);
    margin-bottom: calc(var(--mark-w) * -0.2686);
  }
  .lockup .brand-mark { --mark-w: clamp(96px, 29.2cqi, 406px); }
  /* 6.38em is the measured advance of "duoqueue" in Unbounded 700 at +2% tracking,
     so 13.6vw lands the wordmark at ~87% of the viewport, which is where the end
     card puts it (measured 956/1080 on 06-the-waitlist.png). */
  /* MEASURED, then held as a ratio of the container rather than of the window.
     "duoqueue" in Unbounded 700 at +2% tracking advances 6.385em - measured on the built
     page at 945px wide on a 148px face, not estimated - so a face at 14.4% of the lockup's
     measure fills 92% of it and leaves 8% of insurance against a fallback face being
     wider. That is what stops a nowrap wordmark from ever overflowing, which matters more
     here than anywhere else on the page: body has overflow-x:hidden, so an overflowing
     wordmark would not scroll, it would be silently sliced.
     The vw line is the fallback and it is the old behaviour exactly; the cqi line is what
     any current browser takes, and it is the one that keeps growing past 1088px of
     viewport, where the old clamp stopped and the end card started shrinking relative to
     the screen it was on. */
  .wordmark {
    font-family: ${DISPLAY}; font-weight: 700; font-size: ${GRID.wordmark};
    line-height: 1.16; letter-spacing: 0.02em; color: var(--ink); white-space: nowrap;
  }
  .wordmark { font-size: min(14.4cqi, 200px); }
  /* The end card sets its call to action at 68 on a 1080 field (6.3%) with 22x42 of
     padding, which is a much larger slab than the hero's in-form button. Same element,
     two jobs: in the form it is a control sized to the field above it, and here it is
     the campaign's closing frame. */
  .lockup .cta {
    display: inline-block; width: auto; margin-top: 2px;
    font-size: clamp(24px, 6.3vw, 76px); padding: 0.38em 0.62em 0.44em;
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
  footer.site-footer { border-top: 1px solid var(--rule); padding: ${RHYTHM.g1} 0 ${RHYTHM.g3}; color: var(--muted); font-size: 13.5px; }
  footer.site-footer nav { margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; }
  footer.site-footer a { color: var(--muted); }
  footer.site-footer a:hover { color: var(--accent); }

  /* =======================================================================
     MOTION
     =======================================================================

     WHAT THIS IS FOR. A visitor lands here from an eighteen-second film in which nothing
     ever fades: type builds forward out of the page, and objects arrive rotated and
     oversized under blur and unwind. The page's first frame should be the film's next
     frame. That is the only argument any of the motion below is making, and where an
     element could not make it, it does not move.

     THE THINGS THAT DELIBERATELY DO NOT ANIMATE, because "should this animate at all" has
     a real answer and here it is no, three times:
       * THE HEADLINE DOES NOT BUILD WORD BY WORD. The film does, and motion.ts measures
         the cadence at 4 to 5 frames a word. The film builds words because it owns
         eighteen seconds of linear time the viewer cannot skip; a landing page's headline
         is the one sentence the visitor came to read, and staggering it delays exactly
         that. It arrives as one object.
       * THE GROUND DOES NOT MOVE. No drifting gradient, no parallax field. It is the one
         thing the campaign holds absolutely constant across every deliverable, and a
         full-viewport moving background is on the short list of things that reliably
         provoke motion sickness.
       * THE PLAIN VERSION DOES NOT REVEAL ON SCROLL. It is three paragraphs about 18+,
         platonic, and everyone starting together. The whole point of that block is that
         it is plain.

     THE RULE THAT MAKES ALL OF IT SAFE: every animation below is fill-mode BACKWARDS, and
     every to-state is identical to the element's resting style. So the resting style is
     the truth and the animation is a displacement in front of it, which means an element
     that is never animated - reduced motion, an older browser, a scroll timeline that
     never runs - renders correct and complete. Nothing on this page is hidden by a base
     rule waiting for an animation to reveal it. */

  /* Type, and blocks of it. The film spends a word's travel on Z rather than Y: "the word
     comes FORWARD out of the page, which is what a scale from 0.35 under a blur reads as,
     where a vertical lift reads as a slide-up preset". Same axis here at a page-sized
     amplitude - 70px of Z under a 900px perspective is a 7% approach - plus 10px of lift. */
  @keyframes rise {
    from { opacity: 0; transform: perspective(900px) translate3d(0, 10px, -70px); }
    to   { opacity: 1; transform: perspective(900px) translate3d(0, 0, 0); }
  }

  /* THE ARRIVAL, exactly as motion.ts measures it, spliced to its own settle.
     Two curves in one animation: quintic-out for the eight frames of arrival, sine-out for
     the thirty-four frames of contraction after it. The timing functions are written into
     the keyframes because each one governs the segment that STARTS at that keyframe, which
     is also why the animation itself is declared linear - the curves are per-segment. */
  @keyframes arrive {
    0% {
      opacity: 0;
      transform: ${arrivalPose(1, ARRIVAL.scale)};
      filter: blur(${ARRIVAL.blur}px);
      animation-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
    }
    ${AT_IGNITE}% { opacity: 1; }
    ${AT_LANDED}% {
      opacity: 1;
      transform: ${arrivalPose(0, ARRIVAL.landed)};
      filter: blur(0);
      animation-timing-function: cubic-bezier(0.61, 1, 0.88, 1);
    }
    100% { opacity: 1; transform: ${arrivalPose(0, 1)}; filter: blur(0); }
  }

  /* The scroll-driven version of the same arrival, and the one deviation from the film in
     this whole block: NO BLUR. The film's blur is a smear across a cut, resolved in eight
     frames by a projector the viewer does not control. A scroll timeline is scrubbed by
     the reader's own finger, and a blur the reader can hold half-resolved is not a smear,
     it is a page that has failed to load. The rotation, the overshoot and the Z survive
     being scrubbed, so those are the parts that are here. */
  /* IT ENDS AT IDENTITY, AND THAT IS NOT A STYLE CHOICE.
     This one is applied to .plate-box, the GROUP, while the resting tilt lives on .object,
     the child inside it. So its to-state has to be the group's own resting transform, which
     is nothing at all. Written the way the hero's arrive is written - landing on the tilt -
     it composes with the child and the object finishes the scroll at 14deg instead of 7,
     then snaps back to 7 the moment the animation range ends. The arrival delta is
     therefore stated bare here and lands on top of the child's tilt on the way in, which is
     how it reaches the campaign's measured 25deg at the start without stating it twice. */
  @keyframes enter {
    from {
      opacity: 0;
      transform: rotateY(${ARRIVAL.rotY}deg) rotateX(${ARRIVAL.rotX}deg) rotateZ(${ARRIVAL.rotZ}deg) scale(${ARRIVAL.landed});
    }
    to { opacity: 1; transform: none; }
  }

  /* THE PARALLAX, AND WHY IT IS A SEPARATE ANIMATION FROM THE ARRIVAL.
     Two things move the plates and they are on two different timelines: the arrival is
     scrubbed over the plate's ENTRY, the drift over its whole passage across the window
     (cover 0% to 100%). Composing them as one keyframe set is impossible; running them as
     two animations on one element is what the comma-separated animation-* lists are for.

     It writes the translate PROPERTY rather than a transform function, so it composes
     with .plate-box's enter transform instead of overwriting it. Independent transform
     properties apply outside transform, which is also the right order here: the drift is
     the camera moving, the tilt is the object.

     THE AMPLITUDES ARE THE DEPTHS, NOT A TASTE. --par is +1 for the back plate, 0 for the
     middle and -1 for the front, and the travel is 12px each way. A nearer object moves
     further against a moving camera; that is the whole content of the word parallax, and
     it is the only reason this is on the page. 24px of relative separation between the
     front and back plates over a full screen of scroll is under the perception threshold
     as motion and over it as depth: what a reader actually notices is the top plate's cast
     shadow sliding across the plate below it, which is the composition explaining itself.

     12 IS HALF OF RHYTHM.g1's CEILING, and that is the bound rather than the preference.
     The plates sit 26px apart in the two-column cut; a drift of half that means the gap
     can close to 14px and open to 38px and never leave the band where one plate's cast
     shadow lands on the next, which is the relationship the whole composition rests on. In
     the stacked cut the gap is CAPTION_GAP, never below 22px, so the bound holds there
     too. */
  @keyframes drift {
    from { translate: 0 calc(var(--par, 0) * 12px); }
    to   { translate: 0 calc(var(--par, 0) * -12px); }
  }

  /* ---- the hero, on load ------------------------------------------------- */
  /* 60ms between blocks. The film's own cadence is 4.5 frames, 150ms, which is right for
     four words of a headline arriving one at a time and far too slow for five stacked
     blocks: it would put the button 750ms behind the eyebrow. 60ms is inside the 30-80ms
     a group entrance is allowed, and the whole hero has landed 507ms after first paint.
     The button is usable for every one of those milliseconds - an element at opacity 0
     still takes the pointer, and nothing here is display:none or visibility:hidden. */
  .hero-copy .eyebrow,
  .hero-copy h1.display,
  .hero-copy .lede,
  .hero-copy .sub,
  .hero-act {
    animation: rise var(--t-arrival) var(--ease-out) backwards;
  }
  .hero-copy h1.display { animation-delay: 60ms; }
  .hero-copy .lede      { animation-delay: 120ms; }
  .hero-copy .sub       { animation-delay: 180ms; }
  .hero-act             { animation-delay: 240ms; }
  /* THE SCENE IS NOT ON THIS TIMELINE ANY MORE, even though it is now inside the hero.
     It used to be, because a single object sat in the hero's right column and was on the
     first screen at desktop. The scene is the hero's bottom row now: at 1400x1000 its
     first plate starts at y=568 and its last is 900px below the fold, so firing all three
     on load would spend the whole assembly on a reader who cannot see two thirds of it.
     It is scroll-driven, with the rest of the scene, below. */

  /* ---- the stage and the close, on scroll -------------------------------- */
  /* SCROLL-DRIVEN, NATIVELY, WITH NO SCRIPT. animation-timeline: view() ties an
     animation's progress to the element's own passage through the viewport. There is no
     IntersectionObserver here because there is no JavaScript on this site at all, and the
     privacy policy published at /privacy/ says so in those words.

     PROGRESSIVE ENHANCEMENT, ENFORCED TWO WAYS. The @supports gate asks for the timeline
     AND for animation-range, because a browser that parses the range keywords is one that
     shipped the whole feature rather than half of it. Without both, no animation property
     is set at all and the stage renders at rest, which is correct and complete.

     The range starts at entry 0% - the instant any part of the object crosses the bottom
     edge - and finishes at entry 65%, long before the reader is reading it. That is
     deliberate: a scroll timeline is scrubbed rather than fired, so an element can only
     sit in its from-state while it is entirely off screen. There is no scroll position at
     which this can leave a visible fragment invisible, which is the failure mode that
     would matter on a page whose product is the thing being revealed.

     THE ASSEMBLY IS ORDERED WITHIN A BEAT AS WELL AS BETWEEN THEM, which is the difference
     between a stagger and a considered arrival. The SENTENCE lands first, over entry 0-58%,
     and the plate it names arrives 8% of scroll space behind it over 8-70%. That order is
     the beat's own: the line is above the plate in the stacked cut and it is the first
     thing a reader meets, so a label that appeared after the object it labels would be
     arriving into a question that had already been answered. Between beats the offsets are
     6% of scroll space rather than milliseconds, because on this timeline there is no clock
     — the reader's own scroll rate sets the cadence, and a fast flick therefore produces a
     fast assembly rather than three plates queueing up behind a fixed delay. */
  @supports (animation-timeline: view()) and (animation-range: entry) {
    /* The scene's own head opens the assembly. It is the one eyebrow on the page that
       moves: the plain version's deliberately does not (see the note above), because that
       block's whole argument is that it is plain, while this one is the first beat of a
       composition that is being assembled in front of the reader. */
    .scene > .eyebrow {
      animation-name: rise;
      animation-fill-mode: backwards;
      animation-timing-function: var(--ease-out);
      animation-timeline: view();
      animation-range: entry 0% entry 50%;
    }
    .scene .beat-line {
      animation-name: rise;
      animation-fill-mode: backwards;
      animation-timing-function: var(--ease-out);
      animation-timeline: view();
      animation-range: entry 0% entry 58%;
    }
    .scene .beat:nth-child(2) .beat-line  { animation-range: entry 6% entry 64%; }
    .scene .beat:nth-child(3) .beat-line  { animation-range: entry 12% entry 70%; }

    /* THE PARALLAX RIDES ON TOP OF THE ARRIVAL, on its own range and its own curve.
       Linear, because a parallax that eases is a parallax that lies about where the camera
       is; cover 0% to 100%, because it is a property of the plate's whole passage
       across the window rather than of its entrance. The two animations are listed
       together here so the shorthand does not clobber the block above. */
    .scene .plate-box {
      animation-name: enter, drift;
      animation-fill-mode: backwards, both;
      animation-timing-function: var(--ease-out), linear;
      animation-timeline: view(), view();
      animation-range: entry 8% entry 70%, cover 0% cover 100%;
    }
    .scene .beat:nth-child(2) .plate-box { animation-range: entry 14% entry 76%, cover 0% cover 100%; }
    .scene .beat:nth-child(3) .plate-box { animation-range: entry 20% entry 82%, cover 0% cover 100%; }

    /* The end card. Same law as the hero's type, spent once at the close, which is where
       the campaign spends its own: the mark, the wordmark, the button and the URL arrive
       the way the film's last frame does. Each carries its own view() timeline, so they
       arrive in the order they are stacked without a single hand-typed delay. */
    .lockup-inner > * {
      animation-name: rise;
      animation-fill-mode: backwards;
      animation-timing-function: var(--ease-out);
      animation-timeline: view();
      animation-range: entry 0% entry 60%;
    }
  }

  /* ---- reduced motion ---------------------------------------------------- */
  /* Not a blanket kill. Everything that MOVES stops - every entrance, both scroll
     timelines, the hover lift, the press - and everything that is COLOUR stays, because a
     button that deepens under the pointer and a field whose border answers focus are
     feedback rather than motion, and removing them makes the page harder to use rather
     than calmer. The page is fully usable with all of it off, because with all of it off
     the page is simply its resting state, which is the state every to-keyframe equals. */
  @media (prefers-reduced-motion: reduce) {
    .hero-copy .eyebrow,
    .hero-copy h1.display,
    .hero-copy .lede,
    .hero-copy .sub,
    .hero-act,
    .scene > .eyebrow,
    .scene .plate-box,
    .scene .beat-line,
    .lockup-inner > * {
      animation: none;
    }
    /* The drift writes the translate property, which 'animation: none' does not clear on its own if a
       timeline has already committed a value; stating the resting value is the same rule
       the rest of this block follows — the resting style is the truth. */
    .scene .plate-box { translate: none; }
    .cta { transition-property: background-color, border-color; }
    .cta:hover, .cta:active { transform: none; box-shadow: ${shadowCss(CTA_SHADOW_LAYERS, FRAG_SHADOW_INK)}; }
    /* The tilt stops answering the pointer. The RECEDE does not: it is opacity, it is not
       movement, and it is the one thing that tells a reader which of three overlapping
       plates they are pointing at. Same distinction this block already draws for the
       button's colour and the field's border. */
    .plate-box .object { transition: opacity var(--t-deliberate) ease; }
    .beat:hover .object { transform: translateZ(var(--z, 0px)) ${TILT.transform}; }
  }

  /* ---- wide viewports ---------------------------------------------------- */
  /* THE FORM MOVES BESIDE THE TYPE AND THE SCENE TAKES THE FULL WIDTH.
     Two dense columns that end near the same line, then one wide composition under them.
     The 460px cap on the form column is the form's own max-width, so the column is the
     control rather than a fraction that happens to contain it; the copy column takes
     whatever is left, and the air falls on neither because both are filled. */
  @media (min-width: 900px) {
    .hero-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 460px);
      grid-template-areas: "copy act" "scene scene";
      grid-template-rows: auto auto;
      column-gap: clamp(40px, 5vw, 84px); row-gap: 0;
      align-items: start;
    }
    /* The sub is the last line of the copy column and the form is the top of the other,
       so its bottom margin is measuring against nothing. */
    .hero-copy .sub { margin-bottom: 0; }
    .plain-list { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: ${RHYTHM.g3}; }
  }

  /* ---- BIG SCREENS: SPEND THE FIELD ON THE PRODUCT, NEVER ON THE MEASURE ----
     Above 1180px of window the page used to stop changing: .wrap caps there and every
     section became a 1180px ribbon with the rest of the display left as bare cream. On a
     1280px laptop that is right. On a 2560px or 3440px monitor it meant the objects that
     are the entire argument of the stage rendered at 449px - smaller, in absolute pixels,
     than they render on a 768px tablet, where a single column gives them 520. The product
     was getting smaller as the screen got bigger, which is the exact opposite of the
     campaign's fragment doctrine.

     SO THE FRAME WIDENS AND THE MEASURE DOES NOT. Those are two different things and the
     distinction is the whole rule here. What grows is the FIELD: .wrap goes to 1560, so the
     two objects reach 634px each - inside the 660px ceiling the contrast guard measures -
     and the end card's wordmark reaches its 200px cap. What does not grow is any LINE OF
     TEXT: the lede is capped at 30ch, the sub at 38ch, the plain version's paragraphs at
     42ch and the legal documents at 68ch, so every measured line is the same length at
     3440px as it is at 1280px. Measured on the built page, the lede is 413px wide at 1280,
     at 1920, at 2560 and at 3440.

     .wrap WIDENS EVERYWHERE AT ONCE, header and footer included, and that is not laziness.
     The campaign's grid is ONE LEFT EDGE for the type and for every object - it is the
     first thing ground.ts states and it is what stops six differently shaped fragments from
     reading as six unrelated slides. An earlier version of this block widened only the
     stage and the lockup, which measured beautifully and put the headline's left edge 190px
     inside the objects' left edge on a 3440px monitor. Two left edges is worse than a
     narrow page.

     The hero's copy column is then capped rather than left as a fraction. A 1fr copy column
     of a 1324px content box balloons to 780px, which is 60 characters of a headline meant
     to break after two words; capped at 560 the type keeps the same relationship to its
     column that it has at 1280 and the leftover falls between the two columns and then on
     the RIGHT, which is where ground.ts's MEASURE note says the air belongs. The SCENE is
     the thing that spends the extra field, because it is the product: its plates go from
     548px at 1280 to their 640px ceiling. */
  @media (min-width: 1500px) {
    .wrap { max-width: 1560px; }
    /* THREE COLUMNS, AND THE THIRD IS EMPTY ON PURPOSE. The top row is a 560px column of
       type and a 460px column of form; the air is the third column, on the right, where it
       belongs. The scene spans all three, so the product gets the whole 1324px field while
       neither line of type gets a character longer. That is the same "the frame widens and
       the measure does not" rule this block has always stated, applied to a grid that now
       has a full-width row in it. */
    .hero-grid {
      grid-template-columns: minmax(0, 560px) minmax(0, 460px) minmax(0, 1fr);
      grid-template-areas: "copy act ." "scene scene scene";
    }
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
    section.hero { padding: 16px 0 40px; }
    h1.display { font-size: clamp(30px, 7.2vw, 52px); margin-bottom: 0.28em; }
    .lede { font-size: clamp(15.5px, 4.3vw, 19px); margin-bottom: 0.5em; }
    .sub { font-size: clamp(13.5px, 3.6vw, 16px); margin-bottom: 1.15em; }
    .eyebrow { font-size: clamp(10.5px, 2.41vw, 15px); margin-bottom: 0.75em; }
    .field-label { margin-bottom: 6px; }
    input[type="email"] { padding: 13px 14px; }
    .adult { margin: 10px 0 13px; }
    .cta { font-size: clamp(21px, 5.1vw, 34px); }
  }

  /* A PORTRAIT PHONE WITH BROWSER CHROME. The tier below moves the form beside the type,
     which needs 480px of width to be worth doing; under that the stack is the only legible
     layout and it has to earn its height instead. This is where it does.

     Measured at 320x454 — an iPhone SE in Safari, the smallest viewport a real visitor
     arrives on — the stack put the button's bottom edge at y=543, 89px under the fold. The
     costs are all rhythm, never type: the header is 87px of a 454px window before the page
     has said anything, the sub carries a 15.5px gap to the form, and the field, the
     checkbox and the button each sit in spacing scaled for a window twice this tall.
     Nothing is removed and no face gets smaller — the lede in particular stays at its
     15.5px floor, because it is the sentence carrying "18+" and "not dating".

     It buys 48px, which is not all 89: closing the rest would mean shrinking the headline
     or the lede, and a button one flick below the fold is a smaller cost than a campaign
     that cannot say its own name. What it does buy is every viewport from 320x500 up:
     -43 -> +5 at 320x500, -23 -> +25 at 360x520, -2 -> +46 at 390x550, -44 -> +4 at
     479x520, and +25 -> +73 at 320x568. Only 320x454 still needs the flick, at -41. */
  @media (max-width: 479px) and (max-height: 620px) {
    header.site-header { padding: 10px 0 2px; }
    section.hero { padding: 8px 0 28px; }
    .eyebrow { margin-bottom: 0.5em; }
    h1.display { margin-bottom: 0.2em; }
    .lede { margin-bottom: 0.35em; }
    .sub { margin-bottom: 0.7em; }
    .field-label { margin-bottom: 4px; }
    input[type="email"] { padding: 11px 14px; }
    .adult { margin: 7px 0 9px; }
  }

  /* SHORT WINDOWS THAT ARE ALSO NARROW: the form moves beside the type here too.
     This is the same remedy as the >=900px short-and-wide block below, at the other end of
     the width axis, and it exists because a phone in landscape is a real shape that the
     single-column stack simply cannot hold. Measured at 844x390, an iPhone on its side: the
     compressed stack above puts the button's bottom edge at y=652 in a 390px window, 262px
     below the fold, and no amount of further squeezing closes that - the eyebrow, a
     two-line headline, a three-line lede and a three-line sub are 340px of type before the
     field starts, in a window 390px tall.

     Two EQUAL columns rather than the wide block's fixed 460px form column, because at
     844px of viewport a 460px form leaves the copy 166px, which is narrower than the
     headline's own first word. At 1fr/1fr the copy gets about 313px and the form gets the
     same, which is wider than the 280px this layout already works at on a portrait phone.

     Keyed at 560px of height AND 480px of width. The height alone is not enough, and
     assuming it was is a real bug this block used to have: 560px was chosen so "a 320x568
     handset held normally never sees it", but 320x568 is the SCREEN. The viewport inside a
     browser is the screen minus its chrome — an iPhone SE in Safari is 320x454 — so every
     small phone held normally landed in here and got the landscape layout in a portrait
     window. Measured at 320x454: two 130px columns, "join the waitlist" wrapped onto two
     lines (the exact failure the font-size note below exists to prevent), the email
     placeholder clipped to "you@exampl", and a 14-character lede.

     480px is where the tier starts paying for itself rather than costing. The form column
     is half the content width, and "you@example.com" plus the input's own 14px padding
     needs 178px: at 480 the inset is 40.7px and the gap 20px, so the column is 189px and
     the placeholder fits with 11px to spare; below that it does not. Every landscape phone
     is comfortably above the floor (568x320 is the smallest shape this tier was written
     for, 844x390 the one it was measured on), and every portrait phone is below it and
     keeps the single-column stack, which is legible at 320px where two columns are not. */
  @media (min-width: 480px) and (max-width: 899px) and (max-height: 560px) {
    section.hero { padding: 12px 0 ${RHYTHM.g3}; }
    .hero-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas: "copy act" "scene scene";
      grid-template-rows: auto auto;
      column-gap: clamp(20px, 4vw, 40px);
      align-items: start;
    }
    .hero-scene { margin-top: ${RHYTHM.g3}; }
    .hero-copy .sub { margin-bottom: 0; }
    h1.display { font-size: clamp(26px, 5.6vw, 40px); }
    .lede { font-size: clamp(14.5px, 2.4vw, 17px); }
    .sub { font-size: clamp(13px, 2vw, 15px); }
    /* The label has to stay on ONE line. Its column is now half the window, and at 568x320
       the inherited clamp put a 29px face into a 221px button, which wrapped the words and
       made a 103px-tall two-line control out of the page primary action. 3.6vw keeps
       6.4em of 'join the waitlist' inside the column at every width this tier covers. */
    .cta { font-size: clamp(17px, 3.6vw, 26px); }
  }

  /* ---- narrow or short desktop windows ------------------------------------ */
  /* The type steps down and the rhythm tightens. Nothing is removed.
     This used to be the block that rescued the fold, because the hero stacked the form
     under 400px of copy; the form is now at the top of its own column at every desktop
     width, so what is left for this block to do is the width problem rather than the
     height one. At exactly 900px wide the copy column is about 190px, and a 76px headline
     in 190px is four lines of one word. The height clause stays because a 1366x660 laptop
     still wants a shorter hero even with the form beside the type — it decides how much of
     the SCENE is on the first screen, which is worth a step of type. */
  @media (min-width: 900px) and (max-height: 940px),
         (min-width: 900px) and (max-width: 1199px) {
    section.hero { padding: ${RHYTHM.g1} 0 ${RHYTHM.g3}; }
    .hero-scene { margin-top: ${RHYTHM.g3}; }
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
`;

// The film's rules, emitted only on the pages that carry the film (the landing page and
// its four aliases), so the legal pages and the two outcome pages stay byte-identical to
// what they were before the film existed.
const FILM_CSS = `
  /* ---- the film ---------------------------------------------------------- */
  /* THE LAUNCH VIDEO, AS A DARK OBJECT ON THE PAPER.
     The film is shot on the app's own dark ground, so on this page it is the one large dark
     element, which is exactly where chartreuse is allowed to live: inside something dark,
     never on the cream. It sits on the grid's one left edge like every other object, at the
     fragments' 10px corner, and it casts the button's square-on shadow because, like the
     button and unlike the plates, it faces the reader untilted.

     G4 above and nothing below: the plain version's own G4 is the gap under it, and two
     sections cannot each pay for the same boundary.

     THE SENTENCE COMES FIRST IN THE DOM, as the scene's sentences do, so on a phone the line
     sits above the film and no type is ever set inside its cast shadow. From 900px the film
     is placed in the first column and the line beside it, centred on the film's band, which
     is the scene's interleave again: a line of type and an object sharing a line.

     THE WIDTH IS CAPPED TWICE. 360px keeps a 9:16 film the shape of a phone on a desktop,
     and 43.875% of the window's height (so the film is at most 78% of it) lets a laptop see
     the whole film without scrolling through it; on a portrait phone that second cap is what
     keeps the controls on the same screen as the top of the picture. vh first, svh second:
     the same fallback-then-override pattern as the fragments' cqw lines in CSS. */
  section.film { padding: ${RHYTHM.g4} 0 0; }
  .film .eyebrow { margin: 0 0 ${RHYTHM.g2}; }
  .film-fig { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr); }
  .film-line { font-size: clamp(15px, 1.7vw, 18px); color: var(--muted); margin: 0 0 ${RHYTHM.g2}; max-width: 38ch; }
  .film-frame {
    width: min(100%, 360px);
    width: min(100%, 360px, 43.875vh);
    width: min(100%, 360px, 43.875svh);
    aspect-ratio: 9 / 16;
    overflow: hidden; isolation: isolate;
    background: ${FILM.ground};
    border-radius: 10px;
    box-shadow: ${shadowCss(CTA_SHADOW_LAYERS, FRAG_SHADOW_INK)};
  }
  .film-frame video {
    display: block; width: 100%; height: 100%; object-fit: cover;
    background: ${FILM.ground}; border-radius: 10px;
  }

  @media (min-width: 900px) {
    /* The film on the left edge, its sentence beside it at the lede's size. The frame
       drops its 100% term here because an auto track would make it cyclic, and at 900px
       of window the content box is already wider than 360px. */
    .film-fig { grid-template-columns: auto minmax(0, 1fr); column-gap: ${RHYTHM.g3}; align-items: center; }
    .film-frame { grid-area: 1 / 1; width: min(360px, 43.875vh); width: min(360px, 43.875svh); }
    .film-line { grid-area: 1 / 2; margin: 0; font-size: clamp(17px, 2.1vw, 22px); line-height: 1.5; color: var(--ink); max-width: 30ch; }
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
  extraCss = "",
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
<style>${CSS}${extraCss}</style>
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
    // ONE OBJECT, AND IT USED TO BE TWO.
    //
    // The overlap badge stood alone in its own frame, and Cameron's note on it was that it
    // "just looks uncomfortable there, it feels isolated". It was, and the reason is that it
    // is the only RELATIONAL thing on the page. A list of games means something by itself and
    // so does a message composer, but three games in common is a count with no subject: in
    // common with whom, out of what? In SwipeCard it never appears alone — it sits under the
    // games it is counting, on the card belonging to the person it is counting them against.
    //
    // So this is not a rearrangement, it is a restoration: chips above, badge beneath, the
    // order the app itself stacks them in. The number finally has a referent, which is the
    // two chips directly above it.
    //
    // Chip.tsx with label + detail (details are SKILL_LABELS values), then
    // SwipeCard.tsx:61-63, where overlapLabel(3) returns exactly this string.
    html: `<div class="object"><div class="chips">
      <span class="chip"><b>Rocket League</b><i>&middot; Ranked Grinder</i></span>
      <span class="chip"><b>Valorant</b><i>&middot; Competitive</i></span>
    </div><div class="overlap"><span>&gt;&gt; 3 GAMES IN COMMON</span></div></div>`,
    caption: "you match on what you play, and how you play it",
    depth: DEPTH.back,
    par: 1,
  },
  {
    // THE BEAT THE PAGE DID NOT HAVE, and it is the one the app is for.
    //
    // The two fragments above and below read "you match on what you play" and "then you
    // talk". That is a sentence with its verb missing: nothing in it is the moment two
    // people actually become a duo, which is the whole product and the thing the films
    // build to. src/data/clips.ts carries five more cut fragments — the deck card,
    // DUO LOCKED, the Send button, the highlights row and the pass/ping/boost row — and
    // this is the only one of them that closes that gap, so it is the only one added.
    //
    // WHAT WAS REJECTED, AND WHY, BECAUSE "CHOOSE" MEANS SAYING NO THREE TIMES:
    //   the deck card (frag-light-card-top) is the strongest fragment in the set and it is
    //   unusable here: it IS a photograph of a real person, and the note at the top of this
    //   block says why this build will not put one on a landing page;
    //   the pass/ping/boost row is the swipe MECHANIC rather than any outcome, and three
    //   unlabelled icon buttons lifted off a card they no longer sit on are furniture with
    //   no referent — the exact fault the overlap badge had when it stood alone;
    //   the highlights row is profile decoration, needs imagery to mean anything, and says
    //   nothing about matching;
    //   the chat bubble duplicates the composer's job one beat later.
    //
    // app/match/[matchId].tsx. The label is type.label at 16/22 with letterSpacing 3 in
    // colors.volt; the line under it is type.body with the screen's own fallback name,
    // because no fragment on this site carries a real one. The brackets are BracketGlyph:
    // in the app they spring together around the avatar, and here they close around the
    // words — the crop note is in the .duo CSS.
    html: `<div class="object"><div class="duo">
      <span class="bracket" aria-hidden="true">[</span>
      <div class="said">
        <p class="lock">Duo locked</p>
        <p class="both">You and your new match both queued up.</p>
      </div>
      <span class="bracket" aria-hidden="true">]</span>
    </div></div>`,
    caption: "and when it is mutual, you are a duo",
    depth: DEPTH.mid,
    par: 0,
  },
  {
    // app/chat/[matchId].tsx:749-795 — the composer, placeholder and all.
    html: `<div class="object"><div class="composer">
      <div class="box">Message&hellip;</div>
      <div class="send">${ARROW_UP_SVG}</div>
    </div></div>`,
    caption: "then you talk, and queue up",
    depth: DEPTH.front,
    par: -1,
  },
];

/** One beat: a plate and the sentence that names it. The plate carries its depth as --z
 *  (the tilt reads it) and its parallax rate as --par (the drift keyframe reads it), so a
 *  beat's position in the stack is stated once, here, rather than in three CSS rules. */
function beatsHtml(list = FRAGMENTS) {
  return list
    .map(
      (f, i) =>
        `<div class="beat">` +
        `<p class="beat-line"><span class="no">${String(i + 1).padStart(2, "0")}</span>${f.caption}</p>` +
        `<div class="plate-box" style="--z:${f.depth}px;--par:${f.par}">${f.html}</div></div>`
    )
    .join("\n        ");
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
      <p class="fineprint">We do not share your address. No analytics, no trackers and no cookies on this page. Submitting the form sets one 30-minute anti-bot cookie on our backend&rsquo;s own domain, and nothing else. See the <a href="/privacy/">Privacy Policy</a>.</p>`;
}

/** The launched-phase body. Built now rather than left as a TODO so the flip in
 * 1.6 is one constant and not a rewrite under time pressure on release day. */
function launchedCta() {
  return `
      <p><a class="cta" href="${APP_STORE_URL}" style="max-width:460px;">download on the app store</a></p>
      <p class="promise">DuoQueue is live. If you joined the waitlist, the email is already on its way.</p>`;
}

/** The launch film. A plain <video>: native controls, no script (see FILM). The sentence
 * is the figure's caption and comes first in the DOM, so a phone reads it above the film. */
function filmSection() {
  return `
<section class="film" aria-labelledby="film-head">
  <div class="wrap">
    <h2 class="eyebrow" id="film-head">The short version</h2>
    <figure class="film-fig">
      <figcaption class="film-line" id="film-line">The app, from the first swipe to queueing up.</figcaption>
      <div class="film-frame">
        <video src="/${FILM.video}" poster="/${FILM.poster}" controls muted${FILM.autoplay ? " autoplay" : ""} loop playsinline preload="metadata" aria-label="DuoQueue, a short film of the app" aria-describedby="film-line">
          <a href="/${FILM.video}">Watch the DuoQueue film</a>
        </video>
      </div>
    </figure>
  </div>
</section>
`;
}

function waitlistBody({ source, film = false }) {
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
      <div class="hero-scene scene">
        <h2 class="eyebrow">What you are joining</h2>
        <div class="stack">
        ${beatsHtml()}
        </div>
      </div>
    </div>
  </div>
</section>
${film ? filmSection() : ""}
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

function buildWaitlistPage({ source, canonical, includeSupport, film = false }) {
  return pageShell({
    title:
      PHASE === "launched"
        ? "DuoQueue: find your duo"
        : "DuoQueue: join the waitlist",
    description:
      "DuoQueue is an 18+ app for finding people to play games with. Platonic, not dating. Join the waitlist and get one email the day it goes live.",
    canonical,
    bodyHtml: waitlistBody({ source, film }) + (includeSupport ? supportSection() : ""),
    extraCss: film ? FILM_CSS : "",
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
  // The film goes on all five, since they are one page. Checked once, before any of them is
  // written, so the five cannot disagree about it.
  const film = filmPresent();
  write("index.html", buildWaitlistPage({ source: "direct", canonical: `${SITE_ORIGIN}/`, includeSupport: true, film }));
  write("waitlist/index.html", buildWaitlistPage({ source: "direct", canonical: `${SITE_ORIGIN}/`, includeSupport: false, film }));
  for (const [dir, source] of [["tt", "tt"], ["ig", "ig"], ["yt", "yt"]]) {
    write(`${dir}/index.html`, buildWaitlistPage({ source, canonical: `${SITE_ORIGIN}/`, includeSupport: false, film }));
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

  // The film, asserted like og.png. deploy-site.mjs echoes only the "wrote" and "Built"
  // lines of this output, so the verdict goes in the Built line itself: a deploy without
  // the film says so on its own summary rather than in a warning nobody sees.
  if (film) {
    written.push(`${FILM.video} (pre-existing)`, `${FILM.poster} (pre-existing)`);
  } else {
    console.warn(
      `  WARNING: site/${FILM.video} or site/${FILM.poster} is missing, so the film section was left out.\n` +
        "  Copy the launch render and its poster there (see FILM in this file) and re-run."
    );
  }

  for (const p of written) console.log(`wrote site/${p}`);
  console.log(
    `\nBuilt site/ successfully (PHASE = "${PHASE}", film ${film ? "included" : `LEFT OUT, site/${FILM.video} or its poster is missing`}).`
  );
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
