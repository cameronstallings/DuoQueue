// Instagram versions of the TikTok slideshows, at Reels size (9:16, 1080x1920).
//
//   node instagram.mjs               all ten, into Videos\UGC\Ready to post\Instagram reels
//   node instagram.mjs 07 09         only these
//   node instagram.mjs --out <dir>   somewhere else
//
// Cameron turns each set of slides into a Reel with music on his phone (Instagram's desktop
// site can't add music). The first Instagram versions were 3:4 feed crops, and in a Reel those
// were zoomed to fill the 9:16 screen and cut off at the sides (12 Oct 2026, his call: "make it
// the right size... don't keep them anywhere if they don't fit"). So these are full 1080x1920
// slides on the same layout as the TikTok ones: every line of text stays inside x 60..940 and
// y 200..1500, clear of the button column on the right and the caption over the bottom, which
// Reels and TikTok both put in the same places.
//
// Every slide is rendered and checked exactly as render.mjs does (safe zone, fit, overlap,
// fonts, contrast). 07 to 10 never named DuoQueue on TikTok (they were the account test);
// Instagram has no such test, so each gains a closing slide in the same cta layout 01 to 06
// end on.
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
const DEFAULT_OUT = "C:\\Users\\stall\\Videos\\UGC\\Ready to post\\Instagram reels";
const W = 1080;
const H = 1920;
const pad2 = (n) => String(n).padStart(2, "0");

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
  const out = { out: DEFAULT_OUT, ids: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out.out = argv[++i];
    else if (/^\d\d$/.test(argv[i])) out.ids.push(argv[i]);
    else throw new Error(`unknown argument ${argv[i]}`);
  }
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

function captionTxt(show) {
  const n = show.slides.length;
  const L = [];
  L.push(`REEL ${show.id}: ${show.title}`);
  L.push(`Instagram Reel made from ${n} photos at 9:16. Add 01.png to ${pad2(n)}.png in order, 01 first.`);
  L.push("");
  L.push("CAPTION (paste it all):");
  L.push(show.caption);
  L.push("");
  L.push("BEFORE YOU POST:");
  L.push("- In the Instagram app: + then Reel, pick the slides from your camera roll in order, add a song,");
  L.push("  tap Next, and paste the caption.");
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
  console.log(`copy check passed for ${shows.length} reel(s)`);

  await ensureBackgrounds([...new Set(shows.flatMap((s) => s.slides.map((sl) => sl.bg).filter(Boolean)))]);
  fs.mkdirSync(args.out, { recursive: true });
  const browser = await launch({ profileDir: path.join(CACHE, "chrome-profile") });
  let failed = 0;
  try {
    const page = await browser.newPage({ width: W, height: H });
    for (const show of shows) {
      const folder = path.join(args.out, folderName(show));
      fs.mkdirSync(folder, { recursive: true });
      const written = [];
      for (let i = 0; i < show.slides.length; i++) {
        const slide = show.slides[i];
        const r = await renderSlide(page, show, slide, i);
        const res = checkSlide(r);
        const name = `${pad2(i + 1)}.png`;
        if (res.errors.length) {
          failed++;
          console.log(`${show.id}/${name} FAIL`);
          for (const err of res.errors) console.log(`    ERROR ${err}`);
          continue;
        }
        const file = path.join(folder, name);
        fs.writeFileSync(file, r.png);
        const back = pngSize(fs.readFileSync(file));
        if (back.width !== W || back.height !== H) throw new Error(`${file} is ${back.width}x${back.height}, want ${W}x${H}`);
        written.push({ file, label: slideLabel(slide) });
        const e = res.extent;
        console.log(
          `${show.id}/${name} ok   ${slide.layout.padEnd(10)} text x ${e.minLeft.toFixed(0)}..${e.maxRight.toFixed(0)} y ${e.minTop.toFixed(0)}..${e.maxBottom.toFixed(0)}` +
            (res.warnings.length ? `  warn: ${res.warnings.join("; ")}` : ""),
        );
      }

      const cap = captionTxt(show);
      const capErr = lintFile(`${show.id} caption.txt`, cap);
      if (capErr.length) throw new Error(capErr.join("\n"));
      fs.writeFileSync(path.join(folder, "caption.txt"), cap);

      if (written.length === show.slides.length) {
        const info = `${show.slides.length} slides, 1080x1920 (9:16) for an Instagram Reel.${show.appended ? ` Slide ${pad2(show.slides.length)} is new: the TikTok version never named DuoQueue.` : ""}`;
        const sheet = contactSheetHtml({ title: folderName(show), info, slides: written });
        const sheetHtml = path.join(CACHE, "html", `${show.id}-ig-sheet.html`);
        fs.writeFileSync(sheetHtml, sheet.html);
        await page.setSize(sheet.width, sheet.height);
        await page.goto(pathToFileURL(sheetHtml).href);
        await page.eval("Promise.all([...document.images].map(i => i.decode())).then(() => document.fonts.ready).then(() => true)");
        const jpg = await page.screenshot({ width: sheet.width, height: sheet.height, format: "jpeg", quality: 88 });
        fs.writeFileSync(path.join(folder, "contact-sheet.jpg"), jpg);
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
  console.log(`\nall slides passed. Output: ${args.out}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.stack || e.message);
    process.exit(1);
  });
}
