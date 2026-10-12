// Instagram versions of the TikTok slideshows, in both shapes Cameron posts:
//
//   swipe  3:4 (1080x1440) photos people swipe through, with a song added in the app. 3:4 is
//          the tallest a feed photo can be; Instagram crops anything taller itself.
//   reel   9:16 (1080x1920) slides he turns into a Reel with music. In a Reel a 3:4 photo is
//          zoomed to fill the screen and cut off at the sides (12 Oct 2026), so Reels get the
//          full-height slide.
//
//   node instagram.mjs                   both shapes, all ten
//   node instagram.mjs swipe 07 09       one shape, only these
//   node instagram.mjs --out <dir>       somewhere else (a folder per shape is made inside)
//
// Output: Videos\UGC\Ready to post\Instagram swipe posts and \Instagram reels.
//
// Every slide is rendered and checked exactly as render.mjs does at 1080x1920 (safe zone, fit,
// overlap, fonts, contrast); the reel keeps that frame (text inside x 60..940, y 200..1500, clear
// of the button column and bottom caption, which Reels and TikTok put in the same places). The
// swipe post is captured again as a 3:4 window, x 0..1000 by y 198..1531 in slide pixels: every
// line of text sits in x 72..924, y 231..1491 (cache/report.json, 3 Oct batch), so the text lands
// centred with about 35 px above and 40 px below, the window starts just under the paper band
// (y 0..198), and Chrome draws it at device scale 1.08 so the text is rasterised at final size.
//
// 07 to 10 never named DuoQueue on TikTok (they were the account test). Instagram has no such
// test, so each gains a closing slide in the same cta layout 01 to 06 end on.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderSlide, checkSlide, pngSize } from "./render.mjs";
import { launch } from "./lib/chrome.mjs";
import { lintShow, lintBatch, lintFile } from "./lib/lint.mjs";
import { SERIES_LABEL, contactSheetHtml } from "./lib/templates.mjs";
import { folderName, slideLabel } from "./lib/posting.mjs";
import { ensureBackgrounds, bgSourceNote } from "./backgrounds.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, "cache");
const READY = "C:\\Users\\stall\\Videos\\UGC\\Ready to post";
const W = 1080;
const H = 1920;
const pad2 = (n) => String(n).padStart(2, "0");

const CROP = { x: 0, y: 198, width: 1000, height: 4000 / 3 };
const MARGIN = 20; // swipe: text must keep this far inside the crop
export const FORMATS = {
  swipe: { dir: "Instagram swipe posts", w: 1080, h: 1440, ratio: "3:4", tile: 540 },
  reel: { dir: "Instagram reels", w: 1080, h: 1920, ratio: "9:16", tile: 720 },
};

// The closing slide 07 to 10 gain. Same line and small text as 01 to 06; each head is its own,
// because lintBatch refuses a 7-word run shared by two slideshows.
const ADDED_CTA = {
  "07": "Want a duo who climbs on facts, not myths?",
  "08": "Want a duo who knows when to log off?",
  "09": "Want a duo who talks like this?",
  "10": "Want a duo who makes these calls?",
};
const RIOT_LINE = "DuoQueue isn't endorsed by Riot Games.";

function parseArgs(argv) {
  const out = { out: READY, ids: [], formats: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out.out = argv[++i];
    else if (FORMATS[argv[i]]) out.formats.push(argv[i]);
    else if (/^\d\d$/.test(argv[i])) out.ids.push(argv[i]);
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!out.formats.length) out.formats = Object.keys(FORMATS);
  return out;
}

// Instagram has no title field, so the TikTok title becomes the caption's first line, and the
// hashtags move to their own paragraph.
function igCaption(show, appended) {
  const m = show.caption.match(/^(.*?)\s*((?:#\w+\s*)+)$/s);
  let text = m ? m[1].trim() : show.caption.trim();
  let tags = m ? m[2].trim().split(/\s+/) : [];
  if (appended && !text.includes(RIOT_LINE)) text = `${text} ${RIOT_LINE}`;
  if (!tags.includes("#duoqueue")) tags.push("#duoqueue");
  return `${show.title}\n\n${text}\n\n${tags.join(" ")}`;
}

export function instagramShows(all) {
  return all.map((s) => {
    const appended = !s.appCta;
    const slides = appended
      ? [
          ...s.slides,
          { role: "cta", layout: "cta", head: ADDED_CTA[s.id], line: "Search DuoQueue on the App Store.", small: "Free to download on iPhone." },
        ]
      : s.slides;
    if (appended && !ADDED_CTA[s.id]) throw new Error(`${s.id} has no Instagram closing slide in ADDED_CTA`);
    return { ...s, slides, appCta: true, appended, caption: igCaption(s, appended) };
  });
}

function captionTxt(show, fmt) {
  const n = show.slides.length;
  const L = [];
  if (fmt === "swipe") {
    L.push(`SWIPE POST ${show.id}: ${show.title}`);
    L.push(`Instagram post of ${n} photos at 3:4 that people swipe through. Add 01.png to ${pad2(n)}.png in order, 01 first.`);
  } else {
    L.push(`REEL ${show.id}: ${show.title}`);
    L.push(`Instagram Reel made from ${n} photos at 9:16. Add 01.png to ${pad2(n)}.png in order, 01 first.`);
  }
  L.push("");
  L.push("CAPTION (paste it all):");
  L.push(show.caption);
  L.push("");
  L.push("BEFORE YOU POST:");
  if (fmt === "swipe") {
    L.push("- In the Instagram app: + then Post, pick the slides in order, keep them at 3:4 (if the preview");
    L.push("  crops them square, change the crop), add a song, tap Next, and paste the caption.");
  } else {
    L.push("- In the Instagram app: + then Reel, pick the slides from your camera roll in order, add a song,");
    L.push("  tap Next, and paste the caption.");
  }
  L.push("- No #leagueoflegends, #lol or #riot.");
  if (show.appended) L.push(`- Slide ${pad2(n)} is new for Instagram: the TikTok version of this one never named DuoQueue.`);
  L.push("");
  L.push("WHAT IS ON EACH SLIDE:");
  show.slides.forEach((s, i) => {
    L.push(`${pad2(i + 1)}  ${slideLabel(s)}`);
    if (s.bg) L.push(`    background: ${bgSourceNote(s.bg)}`);
    if (s.source) L.push(`    source: ${s.source}`);
    if (s.take) L.push(`    marked on the slide as ${s.take} (opinion)`);
    if (s.role === "cta") L.push("    the one DuoQueue slide");
  });
  L.push("");
  L.push("FULL SOURCES:");
  for (const src of show.sources) L.push(`- ${src}`);
  return L.join("\n") + "\n";
}

// The 3:4 window of the slide already laid out in the page, drawn at device scale 1.08.
async function cropShot(page) {
  await page.eval('document.body.classList.remove("probe"), true');
  await page.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1.08, mobile: false });
  await page.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))");
  const r = await page.send("Page.captureScreenshot", { format: "png", clip: { ...CROP, scale: 1 }, captureBeyondViewport: false, fromSurface: true });
  await page.setSize(W, H);
  return Buffer.from(r.data, "base64");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = JSON.parse(fs.readFileSync(path.join(HERE, "slideshows.json"), "utf8"));
  const all = instagramShows(data.slideshows);
  const shows = args.ids.length ? all.filter((s) => args.ids.includes(s.id)) : all;
  if (!shows.length) throw new Error("no slideshows selected");

  const lintErrors = shows.flatMap((s) => lintShow(s, { seriesLabel: SERIES_LABEL, maxSlides: 9 }));
  lintErrors.push(...lintBatch(all));
  if (lintErrors.length) {
    console.error("COPY CHECK FAILED:\n  " + lintErrors.join("\n  "));
    process.exit(1);
  }
  console.log(`copy check passed for ${shows.length} set(s), formats: ${args.formats.join(", ")}`);

  await ensureBackgrounds([...new Set(shows.flatMap((s) => s.slides.map((sl) => sl.bg).filter(Boolean)))]);
  const browser = await launch({ profileDir: path.join(CACHE, "chrome-profile") });
  let failed = 0;
  try {
    const page = await browser.newPage({ width: W, height: H });
    for (const show of shows) {
      const folders = Object.fromEntries(args.formats.map((f) => [f, path.join(args.out, FORMATS[f].dir, folderName(show))]));
      for (const d of Object.values(folders)) fs.mkdirSync(d, { recursive: true });
      const written = Object.fromEntries(args.formats.map((f) => [f, []]));
      for (let i = 0; i < show.slides.length; i++) {
        const slide = show.slides[i];
        const r = await renderSlide(page, show, slide, i);
        const res = checkSlide(r);
        const e = res.extent;
        if (args.formats.includes("swipe")) {
          if (e.minLeft < CROP.x + MARGIN || e.maxRight > CROP.x + CROP.width - MARGIN) res.errors.push(`text x ${e.minLeft}..${e.maxRight} outside the 3:4 crop`);
          if (e.minTop < CROP.y + MARGIN || e.maxBottom > CROP.y + CROP.height - MARGIN) res.errors.push(`text y ${e.minTop}..${e.maxBottom} outside the 3:4 crop`);
        }
        const name = `${pad2(i + 1)}.png`;
        if (res.errors.length) {
          failed++;
          console.log(`${show.id}/${name} FAIL`);
          for (const err of res.errors) console.log(`    ERROR ${err}`);
          continue;
        }
        for (const f of args.formats) {
          // the reel is the checked 1080x1920 frame itself; the swipe post is its 3:4 window
          const png = f === "reel" ? r.png : await cropShot(page);
          const file = path.join(folders[f], name);
          fs.writeFileSync(file, png);
          const back = pngSize(fs.readFileSync(file));
          if (back.width !== FORMATS[f].w || back.height !== FORMATS[f].h) throw new Error(`${file} is ${back.width}x${back.height}, want ${FORMATS[f].w}x${FORMATS[f].h}`);
          written[f].push({ file, label: slideLabel(slide) });
        }
        console.log(`${show.id}/${name} ok   ${slide.layout.padEnd(10)} text x ${e.minLeft.toFixed(0)}..${e.maxRight.toFixed(0)} y ${e.minTop.toFixed(0)}..${e.maxBottom.toFixed(0)}` + (res.warnings.length ? `  warn: ${res.warnings.join("; ")}` : ""));
      }

      for (const f of args.formats) {
        const cap = captionTxt(show, f);
        const capErr = lintFile(`${show.id} ${f} caption.txt`, cap);
        if (capErr.length) throw new Error(capErr.join("\n"));
        fs.writeFileSync(path.join(folders[f], "caption.txt"), cap);
        if (written[f].length !== show.slides.length) continue;
        const kind = f === "swipe" ? "photos people swipe through" : "an Instagram Reel";
        const info = `${show.slides.length} slides, ${FORMATS[f].w}x${FORMATS[f].h} (${FORMATS[f].ratio}) for ${kind}.${show.appended ? ` Slide ${pad2(show.slides.length)} is new: the TikTok version never named DuoQueue.` : ""}`;
        const sheet = contactSheetHtml({ title: folderName(show), info, slides: written[f], tileHeight: FORMATS[f].tile });
        const sheetHtml = path.join(CACHE, "html", `${show.id}-ig-${f}-sheet.html`);
        fs.writeFileSync(sheetHtml, sheet.html);
        await page.setSize(sheet.width, sheet.height);
        await page.goto(pathToFileURL(sheetHtml).href);
        await page.eval("Promise.all([...document.images].map(i => i.decode())).then(() => document.fonts.ready).then(() => true)");
        const jpg = await page.screenshot({ width: sheet.width, height: sheet.height, format: "jpeg", quality: 88 });
        fs.writeFileSync(path.join(folders[f], "contact-sheet.jpg"), jpg);
        await page.setSize(W, H);
      }
    }
  } finally {
    await browser.close();
  }
  if (failed) {
    console.log(`${failed} slide(s) FAILED and were not written`);
    process.exit(1);
  }
  console.log(`\nall slides passed. Output: ${args.formats.map((f) => path.join(args.out, FORMATS[f].dir)).join(" and ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.stack || e.message);
    process.exit(1);
  });
}
