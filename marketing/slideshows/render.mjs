#!/usr/bin/env node
// Renders the TikTok slideshows in slideshows.json to 1080x1920 PNGs with headless Chrome,
// checks every slide, and writes the files Cameron posts from.
//
//   node render.mjs                 all slideshows
//   node render.mjs 03 07           only these
//   node render.mjs --out <dir>     somewhere else (default: Videos\UGC\Ready to post\Slideshows)
//   node render.mjs --data <file>   another batch file (default: slideshows.json)
//
// A slide is only written to the output folder if it passes every check:
//   exact 1080x1920 PNG; every line of text inside x 60..940, y 200..1500 (TikTok's buttons
//   and caption cover the rest); nothing overflowing or overlapping; text contrast; real fonts
//   only (no fallback glyphs); plus the copy rules in lib/lint.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureBackgrounds, bgPath } from "./backgrounds.mjs";
import { launch } from "./lib/chrome.mjs";
import { lintBatch, lintFile, lintShow } from "./lib/lint.mjs";
import {
  OLD_DRAFT_DIR,
  captionTxt,
  folderName,
  slideLabel,
  howToPostTxt,
  logHasPostingData,
  postingLogCsv,
  sourcesTxt,
} from "./lib/posting.mjs";
import { SERIES_LABEL, contactSheetHtml, slideHtml } from "./lib/templates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, "cache");
const DEFAULT_OUT = "C:\\Users\\stall\\Videos\\UGC\\Ready to post\\Slideshows";
const W = 1080;
const H = 1920;
// TikTok-safe box for text. The brief's hard limits are x 940 and y 1500; the top tabs end near y 200.
export const SAFE = { left: 60, right: 940, top: 200, bottom: 1500 };
const MIN = { head: 56, body: 32 }; // px at 1080 wide: below this it fails
const WARN = { head: 64, body: 36, contrast: 4.5 };
const MIN_CONTRAST = 3.0;
const GHOST_GAP = 24; // px of clear space a ghost number keeps from any text line

const pad2 = (n) => String(n).padStart(2, "0");

function parseArgs(argv) {
  const out = { ids: [], out: DEFAULT_OUT, data: path.join(HERE, "slideshows.json") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out.out = argv[++i];
    else if (argv[i] === "--data") out.data = path.resolve(argv[++i]);
    else if (/^\d\d$/.test(argv[i])) out.ids.push(argv[i]);
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return out;
}

export function pngSize(buf) {
  const sig = "89504e470d0a1a0a";
  if (buf.subarray(0, 8).toString("hex") !== sig || buf.subarray(12, 16).toString() !== "IHDR") {
    throw new Error("not a PNG");
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error("bad JPEG");
    const m = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("no JPEG size");
}

// Tight (roughly ink-height) box for overlap tests; the full Range box is used for bounds.
const tight = (b) => {
  const yc = b.y0 + (b.y1 - b.y0) * 0.58;
  const half = b.fs * 0.42;
  return { x0: b.x0, x1: b.x1, y0: yc - half, y1: yc + half };
};

export function checkSlide({ prep, png, fonts, contrast }) {
  const errors = [];
  const warnings = [];
  const size = pngSize(png);
  if (size.width !== W || size.height !== H) errors.push(`PNG is ${size.width}x${size.height}, not ${W}x${H}`);
  if (prep.notLoaded.length) errors.push(`fonts not loaded: ${prep.notLoaded.join(", ")}`);
  if (prep.badImages.length) errors.push(`images failed: ${prep.badImages.join(", ")}`);
  for (const f of prep.fits) if (f.overflow) errors.push(`text does not fit in "${f.name}" even at ${f.k}x size`);

  const boxes = prep.boxes;
  if (!boxes.length) errors.push("no text found on the slide");
  for (const b of boxes) {
    const out = [];
    if (b.x0 < SAFE.left) out.push(`left ${b.x0.toFixed(0)} < ${SAFE.left}`);
    if (b.x1 > SAFE.right) out.push(`right ${b.x1.toFixed(0)} > ${SAFE.right}`);
    if (b.y0 < SAFE.top) out.push(`top ${b.y0.toFixed(0)} < ${SAFE.top}`);
    if (b.y1 > SAFE.bottom) out.push(`bottom ${b.y1.toFixed(0)} > ${SAFE.bottom}`);
    if (out.length) errors.push(`text outside the TikTok-safe box (${out.join(", ")}): "${b.text}"`);
    if (b.block === "untagged") errors.push(`untagged text "${b.text}"`);
  }
  // overlap between different text blocks
  const live = boxes.filter((b) => !b.decor);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const c = live[j];
      if (a.bid === c.bid) continue;
      const ta = tight(a);
      const tc = tight(c);
      const w = Math.min(ta.x1, tc.x1) - Math.max(ta.x0, tc.x0);
      const h = Math.min(ta.y1, tc.y1) - Math.max(ta.y0, tc.y0);
      if (w > 2 && h > 2) errors.push(`text overlaps: "${a.text}" and "${c.text}"`);
    }
  }
  // ghost numbers: their digits must stay clear of every text line (24 px above and below)
  let ghostGap = null; // smallest vertical gap between a ghost's digits and a text line above or below it
  for (const d of boxes.filter((b) => b.decor && b.ink)) {
    for (const t of live) {
      const tt = tight(t);
      const w = Math.min(d.ink.x1, tt.x1) - Math.max(d.ink.x0, tt.x0);
      const h = Math.min(d.ink.y1, tt.y1 + GHOST_GAP) - Math.max(d.ink.y0, tt.y0 - GHOST_GAP);
      if (w > 0 && h > 0) errors.push(`ghost number "${d.text}" runs into the text "${t.text}"`);
      if (w > 0) {
        const gap = Math.max(d.ink.y0 - tt.y1, tt.y0 - d.ink.y1);
        ghostGap = ghostGap === null ? gap : Math.min(ghostGap, gap);
      }
    }
  }
  // readable sizes
  for (const b of live) {
    const kind = b.block === "head" ? "head" : b.block === "body" || b.block === "lead" ? "body" : null;
    if (!kind) continue;
    if (b.fs < MIN[kind]) errors.push(`${kind} text is ${b.fs.toFixed(0)}px (min ${MIN[kind]}): "${b.text}"`);
    else if (b.fs < WARN[kind]) warnings.push(`${kind} text is ${b.fs.toFixed(0)}px: "${b.text}"`);
  }
  // only the real fonts
  for (const node of fonts) {
    for (const f of node.fonts) {
      if (!f.isCustomFont) errors.push(`fallback font "${f.familyName}" used for ${f.glyphCount} glyph(s)`);
    }
  }
  // contrast against what the text actually sits on
  let minContrast = Infinity;
  for (const c of contrast) {
    minContrast = Math.min(minContrast, c.p05);
    if (c.p05 < MIN_CONTRAST) errors.push(`low contrast ${c.p05.toFixed(2)}:1 for ${c.block} "${c.text}"`);
    else if (c.p05 < WARN.contrast) warnings.push(`contrast ${c.p05.toFixed(2)}:1 for ${c.block} "${c.text}"`);
  }
  const extent = {
    maxRight: Math.max(...boxes.map((b) => b.x1)),
    maxBottom: Math.max(...boxes.map((b) => b.y1)),
    minLeft: Math.min(...boxes.map((b) => b.x0)),
    minTop: Math.min(...boxes.map((b) => b.y0)),
  };
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], size, minContrast, extent, ghostGap };
}

export async function renderSlide(page, show, slide, i) {
  const bgFile = slide.bg ? bgPath(slide.bg) : null;
  const html = slideHtml(slide, i + 1, { bgFile });
  const htmlFile = path.join(CACHE, "html", `${show.id}-${pad2(i + 1)}.html`);
  fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
  fs.writeFileSync(htmlFile, html);
  await page.goto(pathToFileURL(htmlFile).href);
  const prep = await page.eval("window.__prep()");
  const png = await page.screenshot({ width: W, height: H });
  const fonts = await page.fontsUsed("body *");
  await page.eval('document.body.classList.add("probe"), true');
  const probe = await page.screenshot({ width: W, height: H });
  const contrast = await page.eval(
    `window.__contrast(${JSON.stringify(`data:image/png;base64,${probe.toString("base64")}`)}, ${JSON.stringify(prep.boxes)})`,
  );
  return { png, prep, fonts, contrast, htmlFile };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = JSON.parse(fs.readFileSync(args.data, "utf8"));
  const all = data.slideshows;
  const shows = args.ids.length ? all.filter((s) => args.ids.includes(s.id)) : all;
  if (!shows.length) throw new Error("no slideshows selected");

  // 1. copy rules
  const lintErrors = shows.flatMap((s) => lintShow(s, { seriesLabel: SERIES_LABEL }));
  lintErrors.push(...lintBatch(all)); // repeats are checked across the whole batch, even on a partial run
  const ids = all.map((s) => s.id);
  if (new Set(ids).size !== ids.length) lintErrors.push("duplicate slideshow ids");
  if ([...data.postOrder].sort().join() !== [...ids].sort().join()) lintErrors.push("postOrder must list every slideshow once");
  if (lintErrors.length) {
    console.error("COPY CHECK FAILED:\n  " + lintErrors.join("\n  "));
    process.exit(1);
  }
  console.log(`copy check passed for ${shows.length} slideshow(s)`);

  // 2. backgrounds
  ensureBackgrounds([...new Set(shows.flatMap((s) => s.slides.map((sl) => sl.bg).filter(Boolean)))]);

  // 3. render
  fs.mkdirSync(args.out, { recursive: true });
  const browser = await launch({ profileDir: path.join(CACHE, "chrome-profile") });
  const report = [];
  let failed = 0;
  let warned = 0;
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
        let file;
        if (res.errors.length) {
          failed++;
          file = path.join(CACHE, "failed", `${show.id}-${name}`);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, r.png);
        } else {
          file = path.join(folder, name);
          fs.writeFileSync(file, r.png);
          const back = pngSize(fs.readFileSync(file)); // verify what is on disk
          if (back.width !== W || back.height !== H) throw new Error(`${file} is ${back.width}x${back.height} on disk`);
          written.push({ file, label: slideLabel(slide) });
        }
        if (res.warnings.length) warned++;
        const ks = r.prep.fits.map((f) => f.k).join("/");
        const status = res.errors.length ? "FAIL" : res.warnings.length ? "warn" : "ok";
        console.log(
          `${show.id}/${name} ${status.padEnd(4)} ${slide.layout.padEnd(10)} size x${ks} contrast>=${res.minContrast.toFixed(1)} ` +
            `text x ${res.extent.minLeft.toFixed(0)}..${res.extent.maxRight.toFixed(0)} y ${res.extent.minTop.toFixed(0)}..${res.extent.maxBottom.toFixed(0)}` +
            (res.ghostGap === null ? "" : ` ghost gap ${res.ghostGap.toFixed(0)}px`),
        );
        for (const e of res.errors) console.log(`    ERROR ${e}`);
        for (const w of res.warnings) console.log(`    warn  ${w}`);
        report.push({ show: show.id, slide: i + 1, file, layout: slide.layout, fit: r.prep.fits, ...res });
      }

      // caption.txt
      const cap = captionTxt(show);
      const capErr = lintFile(`${show.id} caption.txt`, cap);
      if (capErr.length) throw new Error(capErr.join("\n"));
      fs.writeFileSync(path.join(folder, "caption.txt"), cap);

      // contact sheet
      if (written.length === show.slides.length) {
        const info = `${show.slides.length} slides, 1080x1920. ${
          show.appCta ? "The last slide names DuoQueue: disclosure ON." : "No app mention anywhere: no disclosure."
        } Hook: ${show.hookType}. Opener: "${show.opener.replace(/\.$/, "")}".`;
        const sheet = contactSheetHtml({ title: folderName(show), info, slides: written });
        const sheetHtml = path.join(CACHE, "html", `${show.id}-sheet.html`);
        fs.writeFileSync(sheetHtml, sheet.html);
        await page.setSize(sheet.width, sheet.height);
        await page.goto(pathToFileURL(sheetHtml).href);
        await page.eval("Promise.all([...document.images].map(i => i.decode())).then(() => document.fonts.ready).then(() => true)");
        const jpg = await page.screenshot({ width: sheet.width, height: sheet.height, format: "jpeg", quality: 88 });
        const js = jpegSize(jpg);
        if (js.width !== sheet.width || js.height !== sheet.height) throw new Error("contact sheet size mismatch");
        fs.writeFileSync(path.join(folder, "contact-sheet.jpg"), jpg);
        await page.setSize(W, H);
      } else {
        console.log(`  ${show.id}: no contact sheet (some slides failed)`);
      }
    }
  } finally {
    await browser.close();
  }

  // 4. batch files (only on a full run, so a partial run never rewrites them from a subset)
  if (!args.ids.length) {
    const current = new Set(all.map(folderName));
    const stale = fs
      .readdirSync(args.out, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d\d\s/.test(d.name) && !current.has(d.name))
      .map((d) => d.name)
      .sort();
    for (const d of stale) {
      const note = path.join(args.out, d, "OLD DRAFT - DO NOT POST.txt");
      if (!fs.existsSync(note)) {
        fs.writeFileSync(note, "This folder is an older draft of the slideshows. Don't post it. See HOW TO POST.txt one folder up.\n");
      }
    }
    const files = {
      "HOW TO POST.txt": howToPostTxt(all, data.postOrder, {
        staleFolders: stale,
        oldDraft: fs.existsSync(path.join(args.out, OLD_DRAFT_DIR)),
      }),
      "sources.txt": sourcesTxt(all),
    };
    for (const [name, text] of Object.entries(files)) {
      const errs = lintFile(name, text);
      if (errs.length) throw new Error(errs.join("\n"));
      fs.writeFileSync(path.join(args.out, name), text);
    }
    const logFile = path.join(args.out, "posting-log.csv");
    const log = postingLogCsv(all, data.postOrder);
    if (fs.existsSync(logFile) && logHasPostingData(fs.readFileSync(logFile, "utf8"))) {
      fs.writeFileSync(path.join(args.out, "posting-log.new.csv"), log);
      console.log("posting-log.csv already has your numbers in it, so the new one went to posting-log.new.csv");
    } else {
      fs.writeFileSync(logFile, log);
    }
    if (stale.length) console.log(`old folders to delete by hand (listed in HOW TO POST.txt): ${stale.join(" | ")}`);
  }

  fs.writeFileSync(path.join(CACHE, "report.json"), JSON.stringify(report, null, 2));
  const total = report.length;
  console.log(`\n${total - failed}/${total} slides passed every check${warned ? ` (${warned} with warnings)` : ""}. Output: ${args.out}`);
  if (failed) {
    console.log(`${failed} slide(s) FAILED and were not written to the output; see cache/failed and cache/report.json`);
    process.exit(1);
  }
}

// Run only when started as `node render.mjs`, so a test can import checkSlide.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.stack || e.message);
    process.exit(1);
  });
}
