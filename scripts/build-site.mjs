// scripts/build-site.mjs — builds the public duoqueue.io site into site/.
//
// Zero dependencies on purpose (matches the rest of this repo's scripts/ policy):
// only node:fs, node:path, node:url. No markdown library, no bundler, no CDN.
// Every page is fully self-contained HTML with an inline <style> block and inline
// SVG, and the only sub-resources any page requests are five .woff2 files served
// from this same origin, plus, on the four watch pages, the launch film and its poster
// (FILM below), also from this same origin and played by a plain <video> element with
// no script. No third-party request of any kind, from any page. That
// property is load-bearing twice over: it is what makes the site fast on a phone
// on cellular, and it is what lets the privacy policy say there is no analytics or
// advertising script on duoqueue.io without a caveat.
//
// What this does:
//   docs/legal/privacy-policy.md   -> site/privacy/index.html
//   docs/legal/terms-of-service.md -> site/terms/index.html
//   (hand-written, not from markdown):
//     site/index.html                     the landing page: the form, or once launched the App Store link
//     site/waitlist/index.html            the same page at its canonical-ish path
//     site/tt|ig|yt/index.html            the same page (with the form, one hidden field different)
//     site/watch/index.html               the film on its own dark page
//     site/tt|ig|yt/watch/index.html      the same page, its button back to that channel (or to the App Store)
//     site/waitlist/thanks/index.html     post-submit success; once launched, "out now" for old links
//     site/waitlist/try-again/index.html  post-submit "fix one of two things"; the same, once launched
//   plus site/CNAME, site/.nojekyll, site/favicon.png, site/og.png
//   and, committed rather than generated (like og.png and the fonts):
//     site/assets/duoqueue-launch.mp4          the launch film, shown on the watch pages
//     site/assets/duoqueue-launch-poster.jpg   its poster frame
//   The watch pages, and every link to them, are built only when both files are present, so
//   a page never points at a missing video; the build's last line says whether they went in.
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
// Four more guards have since joined it, all the same shape (refuse to write
// anything rather than publish something wrong):
//   * the LAUNCH GUARD, so a "launched" site whose only call to action is a
//     dead App Store link cannot be built (see PHASE below);
//   * the FONT GUARD, so a missing .woff2 is a loud failure instead of a
//     silent fallback to system sans on every page;
//   * the CONTRAST GUARD, so a colour edit that drops a text pair below WCAG
//     AA fails the build with the measured ratio (see CONTRAST_PAIRS);
//   * the PAGE SOURCE GUARD, so no page is written with a <script> tag, an
//     inline on...= handler, a javascript: URL (the privacy policy says there
//     is no JavaScript on the site at all) or an em dash anywhere in its source
//     (see checkPageSource).
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
// PHASE controls every line that is only true before, or only true after, the app is out:
// the hero's eyebrow, call to action and the promise under it (a form, or the App Store
// link), the queue bar's button, the moment cards' heading, the plain version's first and
// third items, where the outlined link after the plain version points (back up to the
// form, or to the App Store), the landing pages' meta description, the watch pages'
// button, and what the two waitlist result pages say.
//
// FLIPPED TO "launched" ON 30 SEPT 2026, the day DuoQueue 1.0 went live on the App Store.
// ---------------------------------------------------------------------------
const PHASE = "launched"; // "waitlist" | "launched"
// The listing is "DuoQueue: Gaming Partners", app id 6798837181. This is the slug-free
// form on purpose: Apple redirects it to the visitor's own storefront's listing, so it
// needs no country code and survives a rename of the listing. No Apple badge image is
// drawn or loaded (the site loads nothing from a third party, and the official badge is
// Apple's artwork, not ours to imitate); the button says "Download on the App Store" in
// the app's own button style, with "App Store" capitalised as Apple's guidelines ask.
const APP_STORE_URL = "https://apps.apple.com/app/id6798837181";

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
// 16.88:1. So chartreuse is NEVER a fill or a type colour on the light ground. It
// lives inside dark elements: the skip link's slab, and the watch pages, which are
// dark all over. Its one appearance on the paper is as a mark UNDER ink, the
// highlighter stroke behind the hero's "duo": the word is read by its ink (15.11:1
// on the stroke), and nothing is read by the stroke. For accent type on the light
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
  brand: "#CDFF3D", // darkColors.voltRaw: a fill or type ONLY inside a dark element; on paper, only the stroke under the hero's ink
  slab: "#0A0B09", // darkColors.background
  field: "#FFFFFF", // lightColors.surface
  rule: "#C9CFBB", // lightColors.border
};

// The app's LIGHT palette, for the three moment cards and the call to action. What each card
// shows is the real app, so it is drawn in the real tokens: apps/mobile/src/theme/tokens.ts,
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
// already what the send button on the third moment card looks like.
//
// The measured trade, stated rather than hidden. The label pair goes 16.88:1 -> 5.82:1 and
// the SILHOUETTE - the fill against the paper, which is what a button is read by before its
// words - goes 17.18:1 -> 5.39:1. That is the real cost and it is why everything else about
// the button got LOUDER to pay for it: it gains a cast shadow in the page's own shadow ink
// so it is a lifted object rather than a hole punched in the paper, it gains air above it,
// and it deepens to `voltDim` #3B5600 (7.27:1 silhouette) under the pointer. A deep olive
// is also the only chromatic mass on a neutral warm ground, which black was not.
//
// What it costs the brand: on the paper, raw chartreuse is now only the highlighter stroke
// under the hero's "duo" (a mark under ink, never a fill or a word) and the skip link's dark
// slab. That is the rule holding, not the rule breaking - a chartreuse fill on this ground
// has no silhouette at 1.05:1 - but it is a real loss and it belongs in the record rather
// than in a footnote. The watch pages are where it is at full strength: they are dark.
//
// The other consequence is structural: a white card on a light ground has almost no
// tonal step left, so its edge is no longer a detail. The hairline is the only thing
// separating an object from the paper, and the cast shadow underneath it is the other.
// Neither is decoration on this palette.
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
  // The rest of lightColors.overlap (OVERLAP_LIGHT in tokens.ts). The first moment card's
  // badge counts up through all four inks as its game rows land, so all four are here.
  overlapNone: "#66705C",
  overlapOne: "#4E7018",
  overlapTwo: "#5A7A00",
  bubbleOwn: "#E4EDC8", // lightColors.bubbleOwn, the sent message on the third card
};

// THE FILM: the launch video, on its own dark watch pages (/watch/ and one per channel,
// buildWatchPage). The landing pages carry only the trailer link to it.
//
// Committed media under site/assets/, like og.png and the fonts, because it is rendered
// elsewhere (the Hyperframes launch render) and this build is zero-dependency. It is played
// by a plain <video> element: native controls, no script, which is what lets the privacy
// policy keep saying there is no JavaScript on the site. Muted, so browsers allow it to play
// itself; playsinline, so iOS does not throw it into the fullscreen player. It plays ONCE and
// has no loop attribute, so it comes to rest on its last frame, "Duo queue tonight.", with the
// join button beside it (on the landing page it looped, to hold a phone that scrolled back).
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
  // The running time as a player shows it (the build 15 trailer renders at 22.4s), printed on the
  // trailer link so a visitor knows what the tap costs before they make it.
  length: "0:22",
};

// THE SCREENING ROOM'S PALETTE: the watch pages, the one dark page on the site. It is the app's
// own dark theme, apps/mobile/src/theme/tokens.ts `darkColors`, verbatim, because the film was
// shot on it: the page and the film's frame are one ground, and chartreuse is legal here for the
// same reason it is not on the paper (16.88:1 on this ground, 1.05:1 on the cream).
const VOLT = {
  background: "#0A0B09", // darkColors.background, the film's own ground (FILM.ground)
  text: "#EDF1E6", // darkColors.text
  textMuted: "#B4BDA6", // darkColors.textMuted
  volt: "#CDFF3D", // darkColors.volt, the join button's fill and the accent
  voltDim: "#94BC2C", // darkColors.voltDim, the button pressed and hovered
  onVolt: "#0A0B09", // darkColors.onVolt, the button's label
  border: "#232720", // darkColors.border, the hairlines and the film frame's edge
  markDuo: "#8A927E", // darkColors.overlap.none, the mark's second ring on the dark ground
};

/** Both files present and non-empty. Otherwise the four watch pages, the trailer link and the
 *  nav's Watch link are all left out, loudly, so nothing can point at a missing film. */
function filmPresent() {
  return [FILM.video, FILM.poster].every((rel) => {
    try {
      return statSync(path.join(SITE_DIR, rel)).size > 0;
    } catch {
      return false;
    }
  });
}

// THE PAGE'S ONE SHADOW INK, from marketing/video/src/frag/ground.ts. Warm, because the ground
// is warm; a neutral grey shadow on this paper reads as dirt. Every shadow on the site is drawn
// in it (the call to action's, the moment cards', the trailer link's lift), because the page
// has ONE light source and a second shadow colour would give it two.
//
// It used to come with the campaign's own two shadow layers, held as ratios of an object's
// width, for the tilted product fragments, and with a contrast sweep of every fragment width
// for the caption sitting in their cast. The fragments were replaced by the moment cards on
// 23 Sept 2026, whose type all sits on their own white surface, so the layers and the sweep
// were retired with them; this ink is what is left.
const SHADOW_INK = [41, 34, 18];

// ---------------------------------------------------------------------------
// THE CALL TO ACTION'S SHADOW.
//
// The button lost 17.18:1 of silhouette when it stopped being off-black (see the design
// note above). A cast shadow is how it gets presence back without getting harshness back:
// an object that sits ON the paper is read before an object that is merely a different
// colour from it.
//
// It is in fixed pixels because the button is furniture at a known size (250px on the
// smallest phone, 460px in the form) and because a cast that scaled with a 460px button
// would put 24px of grey under the sentence beneath it. In SHADOW_INK, rgba(41,34,18), like
// every shadow on the page. Straight down, with no x offset: the button faces the reader
// square-on, so its light falls on it square-on.
//
// checkContrast() reads this array and composites it before measuring the two sentences
// that sit under the button (groundUnderCta).
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

// THE MOMENT CARDS' SHADOW, which the support card shares. Soft and short: a card is
// furniture resting on the paper rather than an object arriving at the reader, so it gets a
// hairline contact layer and a cast pulled in by its negative spread, in the page's one
// shadow ink. No type sits in a card's cast: each card's own text is inside its white
// surface, a card below another is white too, and the nearest type under the last card is
// the next section's, a SECTION_GAP (56px at least) away.
const CARD_SHADOW_LAYERS = [
  { x: 0, y: 1, blur: 2, spread: 0, alpha: 0.06 },
  { x: 0, y: 14, blur: 32, spread: -14, alpha: 0.22 },
];
// The cards' edges. None of them carries text contrast: each is the border of a surface
// that is lighter than the paper it sits on or the screen it sits in.
const CARD = {
  hairline: "#E2E0D6", // a card's own edge, and the support card's
  stageEdge: "#E6E9DD", // the edge of the app screen inside each card
  bubbleOwnEdge: "#D3DFB0", // the sent bubble's edge on the third card
};

// THE TWO SEE-THROUGH SURFACES ON THE PAPER, each alpha named once so the CSS and the contrast
// guard read the same number. The trailer link is white at 60% over the ground. The queue bar
// is the ground at 90% over whatever scrolls under it, and the darkest thing that can is the
// ink; its backdrop blur only ever averages ink with something lighter, so flat ink is the
// worst case the guard measures.
const TRAILER_FILL_ALPHA = 0.6;
const QBAR_ALPHA = 0.9;

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
  // why the old fragment floor's comment ("320px viewport, 2x20px inset") disagreed with the
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
  // The mono section labels. The campaign's 26/1080 is 2.41vw, and uncapped past 14px it
  // grew a label to 26px on a desktop, larger than the card sentences it introduces, so it
  // stops at 14px (23 Sept 2026). The floor is unchanged, so a phone sees no difference.
  label: "clamp(11px, 1.05vw, 14px)",
  // THE BUTTON'S LABEL STOPS AT 32px, the size in the "Wildcard" prototype Cameron approved on
  // 23 Sept 2026 (24 Sept 2026: "shrink the button to match the prototype"). The campaign's
  // 68/1080 grew it to 44px on a desktop, where it shouted over a headline only 76px tall; the
  // floor and the 5.4vw ratio are unchanged, so every phone (5.4vw is 23.2px at 430) gets the
  // exact size it got before and only windows wider than 593px see the cap. The two height and
  // width tiers near the end of the CSS stop it at 30px, as the prototype does.
  cta: "clamp(21px, 5.4vw, 32px)",
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
//   G1   26/1080 =  2.41%   the mono step, the campaign's label size used as a gap. The
//                           tightest gap on the page: above the header's mark, and above
//                           the footer's first line.
//   G2   40/1080 =  3.70%   the end card's own internal gap (FragEnd.tsx), already used by
//                           .lockup-inner. Block to block inside one composition.
//   G3   62/1080 =  5.74%   the end card's margin. Between the parts of a section.
//   G4  118/1080 = 10.93%   the grid's own inset, GRID.x0's own ceiling. Section to section,
//                           so the page's biggest vertical gap is exactly its horizontal one
//                           and the field reads as square rather than as a tall ribbon.
//
// Each is written the way GRID.x0 is: a vw ratio between a floor and the literal number the
// campaign uses, so a 320px phone gets a proportionate gap rather than the desktop one.
const RHYTHM = {
  g1: "clamp(10px, 2.41vw, 26px)",
  g2: "clamp(16px, 3.70vw, 40px)",
  g3: "clamp(24px, 5.74vw, 62px)",
  g4: "clamp(36px, 10.93vw, 118px)",
};

// THE LANDING PAGE'S SECTION STEP, and the one gap that is not on the ladder above. It is
// the space above the three moment cards, above the plain version, and under it: the value
// from the prototype Cameron approved on 23 Sept 2026. Against G4 it gives a phone more air
// between sections whose cards carry their own shadow (56px against 36-43px) and a desktop a
// little less (104px against 118px). Each section pays for its own top edge, so no boundary
// is paid for twice.
const SECTION_GAP = "clamp(56px, 9vw, 104px)";

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
// So the guard composites a shadow before it measures the type under it. A CSS
// box-shadow's blur radius r is defined as a Gaussian of sigma = r/2 applied to the
// shadow rectangle, so the layer's coverage at a distance d beyond that rectangle's edge
// is the normal tail Phi(-d / sigma).
//
// The fragments and their captions are gone (23 Sept 2026: the moment cards' type all
// sits on their own white surface, out of any cast), so what the model measures now is
// the one shadow that still has type under it: the call to action's, over `.promise` and
// `.fineprint`.
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
 * The ground colour `gap` px below an object that casts `layers` in `ink`, over `base`.
 * Returns the darkest value the top edge of type at that distance can sit on.
 *
 * It reads the same layer arrays the CSS is generated from, rather than re-stating the
 * geometry. That is what makes this a guard and not a second opinion: lengthen the cast,
 * or close the gap under the button, and these numbers move and the build stops.
 */
function groundUnder(layers, gap, ink = SHADOW_INK, base = GROUND.darkest) {
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

/** The ground under the two sentences below the call to action, in whichever of its
 *  three states casts the longest shadow. `extra` is how far below `.promise` a second
 *  line sits. */
function groundUnderCta(layers, extra = 0) {
  return groundUnder(layers, CTA_PROMISE_GAP + extra);
}

// The two see-through surfaces, resolved to the colour a reader sees at their worst, from the
// same alphas the CSS is written with (TRAILER_FILL_ALPHA, QBAR_ALPHA). The trailer link is
// white over the sweep's darkest stop; the queue bar is the ground over flat ink.
const TRAILER_FILL = over(hexToRgb(INK.field), TRAILER_FILL_ALPHA, GROUND.darkest);
const QBAR_WORST = over(hexToRgb(GROUND.base), QBAR_ALPHA, INK.type);

// EVERY TEXT AND CONTROL PAIR ON THE SITE, each named with the surface it really sits on.
// A pair is retired when its element is: the film's silhouette on the paper went when the
// film moved to its own page, the dark slab's ground-coloured type went with the slab, and
// the fragments' caption sweep went with the fragments (all by 23 Sept 2026).
const CONTRAST_PAIRS = [
  // THE PAPER: every page but the watch pages is printed on it.
  { what: "body ink on the ground", fg: INK.type, bg: GROUND.darkest, min: 4.5 },
  { what: "muted ink on the ground (eyebrows, the sub, the nav, the plain version, the fine print, the footer)", fg: INK.muted, bg: GROUND.darkest, min: 4.5 },
  { what: "accent on the ground (links, the nav's WATCH, the outlined join link, focus rings)", fg: INK.accent, bg: GROUND.darkest, min: 4.5 },
  { what: "typed email in the field", fg: INK.type, bg: INK.field, min: 4.5 },
  // The paper pages' one dark element, the skip link, off-canvas until a keyboard finds it.
  { what: "chartreuse on the skip link's dark slab", fg: INK.brand, bg: INK.slab, min: 4.5 },

  // THE HERO. "duo" is ink on the chartreuse highlighter stroke: the word is read by its ink
  // and the stroke only marks it (see the CSS). The trailer link is a light pill with the
  // app's olive play disc. The disc's glyph, like the send arrow on card 03 and the queue
  // bar's arrow, is a graphic, so it is held to the 3.0 a graphic needs.
  { what: "hero: ink on the chartreuse highlighter (\"duo\")", fg: INK.type, bg: INK.brand, min: 4.5 },
  { what: "hero: trailer link label, ink on its fill (white at 60% over the ground)", fg: INK.type, bg: TRAILER_FILL, min: 4.5 },
  { what: "hero: trailer link running time, muted ink on its fill", fg: INK.muted, bg: TRAILER_FILL, min: 4.5 },
  // The moment cards' Pause / Play control is a pill on the trailer link's own fill, with its
  // word and its glyph in ink. Its focus ring is the accent on the ground, measured above.
  { what: "cards: the Pause / Play control's word and glyph, ink on its fill", fg: INK.type, bg: TRAILER_FILL, min: 4.5 },
  { what: "onVolt glyphs on a volt disc (the trailer's play, card 03's send, the bar's arrow)", fg: APP.onVolt, bg: APP.volt, min: 3.0 },

  // THE CALL TO ACTION, in all three of its states.
  //
  // Four pairs, not one, because a button is read twice: once as a shape and once as a
  // word. The label pairs are held at 4.5 even though `GRID.cta` is 21px at its smallest
  // (large-text territory, where 3.0 would do) because the label is the sentence the whole
  // page exists to get read and there is no reason to spend the headroom. The queue bar's
  // button and the outlined link's hover are the same two fills under the same label.
  //
  // The SILHOUETTE pairs are the ones that matter here. WCAG 1.4.11 asks 3.0 of a control's
  // boundary against what is behind it, and this is exactly the number that the off-black
  // slab used to win 17.18:1 without trying. It is the measurement that says whether a
  // softer button is still a button.
  { what: "onVolt label on the volt call to action", fg: APP.onVolt, bg: APP.volt, min: 4.5 },
  { what: "onVolt label on voltDim (hover / press fill)", fg: APP.onVolt, bg: APP.voltDim, min: 4.5 },
  { what: "volt FILL against the ground (the button's silhouette)", fg: APP.volt, bg: GROUND.darkest, min: 3.0 },
  { what: "voltDim FILL against the ground (hover silhouette)", fg: APP.voltDim, bg: GROUND.darkest, min: 3.0 },

  // THE MOMENT CARDS. Each card is white, and each moment sits on the app screen inside it
  // (the app's own background) or on a white chip, badge or bubble within that screen.
  { what: "cards: the sentence under each card, ink on the card's white", fg: INK.type, bg: APP.surface, min: 4.5 },
  { what: "cards: the index (01 / 02 / 03), accent on the card's white", fg: INK.accent, bg: APP.surface, min: 4.5 },
  { what: "card 01: a game's name, app text on the chip's white", fg: APP.text, bg: APP.surface, min: 4.5 },
  { what: "card 01: its skill level, app muted on the chip's white", fg: APP.textMuted, bg: APP.surface, min: 4.5 },
  // The badge counts up through all four of the app's overlap inks as the rows land, so each
  // of the four is type at some point, and each is held to 4.5.
  { what: "card 01: NO GAMES IN COMMON, overlap none on the badge's white", fg: APP.overlapNone, bg: APP.surface, min: 4.5 },
  { what: "card 01: 1 GAME IN COMMON, overlap one on the badge's white", fg: APP.overlapOne, bg: APP.surface, min: 4.5 },
  { what: "card 01: 2 GAMES IN COMMON, overlap two on the badge's white", fg: APP.overlapTwo, bg: APP.surface, min: 4.5 },
  { what: "card 01: 3 GAMES IN COMMON, overlap many (amber) on the badge's white", fg: APP.amber, bg: APP.surface, min: 4.5 },
  // DUO LOCKED and its two bracket glyphs are the one place on the paper where volt is TYPE
  // rather than a fill, so they get the 4.5 type is held to. They sit on the app screen, the
  // app's background, not on its white surface.
  { what: "card 02: DUO LOCKED and its brackets, volt on the app screen", fg: APP.volt, bg: APP.background, min: 4.5 },
  { what: "card 02: the line under it, app text on the app screen", fg: APP.text, bg: APP.background, min: 4.5 },
  { what: "card 03: the incoming bubble, app text on white", fg: APP.text, bg: APP.surface, min: 4.5 },
  { what: "card 03: the sent bubble, app text on bubbleOwn", fg: APP.text, bg: APP.bubbleOwn, min: 4.5 },
  { what: "card 03: the composer's placeholder, app muted on surfaceAlt", fg: APP.textMuted, bg: APP.surfaceAlt, min: 4.5 },
  { what: "card 03: the message being typed, app text on surfaceAlt", fg: APP.text, bg: APP.surfaceAlt, min: 4.5 },

  // THE QUEUE BAR, at its worst case: the ground at 90% over the darkest thing that can
  // scroll under it, the ink. Its label and its hover are the call to action's pairs above.
  { what: "queue bar: the wordmark, ink on the bar (90% ground over ink)", fg: INK.type, bg: QBAR_WORST, min: 4.5 },
  { what: "queue bar: the button's volt fill against the bar (its silhouette)", fg: APP.volt, bg: QBAR_WORST, min: 3.0 },

  // THE SUPPORT CARD, white like the moment cards.
  { what: "support card: links, accent on white", fg: INK.accent, bg: APP.surface, min: 4.5 },
  { what: "support card: body, ink on white", fg: INK.type, bg: APP.surface, min: 4.5 },

  // THE WATCH PAGES, the one dark page on the site (VOLT, the app's own dark theme), where
  // chartreuse is legal as type and as a fill. The join button gets the same four pairs the
  // paper's button gets, and the skip link there is the button's two colours. The mark's second
  // ring is a graphic that carries the logo, so it is held to 3.0.
  { what: "watch: text on the dark ground", fg: VOLT.text, bg: VOLT.background, min: 4.5 },
  { what: "watch: muted text (the eyebrow, the lede, the nav, the promise, the footer)", fg: VOLT.textMuted, bg: VOLT.background, min: 4.5 },
  { what: "watch: chartreuse (the key words, the nav's WATCH, links, focus rings)", fg: VOLT.volt, bg: VOLT.background, min: 4.5 },
  { what: "watch: join button label (and the skip link), onVolt on volt", fg: VOLT.onVolt, bg: VOLT.volt, min: 4.5 },
  { what: "watch: join button label on voltDim (hover / press fill)", fg: VOLT.onVolt, bg: VOLT.voltDim, min: 4.5 },
  { what: "watch: volt FILL against the dark ground (the button's silhouette)", fg: VOLT.volt, bg: VOLT.background, min: 3.0 },
  { what: "watch: voltDim FILL against the dark ground (hover silhouette)", fg: VOLT.voltDim, bg: VOLT.background, min: 3.0 },
  { what: "watch: the mark's second ring on the dark ground (a graphic)", fg: VOLT.markDuo, bg: VOLT.background, min: 3.0 },
];

function checkContrast() {
  const failures = [];
  for (const pair of CONTRAST_PAIRS) {
    const ratio = contrastRatio(pair.fg, pair.bg);
    const line = `  ${ratio.toFixed(2).padStart(6)}:1  (needs ${pair.min.toFixed(1)})  ${pair.fg} on ${pair.bg}  ${pair.what}`;
    if (ratio < pair.min) failures.push(line);
    else console.log(line);
  }

  // THE CALL TO ACTION'S SHADOW, measured over the type under it.
  //
  // The button gained a cast shadow to buy back the presence it lost when it stopped being
  // off-black, and directly under that shadow sit the two sentences a visitor reads to
  // decide whether to type an address: `.promise` in ink and `.fineprint` in muted ink.
  // The old fragments' captions failed this exact check once, at 4.02:1, while a flat-ground
  // model printed a pass, so the button's shadow is modelled rather than assumed.
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

  // Not a pass/fail pair, a printed reminder. If this number ever climbs, someone has
  // changed the ground, and the rule this design rests on (chartreuse is never a fill or a
  // type colour on the paper; its one appearance there is the stroke under the hero's ink
  // "duo", which nothing is read by) has to be re-argued rather than quietly dropped.
  console.log(
    `  ${contrastRatio(INK.brand, GROUND.base).toFixed(2).padStart(6)}:1  (informational)   ` +
      `${INK.brand} on ${GROUND.base}  chartreuse on the ground: why it is never a fill or type there`
  );
  if (failures.length) {
    console.error("\nREFUSING TO BUILD: contrast below WCAG AA.\n");
    failures.forEach((f) => console.error(f));
    process.exit(1);
  }
  console.log(
    `\n  every contrast pair passed: ${CONTRAST_PAIRS.length} pairs, and ` +
      `${CTA_STATES.length * CTA_TEXT.length} under the call to action's shadow`
  );
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

/** The mark's four shapes as SVG element strings, in paint order: the duo ring, its tail,
 *  the ink ring over both, and the short arc of the duo ring that passes back over the ink
 *  (the weave). ringsMarkSvg() paints them as one picture; the second moment card's
 *  lockinSvg() groups the same four so the rings can slide together. One geometry, two
 *  arrangements, and neither can drift from the other. */
function ringShapes(scale = 1) {
  const { R, W, cxA, cxB, cy, tail } = ringGeometry(scale);
  const s = ((138.59 - 27.5) * Math.PI) / 180;
  const e = ((138.59 + 27.5) * Math.PI) / 180;
  const seg = `M ${cxB + R * Math.cos(s)} ${cy + R * Math.sin(s)} A ${R} ${R} 0 0 1 ${cxB + R * Math.cos(e)} ${cy + R * Math.sin(e)}`;
  const ink = "var(--mark-ink)";
  const duo = "var(--mark-duo)";
  return {
    duoRing: `<circle cx="${cxB}" cy="${cy}" r="${R}" fill="none" stroke="${duo}" stroke-width="${W}" />`,
    tail: `<circle cx="${tail.cx}" cy="${tail.cy}" r="${tail.r}" fill="${duo}" />`,
    inkRing: `<circle cx="${cxA}" cy="${cy}" r="${R}" fill="none" stroke="${ink}" stroke-width="${W}" />`,
    weave: `<path d="${seg}" fill="none" stroke="${duo}" stroke-width="${W}" />`,
  };
}

/** Chain-weave rings mark as an inline SVG string. Sized in CSS by the caller. */
function ringsMarkSvg({ scale = 1, size = 32, className = "brand-mark", label = "DuoQueue" } = {}) {
  const { duoRing, tail, inkRing, weave } = ringShapes(scale);
  const a11y = label ? ` role="img" aria-label="${escapeHtml(label)}"` : ` aria-hidden="true"`;
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 ${MARK_CANVAS} ${MARK_CANVAS}" xmlns="http://www.w3.org/2000/svg"${a11y}>
    ${duoRing}
    ${tail}
    ${inkRing}
    ${weave}
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

// ---------------------------------------------------------------------------
// THE MOMENT LOOP (24 Sept 2026). Each moment card replays its moment on a nine-second
// turn, at every width, because Cameron asked for the three cards to "rerun the animations
// every specific amount of seconds" so the page feels alive rather than finished once.
//
//   0.0 to 2.4s   the moment plays: the same choreography the cards always had, in the
//                 same proportions (see mw() below)
//   2.4 to 8.5s   the finished card holds, 6.1 seconds, long enough to read all of it
//   8.5 to 8.8s   what arrived fades out where it stands
//   8.8 to 9.0s   the opening state fades back in (the zero badge, the rings apart, the
//                 empty composer), and the next turn starts
//
// No jump anywhere in the reset: a piece that has to go back to where it started (a game
// row to the side it came from, a ring to its side) only moves while it is invisible.
// The cards start 0.6s apart (lead, then stagger) so they cascade instead of resetting
// together, and card 01's first turn waits for the cards' own rise on a desktop (300 to
// 687ms) to be over.
//
// Written in seconds here, and turned into keyframe percentages by the three helpers, so a
// change to the turn is a change to one of these numbers and the choreography follows.
// ---------------------------------------------------------------------------
const MOMENT_LOOP = { cycle: 9, play: 2.4, hold: 8.5, out: 8.8, lead: 0.6, stagger: 0.6 };
/** A time within the turn, in seconds, as a keyframe percentage of the turn. */
const loopPct = (s) => `${+((s / MOMENT_LOOP.cycle) * 100).toFixed(3)}%`;
/** A point in a moment's own window (0 to 100, which is how every card's choreography was
 *  first authored, when one window was the whole animation) as its place in the turn. */
const mw = (p) => loopPct((MOMENT_LOOP.play * p) / 100);
const M_HOLD = loopPct(MOMENT_LOOP.hold);
const M_OUT = loopPct(MOMENT_LOOP.out);
/** 10ms after the fade-out: the instant an invisible piece is put back where it started. */
const M_SNAP = loopPct(MOMENT_LOOP.out + 0.01);
const loopDelay = (i) => `${Math.round((MOMENT_LOOP.lead + i * MOMENT_LOOP.stagger) * 1000)}ms`;

/** A piece that ARRIVES during the moment: hidden in `from` until window point `a`, eased to
 *  its resting style (opacity 1, no transform, which is every such piece's resting style) by
 *  `b`, held there until the reset, faded out where it stands, then put back in `from` while
 *  invisible, so the next turn's 0% is exactly this turn's. */
function arriveKeyframes(name, from, a, b, ease) {
  return `@keyframes ${name} {
    0%, ${mw(a)} { opacity: 0; transform: ${from}; animation-timing-function: ${ease}; }
    ${mw(b)}, ${M_HOLD} { opacity: 1; transform: none; }
    ${M_OUT} { opacity: 0; transform: none; }
    ${M_SNAP}, 100% { opacity: 0; transform: ${from}; }
  }`;
}
const EASE_ARRIVE = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_SNAP = "cubic-bezier(0.34, 1.56, 0.64, 1)";

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
    /* The moment cards: the badge's four overlap inks, the sent bubble, the cards' edge and
       their shadow (APP, CARD and CARD_SHADOW_LAYERS in build-site.mjs). */
    --tier-none: ${APP.overlapNone};
    --tier-one: ${APP.overlapOne};
    --tier-two: ${APP.overlapTwo};
    --tier-many: ${APP.amber};
    --bubble-own: ${APP.bubbleOwn};
    --hairline: ${CARD.hairline};
    --card-shadow: ${shadowCss(CARD_SHADOW_LAYERS, SHADOW_INK)};
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
  /* No one-word last lines in a paragraph, where the browser can manage it. Line breaking
     only: no size, no colour, no measure changes. */
  p { text-wrap: pretty; }

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
  header.site-header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 8px 1em; flex-wrap: wrap; }
  .brand { display: inline-flex; align-items: baseline; gap: 0.42em; color: var(--ink); text-decoration: none; }
  .brand .brand-mark { align-self: center; }
  .brand span {
    font-family: ${DISPLAY}; font-weight: 700; font-size: 19px; letter-spacing: 0.02em; line-height: 1;
  }
  .brand:hover { text-decoration: none; }
  /* The links carry 6px above and below, so each is a 30px-tall target rather than a 17px
     line of mono. */
  header.site-header nav { display: flex; gap: 1.3em; flex-wrap: wrap; align-items: center; }
  header.site-header nav a {
    font-family: ${MONO}; font-weight: 600; font-size: 11px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--muted); text-decoration: none; padding: 6px 0;
  }
  header.site-header nav a:hover { color: var(--accent); text-decoration: underline; }
  /* WATCH comes first and in the accent, with a play triangle drawn in SVG rather than typed
     (iOS turns a typed U+25B6 into an emoji). pageShell emits it only where the film is on,
     so it can never point at a watch page that was not built; on the watch page itself it is
     the aria-current link. */
  header.site-header nav a.nav-watch { color: var(--accent); display: inline-flex; align-items: center; gap: 0.5em; }
  .nav-watch svg { width: 8px; height: 9px; fill: currentColor; flex: none; }
  /* On a phone the nav is its own row, spread edge to edge and closed with a hairline, so it
     reads as the site's nav bar rather than as one more mono label sitting on the eyebrow. */
  @media (max-width: 599px) {
    header.site-header nav { width: 100%; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--rule); }
  }

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
  /* THE HERO'S ACCENT WORD IS MARKED, NOT INKED. The app's rule for chartreuse on paper is
     "inks fill, chartreuse marks": the word stays in ink, and chartreuse is laid UNDER it as
     a highlighter stroke. Ink on the stroke is 15.11:1. It is the one place raw chartreuse
     touches the cream, and it is legal there for the reason the design note gives against
     it everywhere else: a chartreuse FILL has no silhouette on this ground (1.05:1), so it
     can never be the thing a reader reads by. Here nothing is read by the stroke; the word
     is read by its ink, and the stroke only says which word matters.
     Scoped to the hero, so the two outcome pages keep their olive accent. If the stroke
     reads as a smudge on a real phone, delete these two rules and "duo" goes back to the
     olive above. The stroke is drawn from its left end (transform-origin) so the motion
     block can swipe it in; at rest it is simply there. */
  .hero .display .key { position: relative; z-index: 0; color: var(--ink); white-space: nowrap; }
  .hero .display .key::after {
    content: ""; position: absolute; z-index: -1;
    left: -0.06em; right: -0.08em; bottom: 0.24em; height: 0.36em;
    background: var(--brand); border-radius: 0.06em;
    transform-origin: 0 50%;
  }

  .lede { font-size: clamp(17px, 2.1vw, 22px); line-height: 1.5; margin: 0 0 0.7em; max-width: 30ch; }
  .sub { color: var(--muted); font-size: clamp(15px, 1.7vw, 18px); margin: 0 0 1.9em; max-width: 38ch; }

  /* ---- hero -------------------------------------------------------------- */
  main { display: block; }
  /* THE HERO GRID IS THREE NAMED AREAS: the type, the form, and the trailer link.
     They are separate grid children so the composition can be re-cut per viewport SHAPE
     rather than only per width. On a phone they stack in reading order, so the link to the
     film sits under the fine print and never between a visitor and the form; from 900px the
     form moves beside the type and the link tucks under the copy column. Same markup, same
     order in the DOM, every cut.

     The product used to be this grid's third area (one card sliced into three plates). It
     is its own section now, the three moment cards under the hero, so the hero ends where
     its form and its link end and the next section pays for the gap. That is why the
     hero's bottom padding is zero at every size: two sections cannot both pay for one
     boundary. */
  section.hero { padding: ${RHYTHM.g2} 0 0; }
  .hero-grid {
    display: grid; grid-template-columns: minmax(0, 1fr); gap: 0;
    grid-template-areas: "copy" "act" "watch";
    align-items: start;
  }
  .hero-copy { grid-area: copy; }
  .hero-act { grid-area: act; }
  .hero-watch { grid-area: watch; margin-top: 26px; }

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
       * a cast shadow in the page's one shadow ink, so it reads as an object sitting on
         the paper rather than as a colour printed into it, and the only coloured one: the
         cards below cast in the same ink but are white (see CTA_SHADOW_LAYERS, and note
         that the guard composites it before measuring the two sentences underneath);
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
    box-shadow: ${shadowCss(CTA_SHADOW_LAYERS, SHADOW_INK)};
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
      box-shadow: ${shadowCss(CTA_SHADOW_HOVER, SHADOW_INK)};
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
    box-shadow: ${shadowCss(CTA_SHADOW_PRESS, SHADOW_INK)};
    transform: scale(0.97);
    transition-duration: var(--t-instant);
  }

  .promise { font-size: 15px; line-height: 1.5; margin: 16px 0 0; max-width: 44ch; }
  .fineprint { font-size: 13.5px; line-height: 1.55; color: var(--muted); margin: 8px 0 0; max-width: 46ch; }

  /* THE LAUNCHED CALL TO ACTION (launchedCta): the same button with the App Store link in
     place of the form, held to the form's 460px, with the promise under it. It is the query
     container for the label's fit, below. */
  .get-app { max-width: 460px; container-type: inline-size; }
  /* THE LABEL FITS ON ONE LINE AT EVERY WIDTH. "Download on the App Store" advances 12.80em in
     Manrope 800 at -0.02em (13.13em in the system fallback), against 7.30em for "join the
     waitlist", measured in headless Chrome. At the button's own size it wrapped onto two lines
     on a 320px phone, on a phone on its side, and at the 32px size a tall desktop gets. So the
     button keeps its size, and with it its height and everything measured against its bottom
     edge, and only the words step down, to whatever fits the button's inside (100cqi of
     .get-app, less the two 1.5px borders and the 0.6em padding each side) at 13.2em, with 2px
     to spare. Both 1em and 1.2em here are the button's own size. A 390px phone gets the full
     size; a 320px one gets 18.9px against 21. */
  .cta-fit { font-size: min(1em, calc((100cqi - 5px - 1.2em) / 13.2)); }

  /* The honeypot. Off-canvas rather than display:none, because some form-filling
     bots skip anything that is not rendered. tabindex, autocomplete and aria-hidden
     on the input itself keep it away from keyboards and screen readers. */
  .hp { position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }

  /* ---- the trailer link -------------------------------------------------- */
  /* THE FILM'S ONLY PRESENCE ON A LANDING PAGE. The launch film used to sit on this page as
     a dark 21-second block that broke the light page's flow, and every visit downloaded
     2.9 MB for it, although most visitors arrive from a video already. It has its own dark
     page now (/watch/, and one per channel), and this is the door to it: a light pill with
     the app's olive play disc, the words, and the running time, so the cost of the tap is
     on the label. The guard measures each colour where it really sits: the ink label and
     the muted running time on the link's own fill (TRAILER_FILL, white at
     TRAILER_FILL_ALPHA over the ground), and the play glyph, onVolt, on its volt disc.
     48px tall, a comfortable target. */
  .trailer {
    display: inline-flex; align-items: center; gap: 12px;
    min-height: 48px; padding: 7px 18px 7px 7px;
    background: rgba(${hexToRgb(INK.field).join(",")},${TRAILER_FILL_ALPHA}); border: 1px solid var(--rule); border-radius: 999px;
    color: var(--ink); text-decoration: none;
    font-weight: 700; font-size: 15px; line-height: 1.2;
    transition:
      border-color var(--t-quick) ease,
      transform var(--t-base) var(--ease-out),
      box-shadow var(--t-base) var(--ease-out);
  }
  .trailer-play {
    flex: none; width: 34px; height: 34px; border-radius: 999px; background: var(--app-volt);
    display: grid; place-items: center;
  }
  .trailer-play svg { width: 13px; height: 14px; margin-left: 2px; fill: var(--app-on-volt); display: block; }
  .trailer-time {
    font-family: ${MONO}; font-weight: 600; font-size: 12px;
    letter-spacing: 0.08em; color: var(--muted);
    padding-left: 12px; border-left: 1px solid var(--rule);
  }
  .trailer:hover { text-decoration: none; border-color: var(--accent); }
  /* Gated like the button's lift, because a touch device fires a false :hover on tap. */
  @media (hover: hover) and (pointer: fine) {
    .trailer:hover { transform: translate3d(0, -1px, 0); box-shadow: 0 10px 22px -12px rgba(${SHADOW_INK.join(",")},0.35); }
  }
  .trailer:active { transform: scale(0.97); transition-duration: var(--t-instant); }

  /* ---- what you are joining: three moment cards -------------------------- */
  /* THREE CARDS OF ONE SIZE, AND THAT IS THE WHOLE FIX. What was here was three cut-out
     fragments of different widths under heavy tilted shadows: the "chopped" look, because
     nothing in an arrangement of differently sized objects relates one to the next. These
     three agree about everything a frame can agree about: the same width, the same corner,
     the same soft shadow, and an inner screen of the same height whatever it holds. So they
     read as three frames of one sequence (match, lock, talk: the hero sub's own sentence)
     rather than as three pictures. grid-auto-rows: 1fr holds the heights equal in the
     stacked cut too, where each card would otherwise be as tall as its own sentence.

     The shadow is small on purpose (CARD_SHADOW_LAYERS). A card is furniture resting on
     the paper, not an object arriving at the reader. */
  section.moments { padding: ${SECTION_GAP} 0 0; }
  /* The heading, the pause control and the list are siblings in one grid, the heading and
     the control on the first row, so the control's :checked can reach the cards with a
     sibling selector (see THE PAUSE CONTROL) in every browser, :has() or not. The grid is
     as wide as the list, so the control's right edge is the cards' right edge. */
  .moments-inner {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 16px;
    max-width: 480px;
  }
  .moments-inner > .eyebrow { grid-column: 1; grid-row: 1; margin: 0; }
  .moment-list {
    grid-column: 1 / -1; grid-row: 2;
    list-style: none; margin: clamp(16px, 2.2vw, 26px) 0 0; padding: 0;
    display: grid; grid-template-columns: minmax(0, 1fr); grid-auto-rows: 1fr; gap: 16px;
  }

  /* THE PAUSE CONTROL. The cards replay their moments on a loop, and WCAG 2.2.2 asks that
     anything moving for more than five seconds can be paused, so this is that, with no script:
     a real checkbox, laid invisibly over its label so the checkbox itself is the 44px-tall tap
     target and the thing a screen reader's cursor lands on, and the label drawn as a small pill
     in the trailer link's language (the same fill, hairline and ink, which the guard measures).
     It reads "Pause" with a pause glyph, and "Play" with a play glyph once checked, and the
     word not on screen is hidden (display for the glyphs, visibility for the words), so the
     accessible name is always the word on screen.
     Checked, every card's moving pieces lose their animation outright, which leaves each one
     in its resting style, and the resting style is the finished card. Unchecked again, the
     loop starts over from each card's first turn.
     The negative margins keep the pill and its tap target from making the heading's row any
     taller than the heading: they overhang the section's top padding and the list's margin.
     Under Reduce Motion nothing loops, so the control is not there at all. */
  .pause-box {
    grid-column: 2; grid-row: 1; z-index: 1; position: relative;
    width: 100%; height: 44px; margin: -11px 0; padding: 0; border: 0;
    appearance: none; -webkit-appearance: none; background: none; opacity: 0; cursor: pointer;
  }
  .pause {
    grid-column: 2; grid-row: 1;
    display: inline-flex; align-items: center; gap: 7px;
    height: 30px; margin: -4px 0; padding: 0 12px 0 11px;
    background: rgba(${hexToRgb(INK.field).join(",")},${TRAILER_FILL_ALPHA}); border: 1px solid var(--rule); border-radius: 999px;
    font-family: ${MONO}; font-weight: 600; font-size: 11px; line-height: 1; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--ink); white-space: nowrap;
    transition: border-color var(--t-quick) ease, transform var(--t-base) var(--ease-out);
  }
  .pause svg { display: block; flex: none; width: 9px; height: 10px; fill: currentColor; }
  /* The two words share one grid cell, so the pill is as wide as "Pause" in both states and
     does not jump under the pointer when it is pressed. The word not in use is
     visibility:hidden, which also keeps it out of the accessible name. */
  .pause .pw { display: grid; }
  .pause .pw > span { grid-area: 1 / 1; text-align: center; }
  .pause .is-play { display: none; }
  .pause .pw .w-play { visibility: hidden; }
  #moments-pause:checked + .pause .is-pause { display: none; }
  #moments-pause:checked + .pause .is-play { display: block; }
  #moments-pause:checked + .pause .pw .w-pause { visibility: hidden; }
  #moments-pause:checked + .pause .pw .w-play { visibility: visible; }
  #moments-pause:focus-visible + .pause { outline: 3px solid var(--accent); outline-offset: 2px; }
  @media (hover: hover) and (pointer: fine) {
    #moments-pause:hover + .pause { border-color: var(--accent); }
  }
  #moments-pause:active + .pause { transform: scale(0.97); transition-duration: var(--t-instant); }
  .moment-card {
    height: 100%; display: flex; flex-direction: column;
    background: var(--app-surface); border: 1px solid var(--hairline); border-radius: 14px;
    box-shadow: var(--card-shadow);
  }
  /* The screen inside each card: the app's own background, ONE fixed height, and the moment
     centred in it. It is the query container the chips size themselves against. */
  .stage {
    container-type: inline-size;
    margin: 7px 7px 0; height: 214px; padding: 14px;
    border-radius: 9px; background: var(--app-bg); border: 1px solid ${CARD.stageEdge};
    display: flex; flex-direction: column; justify-content: center;
    overflow: hidden; overflow: clip;
  }
  .moment-line {
    margin: 0; padding: 14px 18px 18px;
    font-weight: 700; font-size: 16.5px; line-height: 1.38; letter-spacing: -0.01em; color: var(--ink);
    text-wrap: balance;
  }
  /* The index is the app's type.tick, its face for "timestamps, statuses, counters, index
     marks", in the accent: it says the three cards are a sequence. */
  .moment-line .no {
    display: block; margin-bottom: 6px;
    font-family: ${MONO}; font-weight: 600; font-size: 11px; letter-spacing: 0.16em; color: var(--accent);
  }

  /* 01: THE GAMES, AND THE OVERLAP READ THE APP DRAWS FROM THEM.
     Chip.tsx's sharp 3px mono tag, full width so three rows stack like a profile's games,
     with the skill level after a middle dot. The detail is plain app muted on white; it
     used to carry a 0.8 opacity that took it to 3.91:1, under AA, and it no longer does.
     The badge is SwipeCard.tsx's overlapLabel() in overlapBucket()'s four inks. All four
     counts are in the markup, stacked in one grid cell: the finished count is the resting
     style, and the three before it are invisible and aria-hidden until the motion block
     counts up through them. Mono and nowrap, so the cell is as wide as the longest label
     and the badge never changes width while it counts. */
  .chips { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .chip {
    display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
    background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 3px;
    padding: 0.62em 0.75em; line-height: 1.2;
    font-size: 12px;
    font-size: clamp(10px, 4.5cqi, 13px);
  }
  .chip b {
    font-family: ${MONO}; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--app-text); white-space: nowrap;
  }
  .chip i { font-style: normal; font-size: 1.04em; color: var(--app-muted); white-space: nowrap; }
  .overlap {
    display: grid; margin-top: 10px; padding: 0.62em 0.75em;
    border: 1px solid var(--tier-many); border-radius: 3px; background: var(--app-surface);
    font-family: ${MONO}; font-weight: 600; line-height: 1.2; letter-spacing: 0.08em; white-space: nowrap;
    font-size: 12.5px;
    font-size: clamp(10.5px, 4.8cqi, 14px);
    transform-origin: 0 50%;
  }
  .overlap > span { grid-area: 1 / 1; }
  .overlap .t0 { color: var(--tier-none); opacity: 0; }
  .overlap .t1 { color: var(--tier-one); opacity: 0; }
  .overlap .t2 { color: var(--tier-two); opacity: 0; }
  .overlap .t3 { color: var(--tier-many); }

  /* 02: THE MATCH SCREEN, app/match/[matchId].tsx, the one moment the app exists to produce.
     The app's two volt bracket glyphs close around the logo's own two rings, which are drawn
     from ringGeometry() in three layers so they can slide in from either side and interlock
     (see lockinSvg()). DUO LOCKED is the screen's label at the app's 0.1875em tracking, and
     the line under it is the screen's own fallback wording, because no card on this site
     carries a real person. */
  .lockin { display: flex; align-items: center; justify-content: center; gap: 4px; }
  .lockin .br { font-family: ${MONO}; font-weight: 600; font-size: 58px; line-height: 0.74; color: var(--app-volt); }
  .lockin svg { display: block; width: 98px; height: auto; overflow: visible; }
  .lock {
    margin: 14px 0 2px; text-align: center;
    font-family: ${MONO}; font-weight: 600; font-size: 14px; line-height: 1.375;
    letter-spacing: 0.1875em; text-indent: 0.1875em; text-transform: uppercase; color: var(--app-volt);
  }
  .both { margin: 0; text-align: center; font-size: 14px; line-height: 1.45; color: var(--app-text); }

  /* 03: THEN YOU TALK, app/chat/[matchId].tsx. An incoming bubble, the sent one in the app's
     own bubbleOwn, and the composer: a surfaceAlt field with the app's placeholder and the
     round volt send button. The typed message sits in the field at rest, invisible, for the
     motion block to type in; the finished chat is the resting style. */
  .stage.talk { justify-content: flex-end; }
  .chat { display: flex; flex-direction: column; gap: 6px; margin-top: auto; }
  .bubble { margin: 0; max-width: 80%; padding: 7px 12px; font-size: 14.5px; line-height: 1.35; border-radius: 13px; color: var(--app-text); }
  .bubble.in { align-self: flex-start; background: var(--app-surface); border: 1px solid var(--app-border); border-bottom-left-radius: 4px; }
  .bubble.out { align-self: flex-end; background: var(--bubble-own); border: 1px solid ${CARD.bubbleOwnEdge}; border-bottom-right-radius: 4px; }
  .composer { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .composer .box {
    position: relative; flex: 1; min-width: 0;
    background: var(--app-alt); border: 1px solid var(--app-border); border-radius: 6px;
    padding: 9px 12px; font-size: 14.5px; line-height: 1.35; color: var(--app-muted);
  }
  .composer .typed { position: absolute; left: 12px; top: 9px; color: var(--app-text); opacity: 0; white-space: nowrap; }
  .composer .send {
    flex: none; width: 38px; height: 38px; border-radius: 999px; background: var(--app-volt);
    display: grid; place-items: center;
  }
  .composer .send svg { display: block; width: 18px; height: 18px; }

  /* From 720 to 1079 each card lies on its side, screen left and sentence right, so three
     cards do not become three narrow columns on a tablet. From 1080 they stand in a row of
     three and share the field between them. */
  @media (min-width: 720px) and (max-width: 1079px) {
    .moments-inner { max-width: 760px; }
    .moment-card { flex-direction: row; align-items: center; }
    .stage { flex: none; width: 320px; margin: 7px; }
    .moment-line { padding: 20px 28px 20px 22px; font-size: 20px; }
  }
  @media (min-width: 1080px) {
    .moments-inner { max-width: none; }
    .moment-list { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(16px, 1.8vw, 26px); }
    .moment-line { font-size: 17px; }
  }

  /* ---- the plain version ------------------------------------------------- */
  /* Each item hangs from a hairline rule with a short olive tick at its left end. Both are
     pseudo-elements anchored at their left end (transform-origin), so the motion block can
     draw them across without the markup knowing; at rest they are simply there. The tick
     is a graphic in the accent, which is the accent-on-ground pair the guard already
     measures, against the 3.0 a graphic needs. */
  section.plain { padding: ${SECTION_GAP} 0; }
  /* A plain section that follows another starts at the first one's bottom padding: two
     sections cannot each pay for the same boundary. On the root page that is the support
     block after the plain version. */
  section.plain + section.plain { padding-top: 0; }
  .plain-list { display: grid; grid-template-columns: 1fr; gap: clamp(20px, 3.2vw, 36px); margin: 0; padding: 0; list-style: none; }
  .plain-list li { position: relative; padding-top: clamp(14px, 2vw, 22px); }
  .plain-list li::before {
    content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px;
    background: var(--rule); transform-origin: 0 50%;
  }
  .plain-list li::after {
    content: ""; position: absolute; left: 0; top: -1px; width: 28px; height: 3px;
    background: var(--accent); transform-origin: 0 50%;
  }
  .plain-list h3 {
    font-family: ${SANS}; font-weight: 800; font-size: 20px; letter-spacing: -0.02em;
    margin: 0 0 6px; color: var(--ink); text-wrap: balance;
  }
  .plain-list p { margin: 0; color: var(--muted); font-size: 15.5px; line-height: 1.55; max-width: 42ch; }

  /* JOIN AGAIN, after the plain version. The big closing end card's only working part was a
     second button that jumped back to the form; this is that button without the end card
     around it, and deliberately quieter than the hero's: outlined rather than filled, so
     the page keeps exactly one loud call to action. Volt type on the paper is the
     accent-on-ground pair; hover fills it with the button's own volt and onVolt, and the
     press is the app's scale(0.97). 44px tall for the touch target. */
  .again { margin: clamp(28px, 4vw, 44px) 0 0; }
  .cta-ghost {
    display: inline-flex; align-items: center; gap: 0.45em;
    min-height: 44px; padding: 0 16px;
    border: 1.5px solid var(--app-volt); border-radius: 6px;
    background: transparent; color: var(--app-volt); text-decoration: none;
    font-family: ${SANS}; font-weight: 800; font-size: 16px; line-height: 1.2; letter-spacing: -0.01em;
    transition:
      background-color var(--t-quick) ease,
      border-color var(--t-quick) ease,
      color var(--t-quick) ease,
      transform var(--t-base) var(--ease-out);
  }
  @media (hover: hover) and (pointer: fine) {
    .cta-ghost:hover { background: var(--app-volt); color: var(--app-on-volt); text-decoration: none; }
  }
  .cta-ghost:active {
    background: var(--app-volt-dim); border-color: var(--app-volt-dim); color: var(--app-on-volt);
    transform: scale(0.97); transition-duration: var(--t-instant);
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

  /* THE SUPPORT CARD, in the moment cards' language rather than a style of its own: the same
     white surface, hairline, 14px corner and soft shadow. Full width; from 900px the heading
     sits in a narrow left column with the text beside it (see the wide-viewport block). The
     text is what App Review reads at the Support URL, and it is unchanged. */
  section.card {
    background: var(--app-surface); border: 1px solid var(--hairline); border-radius: 14px;
    box-shadow: var(--card-shadow);
    padding: clamp(20px, 3vw, 36px); margin: 0;
  }
  section.card h2 {
    font-family: ${SANS}; font-weight: 800; font-size: 22px; letter-spacing: -0.02em; line-height: 1.3;
    margin: 0 0 10px;
  }
  section.card p { margin: 0 0 0.9em; font-size: 16px; line-height: 1.6; max-width: 62ch; }
  section.card p:last-child { margin-bottom: 0; }

  /* ---- footer ------------------------------------------------------------ */
  footer.site-footer { border-top: 1px solid var(--rule); padding: ${RHYTHM.g1} 0 ${RHYTHM.g3}; color: var(--muted); font-size: 13.5px; }
  footer.site-footer nav { margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; }
  footer.site-footer a { color: var(--muted); }
  footer.site-footer a:hover { color: var(--accent); }

  /* ---- the queue bar ----------------------------------------------------- */
  /* THE CLOSING LOCKUP'S ONE JOB, DONE FROM THE TOP OF THE SCREEN. The lockup's only working
     part was a second button that jumped back to the form, once, at the bottom of the page.
     This slim bar does that job at every scroll position after the hero's call to action has
     left the screen: the logo, and the call to action again in the app's own primary button
     (volt fill, onVolt label, radius.button, the scale(0.97) press, the button's contact
     shadow). Before launch that is "join the waitlist", jumping back up to the form; once
     PHASE is "launched" it is "Download on the App Store", straight to the listing, and it
     watches #get-app (the download button and the line under it) instead of the form.

     It is display:none here, and it only exists inside the scroll-timeline block in MOTION
     below, and only on a page that has the hero's call to action. Without a scroll timeline
     there is no way to show it only once that has gone (there is no script to watch the
     scroll), and a bar that sat over the hero's own button would be worse than no bar, so in
     a browser without one it stays display:none and the hero's button and the outlined link
     after the plain version are the page's calls to action.
     A page with the bar and neither #waitlist-form nor #get-app needs its own rule, because
     the timeline support check cannot see it: with nothing to watch there is no --act
     timeline, the bar's animation is inactive and has no effect, and the bar would sit at
     its resting style in that block, fixed and visible at every scroll position, over the
     site header at the top of the page. So that block also hides it on any such page. Its
     markup is emitted on the landing pages only (pageShell's qbar option, qbarHtml()); the
     guard is there so that a page that forgets costs nothing. */
  .qbar { display: none; }
  .qbar-in { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 58px; }
  .qbar .brand span { font-size: 17px; }
  .qbar-cta {
    display: inline-flex; align-items: center; gap: 8px;
    min-height: 40px; padding: 0 14px;
    background: var(--app-volt); color: var(--app-on-volt); border-radius: 6px; /* radius.button */
    text-decoration: none;
    font-family: ${SANS}; font-weight: 800; font-size: 15px; line-height: 1.2; letter-spacing: -0.01em;
    box-shadow: ${shadowCss(CTA_SHADOW_LAYERS.slice(0, 1), SHADOW_INK)};
    transition:
      background-color var(--t-quick) ease,
      transform var(--t-base) var(--ease-out);
  }
  .qbar-cta:hover { background: var(--app-volt-dim); text-decoration: none; }
  .qbar-cta:active { background: var(--app-volt-dim); transform: scale(0.97); transition-duration: var(--t-instant); }
  .qbar-cta svg { width: 15px; height: 15px; display: block; }
  /* Once launched the bar's button says "Download on the App Store", which does not fit
     beside the logo on a phone: at 320px the bar has 280px, and the logo and the whole label
     need about 380. So below 480px the words after "Download" are dropped from view (the
     link's aria-label still carries all of them), and from 480px the bar has the room. */
  @media (max-width: 479.98px) {
    .qbar-more { display: none; }
  }

  /* =======================================================================
     MOTION
     =======================================================================

     WHAT THIS IS FOR. A visitor lands here from an eighteen-second film in which nothing
     ever fades: type builds forward out of the page, and objects arrive rotated and
     oversized under blur and unwind. The page's first frame should be the film's next
     frame. The hero's entrance makes that argument, and nothing else below does. The
     moment cards (which rise in once and then act out the app's three moments on a loop),
     the plain version's rules (which draw across) and the queue bar (which slides in once
     the hero's call to action has gone) each have a job of their own, stated where they are.

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
       * THE PLAIN VERSION'S WORDS DO NOT REVEAL ON SCROLL. They are three paragraphs about
         18+, platonic, and everyone starting together, and the whole point of that block is
         that it is plain, so its type is simply there. Only its rules move: each hairline
         draws across as its item comes up the screen, then its short olive tick. Those are
         graphics, not words.
     And only one thing repeats: the three moments inside the cards, which replay on a
     nine-second turn (MOMENT_LOOP in build-site.mjs) and can be paused by the control
     beside their heading. Every other piece below plays once, settles, and stays still.

     THE RULE THAT MAKES ALL OF IT SAFE: every to-state below is identical to the element's
     resting style, and every one-time animation is fill-mode BACKWARDS. So the resting style
     is the truth and the animation is a displacement in front of it, which means an element
     that is never animated - reduced motion, the pause control, an older browser, a scroll
     timeline that never runs - renders correct and complete. Nothing on this page is hidden
     by a base rule waiting for an animation to reveal it.

     The one refinement: the SCROLL-SCRUBBED animations (the cards' rise below 860px, the
     plain version's rules, the queue bar) fill BOTH ways. Their forwards fill is their 100%
     keyframe, which is the resting style, so it changes nothing a reader can see except one
     thing, measured: with backwards only, Chrome can leave a stale composited value behind
     when a scrubbed opacity animation passes into its after phase. Scrolled past card 02, its
     "both queued up" line stayed at about a third of its opacity while its computed style
     said 1; loaded at the same scroll position it was solid. Filling forwards means the
     animation itself holds the finished value, so there is no hand-off to go stale.

     The moment cards' in-between states (the badge's lower counts, the half-typed message)
     are the other way round: hidden and aria-hidden at rest, and only ever shown by an
     animation passing through them.

     THE MOMENT CARDS ARE TWO ANIMATIONS, and only the inner one loops (24 Sept 2026).
       * THE CARD RISES IN ONCE, on the driver that suits the width, split at 860px. Below
         860 (phones and portrait tablets: the hero is one column and the cards stack under
         it) it is scrubbed by the card's own passage up the screen, on a view timeline, and
         is complete at entry 65%. From 860 it is a load sequence at 300, 360 and 420ms,
         because from 1080 the three cards' top edge is on the first screen at scroll 0
         (66px of each card at 1080x700, 124px at 1280x800, 214px at 1440x900, 281px at
         1920x1080), and a scroll timeline there would sit wherever the fold cut it.
       * THE MOMENT INSIDE IT LOOPS, on a clock, at every width: a nine-second turn per card
         (2.4s of moment, a 6.1s hold on the finished card, a 0.5s fade back to the start),
         the cards 0.6s apart. Until 24 Sept 2026 the moment played once (scrubbed on a phone,
         in a 3.0s load sequence on a desktop) and the page was then still; now the moments
         keep being acted out while anyone is looking. The turn is MOMENT_LOOP in
         build-site.mjs, and the keyframes are written against it.
     WCAG 2.2.2: moving content that lasts more than five seconds must be pausable, so the
     heading carries a Pause control (a checkbox, no script) that stops every moment on its
     finished card. Scroll timelines are Chrome 115+ and Safari 26+; below 860, a browser
     without them shows the cards without their rise. Under Reduce Motion nothing moves and
     every card is finished, at every width. */

  /* Type, and blocks of it. The film spends a word's travel on Z rather than Y: "the word
     comes FORWARD out of the page, which is what a scale from 0.35 under a blur reads as,
     where a vertical lift reads as a slide-up preset". Same axis here at a page-sized
     amplitude - 70px of Z under a 900px perspective is a 7% approach - plus 10px of lift. */
  @keyframes rise {
    from { opacity: 0; transform: perspective(900px) translate3d(0, 10px, -70px); }
    to   { opacity: 1; transform: perspective(900px) translate3d(0, 0, 0); }
  }

  /* ---- the hero, on load ------------------------------------------------- */
  /* 60ms between blocks. The film's own cadence is 4.5 frames, 150ms, which is right for
     four words of a headline arriving one at a time and far too slow for six stacked
     blocks: it would put the trailer link 900ms behind the eyebrow. 60ms is inside the
     30-80ms a group entrance is allowed, and the whole hero has landed 567ms after first
     paint. The button is usable for every one of those milliseconds - an element at
     opacity 0 still takes the pointer, and nothing here is display:none or
     visibility:hidden. */
  .hero-copy .eyebrow,
  .hero-copy h1.display,
  .hero-copy .lede,
  .hero-copy .sub,
  .hero-act,
  .hero-watch {
    animation: rise var(--t-arrival) var(--ease-out) backwards;
  }
  .hero-copy h1.display { animation-delay: 60ms; }
  .hero-copy .lede      { animation-delay: 120ms; }
  .hero-copy .sub       { animation-delay: 180ms; }
  .hero-act             { animation-delay: 240ms; }
  .hero-watch           { animation-delay: 300ms; }

  /* The highlighter goes on after the headline has landed (60 + 267 = 327ms): one stroke
     from the left end, 460ms on the in-out curve a hand-drawn mark has, starting at 360ms.
     At rest the stroke is simply there. */
  @keyframes mark-swipe {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  .hero .display .key::after { animation: mark-swipe 460ms cubic-bezier(0.65, 0, 0.35, 1) 360ms backwards; }

  /* ---- the moment cards -------------------------------------------------- */
  /* The card itself rises in once. Below 860 it is carried up the screen by a thumb; the
     load version from 860 travels less, because it is an entrance on a still page. */
  @keyframes card-in {
    from { opacity: 0; transform: translateY(32px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes card-rise {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: none; }
  }

  /* THE MOMENTS, ONE NINE-SECOND TURN EACH (MOMENT_LOOP in build-site.mjs). Every keyframe
     is written as a point in the moment's own window, mw(0) to mw(100), which is the first
     2.4s of the turn: the same proportions the choreography was authored in, so the pieces
     keep their timing against each other. After the window the finished card holds until
     M_HOLD (8.5s), whatever arrived fades out where it stands by M_OUT (8.8s), and anything
     that must go back to where it started moves only at M_SNAP, while it is invisible. The
     turn itself runs linear; each step carries its own curve. arriveKeyframes() writes the
     pieces that simply arrive and leave. */

  /* 01. The three game rows land from alternating sides, and the badge counts up in the
     app's own words and overlap inks as each one lands. The chips ease out, so each reads
     as landed about 60% of the way through its own slot, and that is where the count
     steps: 20%, 40%, 60%. Then the badge stamps once. In the reset the rows and the
     count fade out together, the badge's edge goes back to grey, and NO GAMES IN COMMON
     fades back in. */
  ${arriveKeyframes("chip-a", "translateX(-40px)", 4, 28, EASE_ARRIVE)}
  ${arriveKeyframes("chip-b", "translateX(40px)", 24, 48, EASE_ARRIVE)}
  ${arriveKeyframes("chip-c", "translateX(-40px)", 44, 68, EASE_ARRIVE)}
  @keyframes t0 { 0%, ${mw(19.9)} { opacity: 1; } ${mw(20)}, ${M_OUT} { opacity: 0; } 100% { opacity: 1; } }
  @keyframes t1 { 0%, ${mw(19.9)} { opacity: 0; } ${mw(20)}, ${mw(39.9)} { opacity: 1; } ${mw(40)}, 100% { opacity: 0; } }
  @keyframes t2 { 0%, ${mw(39.9)} { opacity: 0; } ${mw(40)}, ${mw(59.9)} { opacity: 1; } ${mw(60)}, 100% { opacity: 0; } }
  @keyframes t3 { 0%, ${mw(59.9)} { opacity: 0; } ${mw(60)}, ${M_HOLD} { opacity: 1; } ${M_OUT}, 100% { opacity: 0; } }
  @keyframes tier {
    0%, ${mw(19.9)}         { border-color: ${APP.overlapNone}; }
    ${mw(20)}, ${mw(39.9)}  { border-color: ${APP.overlapOne}; }
    ${mw(40)}, ${mw(59.9)}  { border-color: ${APP.overlapTwo}; }
    ${mw(60)}, ${M_HOLD}    { border-color: ${APP.amber}; }
    ${M_OUT}, 100%          { border-color: ${APP.overlapNone}; }
  }
  @keyframes stamp { 0%, ${mw(60)} { transform: none; } ${mw(66)} { transform: scale(1.05); } ${mw(78)}, 100% { transform: none; } }

  /* 02. The logo's two rings slide in from either side and interlock, the brackets snap shut
     with a small overshoot, DUO LOCKED stamps in, then its line comes up. The rings travel
     190 user units, about 21px at the mark's 98px. In the reset everything fades out, and
     the rings, parted while invisible, fade back in apart for the next lock. */
  @keyframes ring-ink {
    0%, ${mw(4)}         { opacity: 1; transform: translateX(-190px); animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1); }
    ${mw(46)}, ${M_HOLD} { opacity: 1; transform: none; }
    ${M_OUT}             { opacity: 0; transform: none; }
    ${M_SNAP}            { opacity: 0; transform: translateX(-190px); }
    100%                 { opacity: 1; transform: translateX(-190px); }
  }
  @keyframes ring-duo {
    0%, ${mw(4)}         { opacity: 1; transform: translateX(190px); animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1); }
    ${mw(46)}, ${M_HOLD} { opacity: 1; transform: none; }
    ${M_OUT}             { opacity: 0; transform: none; }
    ${M_SNAP}            { opacity: 0; transform: translateX(190px); }
    100%                 { opacity: 1; transform: translateX(190px); }
  }
  ${arriveKeyframes("br-l", "translateX(-0.7em)", 40, 60, EASE_SNAP)}
  ${arriveKeyframes("br-r", "translateX(0.7em)", 40, 60, EASE_SNAP)}
  ${arriveKeyframes("lock-in", "scale(1.25)", 52, 68, EASE_ARRIVE)}
  ${arriveKeyframes("line-in", "translateY(6px)", 62, 80, "linear")}

  /* 03. "you on tonight?" arrives, the reply types into the box in fifteen steps (one per
     character of "yep, queue at 9"), send presses, the sent bubble comes up and the box
     goes back to its placeholder. In the reset the two bubbles fade out, leaving the empty
     chat and its placeholder the next turn starts from. */
  ${arriveKeyframes("bubble-in", "translateY(10px) scale(0.96)", 4, 20, EASE_ARRIVE)}
  @keyframes ph { 0%, ${mw(23.9)} { opacity: 1; } ${mw(24)}, ${mw(61.9)} { opacity: 0; } ${mw(62)}, 100% { opacity: 1; } }
  @keyframes typing {
    0%, ${mw(24)}           { opacity: 1; clip-path: inset(0 100% 0 0); animation-timing-function: steps(15, end); }
    ${mw(50)}, ${mw(59.9)}  { opacity: 1; clip-path: inset(0 0 0 0); }
    ${mw(60)}, 100%         { opacity: 0; clip-path: inset(0 0 0 0); }
  }
  @keyframes press { 0%, ${mw(53)} { transform: none; } ${mw(57)} { transform: scale(0.84); } ${mw(62)}, 100% { transform: none; } }
  ${arriveKeyframes("bubble-out", "translateY(12px) scale(0.94)", 60, 76, EASE_ARRIVE)}

  /* The plain version's rules. */
  @keyframes rule-draw {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }

  /* THE LOOP, at every width: which moment each moving piece (class sd) plays, on one
     nine-second clock, forever, the three cards 0.6s apart (loopDelay). Fill backwards, so
     before its first turn a card shows its opening state rather than flashing the finished
     one. There is no fill forwards to think about: an infinite animation never ends. The
     pause control's rule (THE PAUSE CONTROL, just after) and Reduce Motion both take the
     animation away entirely, which leaves every piece in its resting style: the finished
     card. */
  @media (prefers-reduced-motion: no-preference) {
    .sd {
      animation-duration: ${MOMENT_LOOP.cycle}s;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
      animation-fill-mode: backwards;
    }
    .m1 .sd { animation-delay: ${loopDelay(0)}; }
    .m2 .sd { animation-delay: ${loopDelay(1)}; }
    .m3 .sd { animation-delay: ${loopDelay(2)}; }
    .m1 .chip:nth-child(1) { animation-name: chip-a; }
    .m1 .chip:nth-child(2) { animation-name: chip-b; }
    .m1 .chip:nth-child(3) { animation-name: chip-c; }
    .m1 .overlap { animation-name: tier, stamp; }
    .m1 .t0 { animation-name: t0; }
    .m1 .t1 { animation-name: t1; }
    .m1 .t2 { animation-name: t2; }
    .m1 .t3 { animation-name: t3; }
    .m2 .ring-ink { animation-name: ring-ink; }
    .m2 .ring-duo { animation-name: ring-duo; }
    .m2 .br-l { animation-name: br-l; }
    .m2 .br-r { animation-name: br-r; }
    .m2 .lock { animation-name: lock-in; }
    .m2 .both { animation-name: line-in; }
    .m3 .bubble.in { animation-name: bubble-in; }
    .m3 .ph { animation-name: ph; }
    .m3 .typed { animation-name: typing; }
    .m3 .send { animation-name: press; }
    .m3 .bubble.out { animation-name: bubble-out; }
  }
  /* PAUSED: the checkbox beside the heading is checked. An id and a sibling combinator, so it
     outranks every rule above that names an animation, and it works in a browser without
     :has(). Taking the animation away (not pausing it mid-move) is the point: the resting
     style is the finished card, so a paused card is always a whole one. */
  #moments-pause:checked ~ .moment-list .sd { animation: none; }

  /* THE CARD'S RISE, below 860px: the card's own passage up the screen, over the first 65%
     of its entry. Only the rise is scrubbed; the moment inside loops on its clock. */
  @supports (animation-timeline: view()) and (animation-range: entry) {
    @media (prefers-reduced-motion: no-preference) and (max-width: 859.98px) {
      .moment { view-timeline: --moment; view-timeline-inset: 0; }
      .moment-card {
        animation-name: card-in; animation-fill-mode: both; animation-timing-function: var(--ease-out);
        animation-timeline: --moment; animation-range: entry 0% entry 65%;
      }
    }
    /* The plain version's hairlines draw across as each item comes up, then the olive tick,
       at every width: they are below the first screen everywhere. */
    @media (prefers-reduced-motion: no-preference) {
      .plain-list li { view-timeline: --plain; view-timeline-inset: 0; }
      .plain-list li::before {
        animation: rule-draw linear both;
        animation-timeline: --plain; animation-range: entry 30% contain 25%;
      }
      .plain-list li::after {
        animation: rule-draw linear both;
        animation-timeline: --plain; animation-range: entry 70% contain 40%;
      }
    }
  }

  /* THE CARD'S RISE, from 860px: once, on load, at 300, 360 and 420ms, over before card 01's
     first turn starts at 600ms. */
  @media (prefers-reduced-motion: no-preference) and (min-width: 860px) {
    .moment-card { animation: card-rise var(--t-arrival) var(--ease-out) backwards; }
    .moment:nth-child(1) .moment-card { animation-delay: 300ms; }
    .moment:nth-child(2) .moment-card { animation-delay: 360ms; }
    .moment:nth-child(3) .moment-card { animation-delay: 420ms; }
  }

  /* ---- the queue bar, on the hero's call to action's own timeline --------- */
  /* The bar watches the hero's call to action: the form before launch (#waitlist-form), the
     download button and its line after it (#get-app). One page only ever has one of the
     two. body's timeline-scope lifts its view timeline, --act, up to where a bar outside
     <main> can see it, and the range starts at exit 100%: the scroll position at which its
     last pixel has gone off the top of the screen. So the bar can never sit over the hero's
     own button, and it slides down over the next 72px of scrolling, a little more than its
     own height. Scroll back until that bottom edge returns and it slides away again. Chrome
     and Safari 26+; elsewhere the bar is absent, and so it is on any page without either
     (the last rule in this block: nothing to watch, no timeline to show the bar on, so no
     bar).

     scroll-padding keeps what a keyboard focuses, or an in-page link jumps to, out from
     under the bar. It is scoped with :has(.qbar):has(#waitlist-form, #get-app) to the pages
     where the bar can show, so the privacy, terms and waitlist result pages (which share
     this CSS and have no bar) keep their jumps at the real top of the screen; every browser
     with timeline-scope also has :has. It has a side effect that every view timeline on the
     page has to undo:
     a view timeline's default inset ("auto") IS the scroll-padding, so without an explicit
     view-timeline-inset of 0 the call to action's exit 100% would fall 72px early, with its
     button still on screen, and the bar would slide over it. That is why the call to action,
     the moment cards and the plain version's items all declare view-timeline-inset: 0:
     their ranges are measured against the real edges of the screen. */
  @keyframes qbar-in {
    from { transform: translateY(-100%); visibility: hidden; }
    to   { transform: none; visibility: visible; }
  }
  @keyframes qbar-show {
    from { visibility: hidden; }
    to   { visibility: visible; }
  }
  @supports (timeline-scope: --act) and (animation-timeline: view()) and (animation-range: exit) {
    body { timeline-scope: --act; }
    #waitlist-form, #get-app { view-timeline: --act; view-timeline-inset: 0; }
    html:has(.qbar):has(#waitlist-form, #get-app) { scroll-padding-top: 72px; }
    .qbar {
      display: block; position: fixed; z-index: 30; top: 0; left: 0; right: 0;
      background: rgba(${hexToRgb(GROUND.base).join(",")},${QBAR_ALPHA});
      -webkit-backdrop-filter: saturate(1.4) blur(14px); backdrop-filter: saturate(1.4) blur(14px);
      border-bottom: 1px solid var(--rule);
      animation-name: qbar-in; animation-fill-mode: both; animation-timing-function: linear;
      animation-timeline: --act; animation-range: exit 100% exit calc(100% + 72px);
    }
    /* Reduce Motion: no slide and no half-shown bar. It is simply there once the call to
       action has gone, and gone once it is back: one step, at the start of the same range. */
    @media (prefers-reduced-motion: reduce) {
      .qbar { animation-name: qbar-show; animation-timing-function: steps(1, start); }
    }
    /* Nothing to watch, no bar: see the note at the bar's resting style. It sets display
       alone, so it outranks the display:block above (an id inside :has) and leaves the Reduce
       Motion rule's animation-name alone. */
    body:not(:has(#waitlist-form, #get-app)) .qbar { display: none; }
  }

  /* ---- reduced motion ---------------------------------------------------- */
  /* REDUCE MOTION MEANS ZERO ANIMATION, and it is said twice. The card and divider drivers
     above are already gated on no-preference; this block also switches off every animated
     selector outright, with !important, so no later rule can hand one of them a clock again.
     With all of it off the page is simply its resting state, which is the finished one:
     every row in, 3 GAMES IN COMMON, the rings locked, the chat sent, every rule drawn.
     Nothing loops, so the moment cards' pause control has nothing to pause and is not
     there at all: display:none takes it out of the tab order and the accessibility tree.

     The queue bar is the one exception, and it does not move: under Reduce Motion it is
     shown or hidden in a single step as the hero's call to action leaves or returns (see
     its block above),
     never slid and never half-shown.

     Not a blanket kill beyond that. Everything that MOVES stops - every entrance, the hover
     lifts, the presses - and everything that is COLOUR stays, because a button that deepens
     under the pointer and a field whose border answers focus are feedback rather than
     motion, and removing them makes the page harder to use rather than calmer. */
  @media (prefers-reduced-motion: reduce) {
    .hero-copy .eyebrow,
    .hero-copy h1.display,
    .hero-copy .lede,
    .hero-copy .sub,
    .hero-act,
    .hero-watch,
    .hero .display .key::after,
    .moment-card,
    .sd,
    .plain-list li::before,
    .plain-list li::after {
      animation: none !important;
      transition: none !important;
    }
    #moments-pause, .pause { display: none; }
    .cta { transition-property: background-color, border-color; }
    .cta:hover, .cta:active { transform: none; box-shadow: ${shadowCss(CTA_SHADOW_LAYERS, SHADOW_INK)}; }
    /* The trailer link, the outlined join link and the queue bar's button keep their colour
       answers and lose their lift and their press, the same line this block draws for the
       button. */
    .trailer, .trailer:hover, .trailer:active,
    .cta-ghost, .cta-ghost:active,
    .qbar-cta, .qbar-cta:active { transform: none; }
  }

  /* ---- wide viewports ---------------------------------------------------- */
  /* THE FORM MOVES BESIDE THE TYPE AND THE TRAILER LINK TUCKS UNDER THE COPY.
     Two dense columns that end near the same line. The 460px cap on the form column is the
     form's own max-width, so the column is the control rather than a fraction that happens
     to contain it; the copy column takes whatever is left. The form spans both rows, so the
     link sits under the copy without pushing the form down. */
  @media (min-width: 900px) {
    .hero-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 460px);
      grid-template-areas: "copy act" "watch act";
      grid-template-rows: auto 1fr;
      column-gap: clamp(40px, 5vw, 84px); row-gap: 0;
      align-items: start;
    }
    /* The sub is the last line of the copy column and the form is the top of the other,
       so its bottom margin is measuring against nothing. */
    .hero-copy .sub { margin-bottom: 0; }
    /* Once launched the column holds a button and one sentence instead of a whole form, about
       120px against the copy's 450, so at the top it left a tall empty column under it. It
       sits on the middle of the copy and the trailer link instead, beside the lede. Only
       here: in the short landscape tier the middle of the copy can be under the fold. */
    .hero-act-store { align-self: center; }
    .hero-watch { margin-top: 30px; }
    .plain-list { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(24px, 4vw, 52px); }
    /* The support card: heading in a narrow left column, its three paragraphs beside it. */
    section.card {
      display: grid; grid-template-columns: minmax(0, 240px) minmax(0, 1fr);
      column-gap: clamp(24px, 4vw, 56px);
    }
    section.card h2 { grid-row: 1 / span 3; }
  }

  /* ---- BIG SCREENS: THE FRAME WIDENS, THE MEASURE DOES NOT ---------------
     Above 1180px of window .wrap used to cap and every section became a 1180px ribbon with
     the rest of the display left as bare cream. So the FIELD widens, to 1560, and no LINE OF
     TEXT does: the lede is capped at 30ch, the sub at 38ch, the plain version's paragraphs
     at 42ch and the legal documents at 68ch, so every measured line is the same length at
     3440px as it is at 1280px. What spends the extra field is the row of three moment
     cards, which is the product.

     .wrap WIDENS EVERYWHERE AT ONCE, header and footer included, and that is not laziness.
     The campaign's grid is ONE LEFT EDGE for the type and for every object; it is the first
     thing ground.ts states. An earlier version widened only some sections and put the
     headline's left edge 190px inside the objects' left edge on a 3440px monitor. Two left
     edges is worse than a narrow page.

     The hero's top row is capped rather than left as a fraction: a 560px column of type, the
     460px form, and the air in a third, empty column on the right, which is where
     ground.ts's MEASURE note says the air belongs. The trailer link stays under the type. */
  @media (min-width: 1500px) {
    .wrap { max-width: 1560px; }
    .hero-grid {
      grid-template-columns: minmax(0, 560px) minmax(0, 460px) minmax(0, 1fr);
      grid-template-areas: "copy act ." "watch act .";
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
    section.hero { padding: 16px 0 0; }
    h1.display { font-size: clamp(30px, 7.2vw, 52px); margin-bottom: 0.28em; }
    .lede { font-size: clamp(15.5px, 4.3vw, 19px); margin-bottom: 0.5em; }
    .sub { font-size: clamp(13.5px, 3.6vw, 16px); margin-bottom: 1.15em; }
    .eyebrow { font-size: clamp(10.5px, 2.41vw, 14px); margin-bottom: 0.75em; }
    .field-label { margin-bottom: 6px; }
    input[type="email"] { padding: 13px 14px; }
    .adult { margin: 10px 0 13px; }
    .cta { font-size: clamp(21px, 5.1vw, 30px); }
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
     479x520, and +25 -> +73 at 320x568. Only 320x454 still needs the flick, at -41.

     SINCE WATCH JOINED THE NAV (23 Sept 2026) the nav is four links on its own row. Here that
     row closes up to the mark and drops its 4px bands (the links keep their 30px targets), so
     the header is 2px shorter than three links on a wrapped line were. Measured, the room
     under the button: +8 at 320x500, +28 at 360x520, +49 at 390x550, +76 at 320x568, -38 at
     320x454. The one loser is 479x520, now -26: from about 416px wide three links sat
     beside the mark, and below 600px the nav now always takes its own row. No phone is that
     shape (portrait phones stop at 430 wide, and a phone on its side is the tier below). */
  @media (max-width: 479px) and (max-height: 620px) {
    header.site-header { padding: 10px 0 2px; }
    header.site-header .wrap { row-gap: 2px; }
    header.site-header nav { padding: 0; }
    section.hero { padding: 8px 0 0; }
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
    section.hero { padding: 12px 0 0; }
    /* The trailer link goes under the copy, as it does on a desktop, so the form keeps its
       column to itself. */
    .hero-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas: "copy act" "watch act";
      grid-template-rows: auto 1fr;
      column-gap: clamp(20px, 4vw, 40px);
      align-items: start;
    }
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
     still wants a shorter hero even with the form beside the type: it decides how much of
     the three moment cards is on the first screen, which is worth a step of type. */
  @media (min-width: 900px) and (max-height: 940px),
         (min-width: 900px) and (max-width: 1199px) {
    section.hero { padding: ${RHYTHM.g1} 0 0; }
    h1.display { font-size: clamp(34px, 5.1vw, 58px); margin-bottom: 0.3em; }
    .lede { font-size: clamp(16px, 1.42vw, 19px); margin-bottom: 0.45em; }
    .sub { font-size: clamp(14px, 1.18vw, 16px); margin-bottom: 1.1em; }
    .eyebrow { margin-bottom: 0.7em; }
    .field-label { margin-bottom: 5px; }
    input[type="email"] { padding: 12px 14px; font-size: 16px; }
    .adult { margin: 12px 0 14px; }
    .cta { font-size: clamp(21px, 3.3vw, 30px); }
    .promise { margin-top: 12px; }
  }
`;

// THE CLOSING LOCKUP'S RULES, emitted only on the page that still draws one: the thanks
// page. The five landing pages lost their lockup on 23 Sept 2026 (its one working part, the
// second button, became the outlined link after the plain version), so they no longer carry
// its CSS either.
const LOCKUP_CSS = `
  /* ---- the closing lockup ------------------------------------------------ */
  /* The campaign's end card, standing still. Proportions are FragEnd.tsx's, taken
     as ratios of the 1080 field: mark 250, wordmark 152 at +2% tracking, 40px gaps,
     the slab 26 below at 22x42 padding, the URL 44 in mono at +12% tracking. */
  /* Zero above, G4 below. The section before it (the outcome message) pays for the gap
     above it: two sections cannot each pay for the same boundary. */
  section.lockup { padding: 0 0 ${RHYTHM.g4}; text-align: center; }
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
     fallback-then-override pattern the watch page's film frame uses for vh and svh. 29.2cqi is 2.028x the
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
  .url {
    font-family: ${MONO}; font-weight: 600; font-size: clamp(14px, 3.2vw, 30px);
    letter-spacing: 0.12em; color: var(--ink);
  }

  /* The end card arrives on scroll: the mark, the wordmark and the URL arrive the way the
     film's last frame does. Scroll-driven, natively, with no script (there is no
     JavaScript on this site at all, and the privacy policy says so in those words), and
     gated on both the timeline and animation-range, so a browser that shipped half the
     feature renders the card at rest. Each child carries its own view() timeline, so they
     arrive in the order they are stacked without a single hand-typed delay, and the range
     ends at entry 60%: a scrubbed element can only sit in its from-state off screen. */
  @supports (animation-timeline: view()) and (animation-range: entry) {
    .lockup-inner > * {
      animation-name: rise;
      animation-fill-mode: backwards;
      animation-timing-function: var(--ease-out);
      animation-timeline: view();
      animation-range: entry 0% entry 60%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .lockup-inner > * { animation: none; }
  }
`;

// THE DOOR AND THE ROOM: the cross-document view transition between a landing page and its
// watch page. Emitted only on the pages that carry the film (pageShell's `film` option: the five
// landing pages and the four watch pages), because a cross-document transition runs only when
// BOTH pages opt in. So / and /watch/ animate into each other, and the legal pages and the two
// waitlist result pages navigate exactly as they always have.
const VIEW_TRANSITION_CSS = `
  /* ---- page to page: the trailer link opens into the film ------------------ */
  /* Following the trailer link (or the nav's WATCH), the paper cross-fades to the dark page in
     240ms and the link's play disc grows into the film's frame; coming home, the frame shrinks
     back into the disc. It is declared only under no-preference, so with Reduce Motion on the
     page simply changes, and so it does in a browser without cross-document view transitions
     (Chrome 126 and Safari 18.2 have them). No script: this is CSS alone. */
  @media (prefers-reduced-motion: no-preference) {
    @view-transition { navigation: auto; }
  }
  ::view-transition-old(root), ::view-transition-new(root) { animation-duration: 240ms; }
  .trailer-play, .film-frame { view-transition-name: film; }
  ::view-transition-group(film) { animation-duration: 440ms; animation-timing-function: cubic-bezier(0.23, 1, 0.32, 1); }
`;

// THE WATCH PAGES' RULES, emitted only on the four watch pages (buildWatchPage), after the
// shared CSS and the view transition. The shared header, footer, type and button rules are
// reused as they are; this block points their colour tokens at the dark palette (VOLT) and
// lays out the film and its copy, as in the "Wildcard" prototype Cameron approved on 23 Sept
// 2026.
const WATCH_CSS = `
  /* ---- the watch page: the screening room --------------------------------- */
  /* THE ONE DARK PAGE ON THE SITE, on the app's own dark ground (VOLT in build-site.mjs, which
     is darkColors verbatim), because the film was shot on it: the page, the frame and the
     film's own ground are one colour, so the picture has no edge to fight. It is also the one
     page where chartreuse may be a fill, for the reason the design note gives against it
     everywhere else: here it is 16.88:1, on the cream it is 1.05:1. */
  :root {
    --ground: ${VOLT.background};
    --ink: ${VOLT.text};
    --muted: ${VOLT.textMuted};
    --accent: ${VOLT.volt};
    --rule: ${VOLT.border};
    --mark-ink: ${VOLT.text};
    --mark-duo: ${VOLT.markDuo};
    color-scheme: dark;
  }
  /* The paper's lit sweep is off, and the footer is held to the bottom of a tall window. */
  body {
    background: var(--ground);
    min-height: 100vh; min-height: 100svh;
    display: flex; flex-direction: column;
  }
  main { flex: 1; }
  .skip-link { background: ${VOLT.volt}; color: ${VOLT.onVolt}; }

  section.watch { padding: ${RHYTHM.g2} 0 clamp(40px, 7vw, 88px); }
  .watch-grid {
    display: grid; grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "film" "copy"; row-gap: 26px;
  }
  /* THE FILM'S WIDTH IS CAPPED THREE WAYS: by its column; at 400px, so a 9:16 film stays the
     shape of a phone on a desktop; and by the window's height less the header, so a phone sees
     the whole picture and its controls on the first screen. vh first, svh second: the
     fallback, then the override. */
  .film-frame {
    grid-area: film;
    width: min(100%, 400px, calc((100vh - 150px) * 0.5625));
    width: min(100%, 400px, calc((100svh - 150px) * 0.5625));
    aspect-ratio: 9 / 16; margin: 0 auto;
    overflow: hidden; isolation: isolate; border-radius: 12px;
    background: ${FILM.ground}; border: 1px solid var(--rule);
  }
  .film-frame video { display: block; width: 100%; height: 100%; object-fit: cover; background: ${FILM.ground}; }
  .watch-copy { grid-area: copy; max-width: 30rem; }
  .watch .eyebrow { margin: 0 0 1em; }
  .watch h1.display { font-size: clamp(30px, 7.6vw, 54px); line-height: 1.22; margin: 0 0 0.45em; }
  .watch .lede {
    font-size: clamp(16px, 1.6vw, 19px); line-height: 1.5; color: var(--muted);
    margin: 0 0 1.4em; max-width: 34ch;
  }

  /* The app's own primary button in its own dark colours: volt fill, onVolt label,
     radius.button and the scale(0.97) press, from the shared rule. No cast shadow, since a
     shadow on this ground is invisible, and so no lift under the pointer either: a lift is
     read by its shadow. Before launch it went back to that channel's form; once launched it
     goes to the App Store (buildWatchPage). */
  .watch .cta {
    max-width: 460px;
    background: ${VOLT.volt}; color: ${VOLT.onVolt}; border-color: ${VOLT.volt};
    box-shadow: none;
    font-size: clamp(21px, 5.4vw, 30px);
  }
  .watch .cta:hover { background: ${VOLT.voltDim}; border-color: ${VOLT.voltDim}; box-shadow: none; transform: none; }
  .watch .cta:active { background: ${VOLT.voltDim}; border-color: ${VOLT.voltDim}; box-shadow: none; transform: scale(0.97); }
  .watch .promise { color: var(--muted); margin-top: 14px; }

  /* From 900px the film stands on the left edge and the copy sits beside it, centred on the
     film's band, all on one screen. The frame drops its 100% term here, because an auto track
     would make it cyclic. */
  @media (min-width: 900px) {
    .watch-grid {
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-areas: "film copy";
      column-gap: clamp(40px, 6vw, 96px); align-items: center;
    }
    .film-frame {
      margin: 0;
      width: min(400px, calc((100vh - 170px) * 0.5625));
      width: min(400px, calc((100svh - 170px) * 0.5625));
    }
  }

  /* The copy settles in once on load, on the hero's clock (267ms each, 60ms apart). The film is
     the motion on this page, so nothing else moves. Reduce Motion: none of it, and no press. */
  .watch-copy > * { animation: rise var(--t-arrival) var(--ease-out) backwards; }
  .watch-copy > :nth-child(2) { animation-delay: 60ms; }
  .watch-copy > :nth-child(3) { animation-delay: 120ms; }
  .watch-copy > :nth-child(4) { animation-delay: 180ms; }
  .watch-copy > :nth-child(5) { animation-delay: 240ms; }
  @media (prefers-reduced-motion: reduce) {
    .watch-copy > * { animation: none !important; transition: none !important; }
    .watch .cta, .watch .cta:hover, .watch .cta:active { transform: none; }
  }
`;

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

/** The channels with their own copy of the landing page and of the watch page. */
const CHANNELS = ["tt", "ig", "yt"];

/** The root of a channel's copy of the site: "/" for the unlabelled pages, "/tt/" and so on for
 *  a channel's. Anything else throws, so a typo cannot build a link to a page that does not
 *  exist. */
function channelRoot(channelDir = "") {
  if (channelDir && !CHANNELS.includes(channelDir)) {
    throw new Error(`build-site: unknown channel "${channelDir}"`);
  }
  return channelDir ? `/${channelDir}/` : "/";
}

/** The nav's play triangle, drawn rather than typed: iOS renders a typed U+25B6 as an emoji. */
const NAV_PLAY_SVG = `<svg viewBox="0 0 8 9" aria-hidden="true"><path d="M0 0l8 4.5L0 9z"/></svg>`;

/** The browser chrome's colour per theme: the paper, or the watch pages' dark ground. */
const THEME_COLOR = { paper: GROUND.base, volt: VOLT.background };

/** The CSS as a visitor downloads it: every comment taken out. The notes in the CSS are for
 *  whoever edits this file, and inlined into every page they were some 40 KB of it (the home
 *  page went from 84 KB to 44 KB) and the only way an em dash reached page source. A CSS comment cannot nest, and no
 *  string in this file's CSS contains a comment marker, so the first closing marker after an
 *  opening one is always its own, which is how a browser reads it too. Every comment here has
 *  whitespace on both sides, so taking one out cannot join two tokens into one. The blank lines
 *  a removed comment leaves behind go as well. */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n[ \t]*(?=\n)/g, "");
}

/** The queue bar: the logo and the call to action again, which slides down from the top of
 *  the screen once the hero's own has fully left it (the queue bar's CSS says how, with no
 *  script). Before launch that is "join the waitlist", back up to the form; once launched it
 *  is the App Store link, whose last four words drop out of view on a phone (.qbar-more) and
 *  stay in its accessible name. */
function qbarHtml() {
  const cta =
    PHASE === "launched"
      ? `<a class="qbar-cta" href="${APP_STORE_URL}" aria-label="Download on the App Store"><span>Download<span class="qbar-more"> on the App Store</span></span></a>`
      : `<a class="qbar-cta" href="#waitlist-form">join the waitlist${ARROW_UP_SVG}</a>`;
  return `<div class="qbar">
  <div class="wrap qbar-in">
    <a class="brand" href="#main">${ringsMarkSvg({ size: 24, label: "" })}<span>duoqueue</span></a>
    ${cta}
  </div>
</div>
`;
}

function pageShell({
  title,
  description,
  bodyHtml,
  canonical,
  footerNote,
  noindex = false,
  ogImage = "/og.png",
  extraCss = "",
  // "paper" (every page but the watch pages) or "volt" (the watch pages). It sets the browser's
  // theme-color; the dark palette itself arrives with the watch page's extraCss, WATCH_CSS.
  theme = "paper",
  // The film is on (main() checks once): the nav leads with WATCH, and the page opts into the
  // view transition between a landing page and its watch page.
  film = false,
  // The queue bar, for a landing page, in either phase: it shows once the hero's call to
  // action (the form, or once launched the download button) has left the screen.
  qbar = false,
  // "" or one of CHANNELS: which channel's watch page the nav's WATCH goes to.
  channelDir = "",
  // "watch" on a watch page, which marks its own nav link as the current page.
  current = "",
  // Where the logo and the footer's Home link go. A channel's watch page sends them back to
  // that channel's landing page, so its hidden source field still says where the visitor
  // came from.
  homeHref = "/",
}) {
  if (!(theme in THEME_COLOR)) throw new Error(`build-site: pageShell() got an unknown theme "${theme}"`);
  const watchLink = film
    ? `<a class="nav-watch" href="${channelRoot(channelDir)}watch/"${current === "watch" ? ' aria-current="page"' : ""}>${NAV_PLAY_SVG}Watch</a>
      `
    : "";
  const bar = qbar ? qbarHtml() : "";
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
<meta name="theme-color" content="${THEME_COLOR[theme]}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="DuoQueue">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${SITE_ORIGIN}${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
${canonical ? `<meta property="og:url" content="${canonical}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<style>${stripCssComments(CSS + (film ? VIEW_TRANSITION_CSS : "") + extraCss)}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${bar}<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${homeHref}">${ringsMarkSvg({ size: 26 })}<span>duoqueue</span></a>
    <nav>
      ${watchLink}<a href="/privacy/">Privacy</a>
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
      <a href="${homeHref}">Home</a> <span aria-hidden="true">&middot;</span>
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
// What you are joining: the three moment cards.
//
// Redrawn in HTML and CSS from the app's own source rather than screenshotted, for the
// same three reasons the product fragments before them were:
//
//   1. The campaign's footage contains photographs of real people. None of that is in the
//      repository, and putting a real person's face on a landing page is a consent decision
//      this build should not make on anybody's behalf.
//   2. Drawn in CSS it is crisp at every device pixel ratio and weighs nothing.
//   3. It is genuinely the product: the strings are the app's strings, from SwipeCard.tsx's
//      overlapLabel(), profile-labels.ts's SKILL_LABELS, the match screen's label and the
//      chat composer's own placeholder.
//
// THE CARDS REPLACED THE FRAGMENTS on 23 Sept 2026, in the "Wildcard" direction Cameron
// approved. The fragments were three cut-out pieces of different widths under heavy tilted
// shadows, and they read as chopped; the first one also claimed "3 GAMES IN COMMON" over
// two games. These are three cards of one size, each acting out one moment of the app's
// loop: you match on what you play, you lock in as a duo, you talk and queue up.
//
// EVERY CARD IS WRITTEN IN ITS FINISHED STATE. The in-between states the motion plays
// through (the badge's lower counts, the message being typed) are in the markup, invisible
// at rest and aria-hidden, so a browser that runs no animation shows the complete card and a
// screen reader hears only the finished one. The `sd` class marks every piece that moves.
//
// THE MOMENTS LOOP (24 Sept 2026), so the heading carries a Pause control: a checkbox and its
// label, siblings of the list so the checkbox's state reaches the cards without :has() or a
// script. Its two glyphs are drawn, not typed, for the reason the nav's play triangle is:
// iOS renders the typed pause and play characters as emoji.
// ---------------------------------------------------------------------------

const PAUSE_GLYPH = `<svg class="is-pause" viewBox="0 0 9 10" aria-hidden="true"><path d="M0.5 0h2.6v10H0.5zM5.9 0h2.6v10H5.9z"/></svg>`;
const PLAY_GLYPH = `<svg class="is-play" viewBox="0 0 9 10" aria-hidden="true"><path d="M0.5 0l8.5 5-8.5 5z"/></svg>`;

const ARROW_UP_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${APP.onVolt}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>`;

/** Card 01's games, in Chip.tsx's label-and-detail form. League of Legends is the launch
 *  game and "Gold II" is a real rank string (the film's own chip); the other two details
 *  are SKILL_LABELS values. Three rows, because the badge under them says three. */
const MOMENT_GAMES = [
  ["League of Legends", "Gold II"],
  ["Rocket League", "Ranked Grinder"],
  ["Valorant", "Competitive"],
];

/** SwipeCard.tsx's overlapLabel(), verbatim. */
function overlapLabel(count) {
  if (count <= 0) return ">> NO GAMES IN COMMON";
  if (count === 1) return ">> 1 GAME IN COMMON";
  return `>> ${count} GAMES IN COMMON`;
}

/** The logo's two rings for card 02, from the same ringShapes() the header's mark is drawn
 *  from, so the geometry lives in one place. They are grouped in the three layers the weave
 *  needs (the duo ring and its tail, the ink ring over it, then the short arc of the duo ring
 *  that passes back over the ink) so each ring can slide in from its own side and still
 *  interlock where they meet. The viewBox is the rings' own ink box, computed from the same
 *  geometry, plus a small margin. */
function lockinSvg() {
  const { R, W, cxA, cxB, cy } = ringGeometry(1);
  const { duoRing, tail, inkRing, weave } = ringShapes(1);
  const left = cxA - R - W / 2;
  const right = cxB + R + W / 2;
  const top = cy - R - W / 2;
  const bottom = cy + R + W / 2;
  const box = [left - 14, top - 12, right - left + 28, bottom - top + 24].map(Math.round).join(" ");
  return `<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg">
                <g class="ring-duo sd">${duoRing}${tail}</g>
                <g class="ring-ink sd">${inkRing}</g>
                <g class="ring-duo sd">${weave}</g>
              </svg>`;
}

/** The three moment cards, as the section that follows the hero on every landing page. */
function momentsHtml() {
  const chips = MOMENT_GAMES.map(
    ([game, detail]) =>
      `<li class="chip sd"><b>${escapeHtml(game)}</b><i>&middot; ${escapeHtml(detail)}</i></li>`
  ).join("\n              ");
  // The finished count rests visible; the three before it are only ever seen mid-animation.
  const counts = [0, 1, 2, 3]
    .map(
      (n) =>
        `<span class="t${n} sd"${n < 3 ? ' aria-hidden="true"' : ""}>${escapeHtml(overlapLabel(n))}</span>`
    )
    .join("\n              ");
  return `
<section class="moments" aria-labelledby="moments-head">
  <div class="wrap">
   <div class="moments-inner">
    <h2 class="eyebrow" id="moments-head">${PHASE === "launched" ? "How it works" : "What you are joining"}</h2>
    <input class="pause-box" type="checkbox" id="moments-pause" aria-label="Pause animations">
    <label class="pause" for="moments-pause">${PAUSE_GLYPH}${PLAY_GLYPH}<span class="pw"><span class="w-pause">Pause</span><span class="w-play">Play</span></span></label>
    <ol class="moment-list">
      <li class="moment m1">
        <div class="moment-card">
          <div class="stage">
            <ul class="chips">
              ${chips}
            </ul>
            <div class="overlap sd">
              ${counts}
            </div>
          </div>
          <p class="moment-line"><span class="no">01</span>You match on what you play, and how you play it.</p>
        </div>
      </li>
      <li class="moment m2">
        <div class="moment-card">
          <div class="stage">
            <div class="lockin" aria-hidden="true">
              <span class="br br-l sd">[</span>
              ${lockinSvg()}
              <span class="br br-r sd">]</span>
            </div>
            <p class="lock sd">Duo locked</p>
            <p class="both sd">You and your new match both queued up.</p>
          </div>
          <p class="moment-line"><span class="no">02</span>And when it is mutual, you are a duo.</p>
        </div>
      </li>
      <li class="moment m3">
        <div class="moment-card">
          <div class="stage talk">
            <div class="chat">
              <p class="bubble in sd">you on tonight?</p>
              <p class="bubble out sd">yep, queue at 9</p>
              <div class="composer" aria-hidden="true">
                <div class="box"><span class="ph sd">Message&hellip;</span><span class="typed sd">yep, queue at 9</span></div>
                <div class="send sd">${ARROW_UP_SVG}</div>
              </div>
            </div>
          </div>
          <p class="moment-line"><span class="no">03</span>Then you talk, and queue up.</p>
        </div>
      </li>
    </ol>
   </div>
  </div>
</section>`;
}

/** The trailer link, the film's only presence on a landing page. Each channel's page links
 *  to its own channel's watch page (/tt/watch/ and so on), whose join button comes back to
 *  that channel's form, so the hidden source field still says where a visitor came from
 *  after a detour through the film. `channelDir` is "" for / and /waitlist/. */
function trailerLinkHtml(channelDir = "") {
  const href = `${channelRoot(channelDir)}watch/`;
  return `<a class="trailer" href="${href}"><span class="trailer-play" aria-hidden="true"><svg viewBox="0 0 13 14"><path d="M0 0l13 7L0 14z"/></svg></span><span class="trailer-text">Watch the trailer</span><span class="trailer-time">${FILM.length}</span></a>`;
}

// ---------------------------------------------------------------------------
// The landing page. One template, five URLs.
//
// /, /waitlist/, /tt/, /ig/ and /yt/ all render this. The root carries the call to
// action because the ads' end card prints "duoqueue.io" and nothing else: a visitor who
// has to find and tap a second link before they can act is a visitor the campaign paid
// for and then lost.
//
// BEFORE LAUNCH the five differed by one hidden field: the form's `source`, so the three
// channel paths (short enough to live in a social bio) gave per-channel attribution with
// no analytics SDK, no cookie and no query-string JavaScript.
//
// ONCE LAUNCHED there is no form, so /tt/, /ig/ and /yt/ are plain copies of the landing
// page, canonical to /, kept because those addresses are already in bios and captions. They
// no longer tell the channels apart. Per-channel attribution now has to happen at Apple's
// end: App Store Connect campaign links, the listing URL with `pt` (the provider token) and
// `ct` (the campaign name) appended, which App Store Connect's App Analytics then counts
// per campaign. `pt` is Cameron's provider token, which only he can read out of App Store
// Connect; until he has, every copy links to the bare APP_STORE_URL.
// ---------------------------------------------------------------------------

const HERO_LEDE = "DuoQueue is an 18+ app for finding people to play games with. It is not dating.";
const HERO_SUB =
  "You match on the games you play, the hours you are online, and how you like to play them. Then you talk, and queue up.";
// The line under the call to action, per phase. The landing page's and the watch page's are one
// string, so the promise a visitor reads beside the film is the one they read beside the button.
// "Free to download" rather than "free": the app is free to get and has optional in-app purchases
// (DuoQueue+, Power-Ups, Legendary Likes; the privacy policy's Section 2 lists them).
const WAITLIST_PROMISE = "One email, on the day it goes live. That is the only one you get.";
const LAUNCHED_PROMISE =
  "Free to download on iPhone, 18+ only. We are starting with League of Legends players in North America.";
/** The launched call to action's words. "App Store" capitalised, as Apple's guidelines ask. */
const STORE_LABEL = "Download on the App Store";

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
      <p class="promise">${WAITLIST_PROMISE}</p>
      <p class="fineprint">We do not share your address. No analytics, no trackers and no cookies on this page. Submitting the form sets one 30-minute anti-bot cookie on our backend&rsquo;s own domain, and nothing else. See the <a href="/privacy/">Privacy Policy</a>.</p>`;
}

/** The launched-phase call to action: the App Store link in the app's own button, and the
 *  promise under it. #get-app is what the queue bar watches in place of the form. Also the
 *  body of the two waitlist result pages once launched (outNowBody). */
function launchedCta() {
  return `
      <div class="get-app" id="get-app">
        ${storeButton()}
        <p class="promise">${LAUNCHED_PROMISE}</p>
      </div>`;
}

/** The App Store button itself, the app's primary button with its label in .cta-fit, which
 *  steps the words down to fit on one line (see the CSS). Its parent must be a .get-app. */
function storeButton() {
  return `<a class="cta" href="${APP_STORE_URL}"><span class="cta-fit">${STORE_LABEL}</span></a>`;
}

function waitlistBody({ source, film = false, channelDir = "" }) {
  const launched = PHASE === "launched";
  const action = launched ? launchedCta() : signupForm(source);
  // The outlined link after the plain version: back up to the form, or, once launched, to
  // the store. It is what is left of the closing lockup's button.
  const again = launched
    ? `<a class="cta-ghost" href="${APP_STORE_URL}">${STORE_LABEL}</a>`
    : `<a class="cta-ghost" href="#waitlist-form">join the waitlist <span aria-hidden="true">&uarr;</span></a>`;
  // The plain version's first and third items are the two that were only true of a waitlist:
  // the age box was on the form, and "everyone starts together" was about the list. Once
  // launched the age line says what the app does (a date of birth at signup, refused under
  // 18, not verified: the privacy policy's Section 9 in fewer words) and the third item says
  // who the app is starting with.
  const ageLine = launched
    ? "DuoQueue is for adults. You give your date of birth when you sign up, and a date under 18 is refused. Nobody checks ID, and we do not pretend otherwise."
    : "DuoQueue is for adults. The box on that form is you telling us your age. It is not us checking it, and we do not pretend otherwise.";
  const [thirdHead, thirdLine] = launched
    ? [
        "League of Legends first",
        "We are starting with League of Legends players in North America, so the first people in find someone to play with instead of an empty screen. Your other games go on your profile too.",
      ]
    : [
        "Everyone starts together",
        "The whole list gets the app on the same day on purpose, so the first people in find someone to play with instead of an empty screen.",
      ];
  // Only when the film is on, so the link can never point at a watch page that was not built.
  const watch = film
    ? `
      <div class="hero-watch">
        ${trailerLinkHtml(channelDir)}
      </div>`
    : "";

  return `
<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${launched ? "Out now on iPhone" : "The waitlist"}</p>
        <h1 class="display">queue up<br>with a <span class="key">duo</span></h1>
        <p class="lede">${HERO_LEDE}</p>
        <p class="sub">${HERO_SUB}</p>
      </div>
      <div class="hero-act${launched ? " hero-act-store" : ""}">
${action}
      </div>${watch}
    </div>
  </div>
</section>
${momentsHtml()}
<section class="plain">
  <div class="wrap">
    <h2 class="eyebrow">The plain version</h2>
    <ul class="plain-list">
      <li>
        <h3>18+ only</h3>
        <p>${ageLine}</p>
      </li>
      <li>
        <h3>Platonic, not dating</h3>
        <p>You are looking for someone to play with. The profile is games, hours and playstyle, and there is nothing romantic anywhere in the app.</p>
      </li>
      <li>
        <h3>${thirdHead}</h3>
        <p>${thirdLine}</p>
      </li>
    </ul>
    <p class="again">${again}</p>
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

function buildWaitlistPage({ source, canonical, includeSupport, film = false, channelDir = "" }) {
  return pageShell({
    title:
      PHASE === "launched"
        ? "DuoQueue: find your duo"
        : "DuoQueue: join the waitlist",
    description:
      PHASE === "launched"
        ? "DuoQueue is an 18+ app for finding people to play games with. Platonic, not dating. Free to download on iPhone, starting with League of Legends players in North America."
        : "DuoQueue is an 18+ app for finding people to play games with. Platonic, not dating. Join the waitlist and get one email the day it goes live.",
    canonical,
    bodyHtml: waitlistBody({ source, film, channelDir }) + (includeSupport ? supportSection() : ""),
    film,
    qbar: true,
    channelDir,
  });
}

// ---------------------------------------------------------------------------
// The watch pages: the film on its own dark page.
//
// /watch/, plus /tt/watch/, /ig/watch/ and /yt/watch/, all from this one function and all
// canonical to /watch/. The film used to sit on the landing page as a dark block that broke
// the light page's flow and cost every visit 2.9 MB. Here it is the page: up to 400px wide,
// native controls, muted autoplay (see FILM), played once so it rests on its last frame, with
// the headline, the 18+ / not dating line and a chartreuse button beside it.
//
// A channel gets its own copy for the same reason it gets its own landing page: before
// launch the button (and the logo, and the footer's Home) went back to THAT channel's form,
// so the hidden source field still said tt, ig or yt after a detour through the film. Once
// launched the button goes to the App Store and the logo and Home still go back to that
// channel's copy of the landing page.
// ---------------------------------------------------------------------------

function buildWatchPage({ channelDir = "" } = {}) {
  const home = channelRoot(channelDir);
  const launched = PHASE === "launched";
  // Once launched there is no form to go back to: the button goes to the store instead, in a
  // .get-app so its label fits on one line like the landing page's.
  const action = launched
    ? `<div class="get-app">${storeButton()}</div>`
    : `<a class="cta" href="${home}#waitlist-form">join the waitlist</a>`;
  const promise = launched ? LAUNCHED_PROMISE : WAITLIST_PROMISE;
  const body = `
<section class="watch" aria-labelledby="watch-head">
  <div class="wrap watch-grid">
    <div class="film-frame">
      <video src="/${FILM.video}" poster="/${FILM.poster}" controls muted${FILM.autoplay ? " autoplay" : ""} playsinline preload="metadata" aria-label="DuoQueue, a short film of the app" aria-describedby="watch-head">
        <a href="/${FILM.video}">Watch the DuoQueue film</a>
      </video>
    </div>
    <div class="watch-copy">
      <p class="eyebrow">The trailer &middot; ${FILM.length}</p>
      <h1 class="display" id="watch-head">from the first swipe to <span class="key">queueing up</span></h1>
      <p class="lede">${HERO_LEDE}</p>
      ${action}
      <p class="promise">${promise}</p>
    </div>
  </div>
</section>
`;
  return pageShell({
    title: "Watch the trailer | DuoQueue",
    description: launched
      ? "The DuoQueue trailer: an 18+ app for finding people to play games with. Platonic, not dating. Free to download on iPhone."
      : "The DuoQueue trailer, 21 seconds: an 18+ app for finding people to play games with. Platonic, not dating.",
    canonical: `${SITE_ORIGIN}/watch/`,
    bodyHtml: body,
    extraCss: WATCH_CSS,
    theme: "volt",
    film: true,
    channelDir,
    current: "watch",
    homeHref: home,
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
//
// ONCE LAUNCHED both addresses stay, because old links still reach them: a form page left
// open in a tab still posts to the endpoint, which still redirects here, and the waitlist
// emails and bookmarks carry these URLs. So both say the one thing that is true now, the
// app is out, and send the visitor to the App Store (outNowBody). The thanks page keeps its
// closing lockup.
// ---------------------------------------------------------------------------

/** Both result pages' message once PHASE is "launched": the app is out, here is the link. The
 *  button and the line under it are the landing page's own (launchedCta), so the call to
 *  action's shadow guard measures the same arrangement here. */
function outNowBody() {
  return `
<section class="outcome">
  <div class="wrap">
    <p class="eyebrow">Out now on iPhone</p>
    <h1 class="display">the wait is <span class="key">over</span></h1>
    <p class="lede">DuoQueue is out, so there is no list to join any more. Get the app and make your profile.</p>
${launchedCta()}
    <p class="fineprint">Joined the waitlist and want your address deleted? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and we will remove it.</p>
  </div>
</section>
`;
}

const OUT_NOW_TITLE = "DuoQueue is out now";
const OUT_NOW_DESCRIPTION =
  "DuoQueue is out now, free to download on iPhone, so there is no waitlist to join any more. Download it on the App Store.";

function buildThanksPage() {
  if (PHASE === "launched") {
    return pageShell({
      title: OUT_NOW_TITLE,
      description: OUT_NOW_DESCRIPTION,
      bodyHtml: outNowBody() + lockupHtml(),
      noindex: true,
      extraCss: LOCKUP_CSS,
    });
  }
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
${lockupHtml()}`;
  return pageShell({
    title: "You are on the list | DuoQueue",
    description: "You joined the DuoQueue waitlist. We will email you once, the day it goes live.",
    bodyHtml: body,
    noindex: true,
    extraCss: LOCKUP_CSS,
  });
}

/** The closing lockup, the campaign's end card standing still: on the thanks page only. */
function lockupHtml() {
  return `
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
}

function buildTryAgainPage() {
  if (PHASE === "launched") {
    return pageShell({
      title: OUT_NOW_TITLE,
      description: OUT_NOW_DESCRIPTION,
      bodyHtml: outNowBody(),
      noindex: true,
    });
  }
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

/** A legal page's HTML, from its markdown. main() writes it, after the page source guard. */
function buildLegalPage({ srcFile, description, canonical }) {
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
  return pageHtml;
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

// THE PAGE SOURCE GUARD. Two promises are kept in page source rather than in any one
// function, so they are checked on the finished pages, all of them, before any is written.
// The privacy policy says "There is no JavaScript on the site at all": no <script> tag, no
// inline on...= handler, no javascript: URL. And no page carries an em dash, in visible text
// or in source, the standing rule for all public copy (the CSS comments were the last place
// one lived, and stripCssComments() took them out).
const PAGE_SOURCE_BANS = [
  { what: "a <script> tag", re: /<script\b/i },
  { what: "an inline event handler (on...=)", re: /\son[a-z]+\s*=/i },
  { what: "a javascript: URL", re: /javascript:/i },
  { what: "an em dash", re: /—|&mdash;|&#0*8212;|&#x0*2014;/i },
];

function checkPageSource(pages) {
  const hits = [];
  for (const [relPath, html] of pages) {
    if (!relPath.endsWith(".html")) continue;
    for (const ban of PAGE_SOURCE_BANS) {
      const i = html.search(ban.re);
      if (i !== -1) {
        const near = html.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, " ");
        hits.push(`  site/${relPath}: ${ban.what}, near "${near}"`);
      }
    }
  }
  if (hits.length) {
    console.error("REFUSING TO BUILD: a page's source breaks a promise the site makes.\n");
    hits.forEach((h) => console.error(h));
    console.error("\nNothing was written. Fix the generator or docs/legal/ and re-run.");
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
  console.log("Contrast, every pair on the site (the paper measured at the sweep's darkest stop):");
  checkContrast();
  console.log("");

  // Every generated file is staged first and written only once the page source guard has
  // read all of them, so a page that breaks it stops the build before site/ changes at all.
  const staged = [];
  const written = [];

  function write(relPath, contents) {
    staged.push([relPath, contents]);
  }

  // The landing page and its four aliases. `/` carries the support block because
  // it is the URL registered with App Store Connect; the aliases canonicalise to
  // it so five URLs serving one page is not four duplicate-content pages.
  // The trailer link and the nav's WATCH go on all five, since they are one page, and each
  // channel's copy links to its own channel's watch page. Whether the film is on is checked
  // once, before any page is written, so the landing pages and the watch pages cannot disagree
  // about it: with the film missing there are no watch pages and nothing links to one.
  const film = filmPresent();
  write("index.html", buildWaitlistPage({ source: "direct", canonical: `${SITE_ORIGIN}/`, includeSupport: true, film }));
  write("waitlist/index.html", buildWaitlistPage({ source: "direct", canonical: `${SITE_ORIGIN}/`, includeSupport: false, film }));
  for (const dir of CHANNELS) {
    write(`${dir}/index.html`, buildWaitlistPage({ source: dir, canonical: `${SITE_ORIGIN}/`, includeSupport: false, film, channelDir: dir }));
  }
  // The watch pages: /watch/ for the unlabelled landing pages, and one per channel.
  if (film) {
    write("watch/index.html", buildWatchPage());
    for (const dir of CHANNELS) write(`${dir}/watch/index.html`, buildWatchPage({ channelDir: dir }));
  }
  write("waitlist/thanks/index.html", buildThanksPage());
  write("waitlist/try-again/index.html", buildTryAgainPage());

  write(
    "privacy/index.html",
    buildLegalPage({
      srcFile: "privacy-policy.md",
      description: "DuoQueue's Privacy Policy: what we collect, why, and who we share it with.",
      canonical: `${SITE_ORIGIN}/privacy/`,
    })
  );
  write(
    "terms/index.html",
    buildLegalPage({
      srcFile: "terms-of-service.md",
      description: "DuoQueue's Terms of Service.",
      canonical: `${SITE_ORIGIN}/terms/`,
    })
  );

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

  checkPageSource(staged);
  mkdirSync(SITE_DIR, { recursive: true });
  for (const [relPath, contents] of staged) {
    const full = path.join(SITE_DIR, relPath);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents, "utf8");
    written.push(relPath);
  }
  console.log(`Page source: ${staged.filter(([p]) => p.endsWith(".html")).length} pages, no script, no handler, no javascript: URL, no em dash.\n`);

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
      `  WARNING: site/${FILM.video} or site/${FILM.poster} is missing, so the watch pages and every link to them were left out.\n` +
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
  APP_STORE_URL,
};
