// scripts/make-og.mjs — renders the 1200x630 link preview card into site/.
//
// Run: node scripts/make-og.mjs
//
// It is the campaign's end card, which is the one composition Cameron has liked across
// ten design rounds: the mark, the wordmark, an off-black slab carrying chartreuse, and
// duoqueue.io beneath it. A link pasted into a Discord server or an iMessage thread
// should look like the ad that sent the person there.
//
// WHAT THE CARD SAYS FOLLOWS PHASE IN build-site.mjs, and so does its file name.
//
//   "waitlist"   site/og.png          mark, wordmark, the "join the waitlist" slab, URL
//   "launched"   site/og-launch.png   mark, wordmark, URL: no slab, set larger to fill
//                site/og.png          the same launch card, byte for byte
//
// The slab went on 30 Sept 2026, the day DuoQueue 1.0 went live. Every page's og:image
// pointed at the card, so every duoqueue.io link shared anywhere would otherwise have
// advertised a waitlist that no longer existed. The slab's words are outlines exported
// from the fonts (below), and exporting new words needs fontTools from pip, so the card
// drops the slab rather than guessing at new ones.
//
// The launch card gets a NEW file name (OG_CARD, exported by build-site.mjs, which is
// also what every page's og:image names) because link previews cache the image by its
// URL: Discord's media proxy and Facebook's scraper both keep serving the bytes they
// fetched under a URL they have seen, so a changed image under the old name can go on
// showing the old card. A new name is fetched fresh the first time a page is re-read.
// The old name is still written, with the same launch card, because the deploy never
// deletes a file from gh-pages (deploy-site.mjs, step 6): a preview that cached a page
// before the rename still asks for /og.png, and it must not get the waitlist either.
//
// Not the 1024x1024 app icon, which was the obvious cheap option: every surface that
// renders an og:image renders it at about 1.91:1, so a square icon is letterboxed or
// centre-cropped, and either way the preview stops being a designed thing.
//
// TWO DEPENDENCIES, BOTH ALREADY IN THE REPO, AND NEITHER IS A FONT.
//
//   sharp                     already a root devDependency (used by the icon and
//                             screenshot generators). Nothing new is installed.
//   scripts/og-glyphs.json    the three strings as SVG outlines, produced once by
//                             scripts/site-fonts/export-og-glyphs.py and committed.
//
// The outlines are the whole trick. sharp's SVG rasteriser resolves font names through
// the operating system's font stack, and Unbounded and Manrope are not installed on this
// machine and must not be, so an SVG naming them would render in a substituted face and
// nobody would notice until the card was live. Outlines cannot be substituted.
//
// This is deliberately NOT part of `node scripts/build-site.mjs`: that build is
// zero-dependency by policy and this needs sharp. build-site.mjs asserts the card for the
// current PHASE exists and warns if it does not, and deploy-site.mjs refuses to publish
// without it.

import { readFileSync, statSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

import { ringsMarkSvg, GROUND, INK, PHASE, OG_CARD } from "./build-site.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const GLYPHS = JSON.parse(readFileSync(path.join(__dirname, "og-glyphs.json"), "utf8"));

if (PHASE !== "waitlist" && PHASE !== "launched") {
  console.error(`make-og: PHASE in build-site.mjs is "${PHASE}"; it must be "waitlist" or "launched".`);
  process.exit(1);
}
// The "cta" outlines read "join the waitlist". They are true only before launch.
const WITH_SLAB = PHASE === "waitlist";

const W = 1200;
const H = 630;

// ---------------------------------------------------------------------------
// The lockup, sized from the end card's own ratios.
//
// FragEnd.tsx sets the wordmark at 152 on a 1080 field, which renders 956 wide: 88.5%
// of the frame. Everything else is expressed against that wordmark width, so choosing
// one number here sets all of them and the proportions stay the campaign's:
//
//   mark ink width   26.0% of the wordmark  (measured 248 / 956 on 06-the-waitlist.png)
//   slab width       ~55%  of the wordmark
//   call to action    6.3% of the field, i.e. 7.1% of the wordmark
//   URL                44  of a 1080 field  = 4.07% of the field
//
// WORDMARK is 640 on the waitlist card rather than the 1062 that 88.5% of 1200 would give,
// because this card is 630 tall and the end card's own frame is 1350. At full width the
// stack overruns the bottom edge; at 640 the stack occupies the middle of the frame with
// the same proportion of air above and below that the end card leaves.
//
// The launch card has no slab, which frees about a quarter of that stack's height. It is
// given back as size rather than as air: at 860 the three remaining pieces stand about as
// tall as the four did (379px of 630 against 388), so the card keeps the same margins and
// reads larger in the small thumbnail a chat app draws. GAP scales with the wordmark so the
// spacing keeps its proportion; on the waitlist card it is exactly the 30 it always was.
// ---------------------------------------------------------------------------
const WORDMARK = WITH_SLAB ? 640 : 860;
const FIELD = WORDMARK / 0.885; // the notional 1080-equivalent field this implies
const MARK_INK_W = WORDMARK * 0.26;
// ringsMarkSvg draws on the app icon's full 1024 canvas. The two rings sit side by side,
// so the ink is a wide shape, not a square: it occupies 74..925 horizontally (83.1% of
// the canvas) and 247.5..776.5 vertically (51.7%), computed from the same ringGeometry
// the site and the app icon use. Both numbers are needed here, one to size the box and
// one to know how much vertical room to leave for it. Ratio 0.621, which is what
// 06-the-waitlist.png measures (153 / 248).
const MARK_BOX = MARK_INK_W / 0.831;
const MARK_INK_H = MARK_BOX * 0.5166;
const MARK_INK_TOP = MARK_BOX * 0.2417; // 247.5 / 1024
const CTA_SIZE = FIELD * 0.063;
const CTA_PAD_X = FIELD * (42 / 1080);
const CTA_PAD_Y = FIELD * (22 / 1080);
const CTA_LINE = CTA_SIZE * (78 / 68);
const URL_SIZE = FIELD * (44 / 1080);

const CX = W / 2;
const GAP = 30 * (WORDMARK / 640);

/** Places one exported string. The paths are drawn on a 1000-unit em with the baseline
 * at y = 0, so this is a scale and a translate and nothing more. Returns the advance in
 * final pixels so the caller can centre the next element against it. */
function setString(key, size, baselineY, { centerOn = CX, fill = INK.type } = {}) {
  const g = GLYPHS[key];
  const s = size / g.em;
  const width = g.advance * s;
  const x = centerOn - width / 2;
  return {
    width,
    svg: `<g fill="${fill}" transform="translate(${x.toFixed(2)} ${baselineY.toFixed(2)}) scale(${s.toFixed(6)})">${g.svg}</g>`,
  };
}

// Cap heights and descender depths, per face, in em.
//
// BOTH are needed, and the descender is the one it is tempting to skip. "duoqueue" and
// "duoqueue.io" each contain a q, so measuring those two strings by cap height alone
// puts their descenders into the gap below them: the first render of this card had the
// slab appearing to touch the wordmark for exactly that reason, while the arithmetic
// said the gaps were equal. Every element below is stacked by its real INK extent.
const FACE = {
  unbounded: { cap: 0.7, desc: 0.21 },
  manrope: { cap: 0.72, desc: 0.2 },
  plex: { cap: 0.7, desc: 0.22 },
};

const wordmarkSize = WORDMARK / (GLYPHS.wordmark.advance / GLYPHS.wordmark.em);
const wordmarkCap = wordmarkSize * FACE.unbounded.cap;
const wordmarkDesc = wordmarkSize * FACE.unbounded.desc;
const slabH = CTA_LINE + CTA_PAD_Y * 2;
const urlCap = URL_SIZE * FACE.plex.cap;
const urlDesc = URL_SIZE * FACE.plex.desc;

const TOTAL =
  MARK_INK_H +
  GAP +
  (wordmarkCap + wordmarkDesc) +
  GAP +
  (WITH_SLAB ? slabH + GAP * 0.8 : 0) +
  (urlCap + urlDesc);
const TOP = (H - TOTAL) / 2;

let y = TOP;
const markY = y;
y += MARK_INK_H + GAP;
const wordmarkBaseline = y + wordmarkCap;
y += wordmarkCap + wordmarkDesc + GAP;
const slabTop = y;
if (WITH_SLAB) y += slabH + GAP * 0.8;
const urlBaseline = y + urlCap;

const wordmark = setString("wordmark", wordmarkSize, wordmarkBaseline);
const url = setString("url", URL_SIZE, urlBaseline);

let slabSvg = "";
let slabW = 0;
if (WITH_SLAB) {
  const ctaSet = setString("cta", CTA_SIZE, slabTop + slabH / 2 + (CTA_SIZE * FACE.manrope.cap) / 2, {
    fill: INK.brand,
  });
  slabW = ctaSet.width + CTA_PAD_X * 2;
  slabSvg = `<rect x="${(CX - slabW / 2).toFixed(2)}" y="${slabTop.toFixed(2)}" width="${slabW.toFixed(2)}" height="${slabH.toFixed(2)}" fill="${INK.slab}"/>
  ${ctaSet.svg}`;
}

// The mark's own SVG carries CSS custom properties so the same markup can be themed on
// the site. A standalone rasteriser resolves no cascade, so they are substituted for the
// literal values the light theme resolves them to.
const markMarkup = ringsMarkSvg({ size: MARK_BOX, label: "" })
  .replace(/var\(--mark-ink\)/g, INK.type)
  .replace(/var\(--mark-duo\)/g, "#727569");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sweep" x1="0" y1="0" x2="0.0349" y2="1">
      <stop offset="0%" stop-color="#FAF8F2"/>
      <stop offset="52%" stop-color="${GROUND.base}"/>
      <stop offset="100%" stop-color="${GROUND.darkest}"/>
    </linearGradient>
    <radialGradient id="pool" cx="0.42" cy="0.5" r="0.62">
      <stop offset="0%" stop-color="#FFFFFB" stop-opacity="0.5"/>
      <stop offset="74%" stop-color="#FFFFFB" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sweep)"/>
  <rect width="${W}" height="${H}" fill="url(#pool)"/>
  <g transform="translate(${(CX - MARK_BOX / 2).toFixed(2)} ${(markY - MARK_INK_TOP).toFixed(2)})">${markMarkup}</g>
  ${wordmark.svg}
  ${slabSvg}
  ${url.svg}
</svg>`;

const out = path.join(ROOT, "site", OG_CARD);
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
const written = [OG_CARD];
// The old URL, for previews cached before the rename (see the top of this file).
if (OG_CARD !== "og.png") {
  copyFileSync(out, path.join(ROOT, "site", "og.png"));
  written.push("og.png (same card, for previews that cached the old URL)");
}

const meta = await sharp(out).metadata();
console.log(`PHASE "${PHASE}": ${WITH_SLAB ? "with" : "no"} "join the waitlist" slab`);
for (const f of written) {
  console.log(`wrote site/${f}  ${meta.width}x${meta.height}  ${(statSync(out).size / 1024).toFixed(1)} KB`);
}
console.log(
  `  wordmark ${WORDMARK.toFixed(0)}px wide at ${wordmarkSize.toFixed(1)}px  ` +
    `(advance ${(GLYPHS.wordmark.advance / 1000).toFixed(3)}em, browser measures 6.38em)`
);
console.log(`  mark ink ${MARK_INK_W.toFixed(0)}x${MARK_INK_H.toFixed(0)} = ${((MARK_INK_W / WORDMARK) * 100).toFixed(1)}% of the wordmark (end card: 26.0%)`);
console.log(`  ${WITH_SLAB ? `slab ${slabW.toFixed(0)}x${slabH.toFixed(0)}, ` : ""}stack ${TOTAL.toFixed(0)}px tall in ${H}`);
