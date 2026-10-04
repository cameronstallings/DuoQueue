#!/usr/bin/env node
// Re-checks what is on disk in the output folder, without rendering anything:
//   node verify.mjs [--out <dir>] [--data <file>]
// For every slideshow: the folder exists, it holds exactly 01.png..NN.png, each is a complete
// 1080x1920 PNG, caption.txt carries the title, description and the right disclosure note,
// contact-sheet.jpg is a real JPEG, and cache/report.json (from the last render) shows every
// slide's text inside x 60..940, y 200..1500 with no errors. Exits 1 on any problem.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DASHES } from "./lib/lint.mjs";
import { folderName } from "./lib/posting.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const OUT = opt("--out", "C:\\Users\\stall\\Videos\\UGC\\Ready to post\\Slideshows");
const data = JSON.parse(fs.readFileSync(opt("--data", path.join(HERE, "slideshows.json")), "utf8"));
const SAFE = { left: 60, right: 940, top: 200, bottom: 1500 };

const problems = [];
const bad = (m) => problems.push(m);

function png(file) {
  const b = fs.readFileSync(file);
  if (b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return { ok: false };
  const ihdr = b.subarray(12, 16).toString() === "IHDR";
  const iend = b.subarray(b.length - 8, b.length - 4).toString() === "IEND";
  return { ok: ihdr && iend, width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}
function jpeg(file) {
  const b = fs.readFileSync(file);
  return b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
}

const reportFile = path.join(HERE, "cache", "report.json");
const report = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, "utf8")) : [];
const rep = new Map(report.map((r) => [`${r.show}-${r.slide}`, r]));

let slides = 0;
let maxRight = 0;
let maxBottom = 0;
for (const show of data.slideshows) {
  const dir = path.join(OUT, folderName(show));
  if (!fs.existsSync(dir)) {
    bad(`${show.id}: missing folder ${dir}`);
    continue;
  }
  const n = show.slides.length;
  const pngs = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort();
  const want = Array.from({ length: n }, (_, i) => `${String(i + 1).padStart(2, "0")}.png`);
  if (pngs.join() !== want.join()) bad(`${show.id}: PNGs are [${pngs.join(", ")}], want [${want.join(", ")}]`);
  for (const f of want) {
    const file = path.join(dir, f);
    if (!fs.existsSync(file)) continue;
    const p = png(file);
    if (!p.ok) bad(`${show.id}/${f}: not a complete PNG`);
    else if (p.width !== 1080 || p.height !== 1920) bad(`${show.id}/${f}: ${p.width}x${p.height}`);
    slides++;
    const r = rep.get(`${show.id}-${Number(f.slice(0, 2))}`);
    if (!r) bad(`${show.id}/${f}: not in cache/report.json (render it again)`);
    else {
      if (r.errors.length) bad(`${show.id}/${f}: report has errors: ${r.errors.join("; ")}`);
      const e = r.extent;
      maxRight = Math.max(maxRight, e.maxRight);
      maxBottom = Math.max(maxBottom, e.maxBottom);
      if (e.maxRight > SAFE.right || e.maxBottom > SAFE.bottom || e.minLeft < SAFE.left || e.minTop < SAFE.top) {
        bad(`${show.id}/${f}: text extent x ${e.minLeft}..${e.maxRight} y ${e.minTop}..${e.maxBottom} leaves the safe box`);
      }
    }
  }
  const capFile = path.join(dir, "caption.txt");
  if (!fs.existsSync(capFile)) bad(`${show.id}: no caption.txt`);
  else {
    const cap = fs.readFileSync(capFile, "utf8");
    if (!cap.includes(show.title)) bad(`${show.id}: caption.txt lacks the title`);
    if (!cap.includes(show.caption)) bad(`${show.id}: caption.txt lacks the description`);
    const on = /Disclose commercial content, then pick Your brand/.test(cap.replace(/\s+/g, " "));
    if (show.appCta && !on) bad(`${show.id}: caption.txt lacks the disclosure steps`);
    if (!show.appCta && on) bad(`${show.id}: caption.txt asks for disclosure on a no-app post`);
    if (DASHES.test(cap)) bad(`${show.id}: dash character in caption.txt`);
  }
  const sheet = path.join(dir, "contact-sheet.jpg");
  if (!fs.existsSync(sheet) || !jpeg(sheet)) bad(`${show.id}: contact-sheet.jpg missing or broken`);
}
for (const f of ["HOW TO POST.txt", "sources.txt", "posting-log.csv"]) {
  const file = path.join(OUT, f);
  if (!fs.existsSync(file)) bad(`missing ${f}`);
  else if (DASHES.test(fs.readFileSync(file, "utf8"))) bad(`dash character in ${f}`);
}

console.log(`${data.slideshows.length} slideshows, ${slides} slides checked in ${OUT}`);
console.log(`text furthest right: x ${maxRight.toFixed(1)} (limit 940); lowest: y ${maxBottom.toFixed(1)} (limit 1500)`);
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("all good");
