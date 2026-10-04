// HTML for one slide. Layouts: hook-photo, tip-photo (Cameron's frames and photos) and the
// six Volt type treatments: slab (T1), card (T2), paper (T3), flood (T4), log (T5), rails (T6),
// plus cta (T1 with a plain drawn search field: no app screens).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(HERE, "..", "fonts");
const CSS = fs.readFileSync(path.join(HERE, "slide.css"), "utf8");
const PAGE_JS = fs.readFileSync(path.join(HERE, "page.js"), "utf8");

const FACES = [
  ["Manrope", 500, "Manrope_500Medium.ttf"],
  ["Manrope", 600, "Manrope_600SemiBold.ttf"],
  ["Manrope", 700, "Manrope_700Bold.ttf"],
  ["Manrope", 800, "Manrope_800ExtraBold.ttf"],
  ["Plex Mono", 500, "IBMPlexMono_500Medium.ttf"],
  ["Plex Mono", 600, "IBMPlexMono_600SemiBold.ttf"],
];
const FONT_CSS = FACES.map(
  ([family, weight, file]) =>
    `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:block;src:url("${pathToFileURL(path.join(FONT_DIR, file)).href}") format("truetype");}`,
).join("\n");

export const SERIES_LABEL = "Ranked notes";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Keep "jungle + mid" pairs and hyphenated words ("6-minute", "if-then") on one line.
const nb = (html) =>
  html.replace(/(\S+ \+ \S+)/g, '<span class="nw">$1</span>').replace(/(\S*\w-\w\S*)/g, '<span class="nw">$1</span>');
const txt = (s) => nb(esc(smart(s)));

// Straight quotes to curly ones (slides only; captions stay plain for TikTok).
export function smart(s) {
  return String(s)
    .replace(/(^|[\s([{])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/(^|[\s([{])'/g, "$1‘")
    .replace(/'/g, "’");
}

const pad2 = (n) => String(n).padStart(2, "0");

// Headline HTML: smart quotes, optional wrapping quotes, optional highlighted phrase.
// A "\n" in head forces a line break on the slide (captions show a space).
function headHtml(slide) {
  let text = slide.quote ? `"${slide.head}"` : slide.head;
  text = smart(text);
  const br = (html) => html.replace(/\n/g, "<br>");
  if (!slide.mark) return br(nb(esc(text)));
  const at = text.indexOf(smart(slide.mark));
  if (at < 0) throw new Error(`mark "${slide.mark}" is not in the headline "${slide.head}"`);
  // Punctuation right after the highlight goes inside it: a lone "?" or "," after the box reads
  // as a stray mark ("no sleep ?").
  let end = at + smart(slide.mark).length;
  while (end < text.length && /[,.;:?!”’]/.test(text[end])) end++;
  return br(`${nb(esc(text.slice(0, at)))}<span class="mark">${nb(esc(text.slice(at, end)))}</span>${nb(esc(text.slice(end)))}`);
}

const header = (n) =>
  `<div class="hdr" data-block="hdr"><span><i class="sq"></i>${esc(SERIES_LABEL)}</span><span>${pad2(n)}</span></div>`;

function krow(slide, { chip } = {}) {
  const parts = [];
  if (chip) parts.push(`<span class="chip truth" data-block="chip">${esc(chip)}</span>`);
  if (slide.kicker) parts.push(`<span class="kicker" data-block="kicker">${esc(smart(slide.kicker))}</span>`);
  if (slide.take) parts.push(`<span class="chip take" data-block="take">${esc(slide.take)}</span>`);
  return parts.length ? `<div class="krow">${parts.join("")}</div>` : "";
}

const body = (slide) => (slide.body ? `<p class="body" data-block="body">${txt(slide.body)}</p>` : "");
const src = (slide) => (slide.source ? `<div class="src" data-block="src">Source: ${esc(smart(slide.source))}</div>` : "");

// Ghost index numeral on cards: "HABIT 3 OF 6" -> 03, "RANK #2" -> 02.
function ghostFor(slide) {
  const m = (slide.kicker || "").match(/(\d+)\s+OF\s+\d+|#(\d+)/i);
  return m ? pad2(m[1] || m[2]) : null;
}

const MAG = `<svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="23" cy="23" r="15" fill="none" stroke="#cdff3d" stroke-width="6"/><line x1="34.5" y1="34.5" x2="49" y2="49" stroke="#cdff3d" stroke-width="6" stroke-linecap="round"/></svg>`;

function layoutHtml(slide, n, bgUrl) {
  const z = slide.zone || {};
  switch (slide.layout) {
    case "hook-photo": {
      const top = z.top ?? 860;
      const bottom = z.bottom ?? 1472;
      const band = bottom < 1400 ? "1" : "0";
      // openerInHead: the headline already starts with the opener ("Have you ever noticed..."),
      // so no chip is drawn on top of it.
      const chip = slide.openerInHead
        ? ""
        : `<span class="chip opener" data-block="opener">${esc(smart(slide.opener.replace(/\.$/, "")))}</span>`;
      return {
        theme: "",
        html: `<img class="bg" src="${bgUrl}" alt="">
<div class="scrim" data-scrim="#hook" data-band="${band}"></div>
<div class="fit bottom wide" data-name="hook" style="top:${top - 28}px;bottom:${1920 - bottom - 28}px">
  <div id="hook" style="display:flex;flex-direction:column">
    ${chip}
    <h1 class="head h-hook" data-block="head">${headHtml(slide)}</h1>
  </div>
</div>`,
      };
    }
    case "tip-photo": {
      const top = z.top ?? 780;
      const bottom = z.bottom ?? 1472;
      return {
        theme: "",
        html: `<img class="bg" src="${bgUrl}" alt="">
<div class="fit bottom slab" data-name="panel" style="top:${top - 28}px;bottom:${1920 - bottom - 28}px">
  <div class="panel">
    ${krow(slide)}
    <h2 class="head h-panel" data-block="head">${headHtml(slide)}</h2>
    ${body(slide)}
    ${src(slide)}
  </div>
</div>`,
      };
    }
    case "card": {
      const g = ghostFor(slide);
      return {
        theme: "",
        // A card with no number has no ghost to fill its lower half: page.js shrinks it to its
        // text and centres it instead of leaving an empty panel.
        html: `<div class="grid"></div>${header(n)}
<div class="fit cardbox slab${g ? "" : " noghost"}" data-name="card">
  ${g ? `<div class="ghost in-card" data-decor>${g}</div>` : ""}
  ${krow(slide)}
  <h2 class="head h-card" data-block="head">${headHtml(slide)}</h2>
  ${body(slide)}
  <div class="spacer"></div>
  ${src(slide)}
</div>`,
      };
    }
    case "paper":
      return {
        theme: "paper-theme",
        html: `<div class="band"></div>${header(n)}
<div class="fit center wide" data-name="paper" style="top:300px;bottom:420px">
  <div>
    ${krow(slide, { chip: slide.chip })}
    <h2 class="head h-paper" data-block="head">${headHtml(slide)}</h2>
    ${body(slide)}
    ${src(slide)}
  </div>
</div>`,
      };
    case "flood":
      return {
        theme: "flood-theme",
        html: `${header(n)}
<div class="fit center wide" data-name="flood" style="top:300px;bottom:420px">
  <div style="display:flex;flex-direction:column">
    ${krow(slide)}
    <h2 class="head h-flood" data-block="head">${headHtml(slide)}</h2>
    <div class="rule"></div>
    ${body(slide)}
    ${src(slide)}
  </div>
</div>`,
      };
    case "log": {
      const rows = slide.rows || [];
      const rh = rows.length > 4 ? 78 : 92;
      const rowHtml = rows
        .map(
          (r, i) =>
            `<div class="row${i === rows.length - 1 ? " lit" : ""}" data-block="row"><span>${esc(r[0])}</span><span>${esc(r[1] || "")}</span></div>`,
        )
        .join("");
      return {
        theme: "",
        html: `<div class="grid"></div>${header(n)}
<div class="fit wide" data-name="log" style="top:300px;bottom:420px;--rh:${rh}px">
  <div class="rows">${rowHtml}</div>
  <div class="stmt">
    ${krow(slide)}
    <h2 class="head h-log" data-block="head">${headHtml(slide)}</h2>
    ${body(slide)}
    ${src(slide)}
  </div>
</div>`,
      };
    }
    case "rails": {
      const [[l1, t1], [l2, t2]] = slide.rails;
      const q = (label, t) => txt(/SAY/i.test(label) ? `"${t}"` : t);
      return {
        theme: "",
        html: `<div class="grid"></div>${header(n)}
<div class="fit center wide" data-name="rails" style="top:300px;bottom:420px">
  <div style="display:flex;flex-direction:column">
    ${krow(slide)}
    <h2 class="head h-rails" data-block="head">${headHtml(slide)}</h2>
    <div class="rail r1"><div class="rl" data-block="rail1-label">${esc(l1)}</div><div class="rq" data-block="rail1">${q(l1, t1)}</div></div>
    <div class="rail r2"><div class="rl" data-block="rail2-label">${esc(l2)}</div><div class="ra" data-block="rail2">${q(l2, t2)}</div></div>
    ${body(slide)}
    ${src(slide)}
  </div>
</div>`,
      };
    }
    case "slab":
      return {
        theme: "",
        html: `<div class="grid"></div>${slide.ghost ? `<div class="ghost in-slab" data-decor>${esc(slide.ghost)}</div>` : ""}${header(n)}
<div class="fit wide${slide.ghost ? "" : " center"}" data-name="slab" style="top:${slide.ghost ? 380 : 300}px;bottom:420px">
  <div style="display:flex;flex-direction:column">
    ${slide.opener && !slide.openerInHead ? `<span class="chip opener" data-block="opener">${esc(smart(slide.opener.replace(/\.$/, "")))}</span>` : ""}
    <h1 class="head h-slab" data-block="head">${headHtml(slide)}</h1>
    ${slide.body ? `<p class="lead" data-block="lead">${txt(slide.body)}</p>` : ""}
  </div>
</div>`,
      };
    case "cta": {
      const line = esc(smart(slide.line)).replace("DuoQueue", '<span class="v">DuoQueue</span>');
      return {
        theme: "",
        html: `<div class="grid"></div>${header(n)}
<div class="fit center wide" data-name="cta" style="top:300px;bottom:420px">
  <div style="display:flex;flex-direction:column">
    <h2 class="head h-cta" data-block="head">${headHtml(slide)}</h2>
    <div class="search">${MAG}<span class="q" data-block="search">DuoQueue</span><i class="caret"></i></div>
    <p class="line" data-block="line">${line}</p>
    <div class="small" data-block="small">${esc(smart(slide.small.replace(/\.$/, "")))}</div>
  </div>
</div>`,
      };
    }
    default:
      throw new Error(`unknown layout ${slide.layout}`);
  }
}

export function slideHtml(slide, n, { bgFile } = {}) {
  const bgUrl = bgFile ? pathToFileURL(bgFile).href : "";
  let { theme, html } = layoutHtml(slide, n, bgUrl);
  // size: the type scale the fit starts from (1 = full size; it only ever shrinks from there)
  if (slide.size) html = html.replace('class="fit', `data-k0="${Number(slide.size)}" class="fit`);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1080">
<style>
${FONT_CSS}
${CSS}
</style></head>
<body class="${theme}">
${html}
<script>
${PAGE_JS}
</script>
</body></html>
`;
}

// Contact sheet: every slide of one slideshow on one image.
export function contactSheetHtml({ title, info, slides }) {
  const cols = 4;
  const tw = 405;
  const th = 720;
  const gap = 24;
  const padX = 44;
  const rows = Math.ceil(slides.length / cols);
  const width = padX * 2 + cols * tw + (cols - 1) * gap;
  const height = 170 + rows * (th + 56) + (rows - 1) * gap + 30;
  const cells = slides
    .map(
      (s, i) => `<figure><img src="${pathToFileURL(s.file).href}"><figcaption><b>${pad2(i + 1)}</b> ${esc(s.label)}</figcaption></figure>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${FONT_CSS}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${width}px;height:${height}px;overflow:hidden;background:#0a0b09;color:#f5f3ee;font-family:Manrope}
header{padding:36px ${padX}px 0;height:170px}
h1{font-weight:800;font-size:44px;letter-spacing:-.02em}
p{font:500 21px/1.4 "Plex Mono";color:#b4bda6;margin-top:10px;letter-spacing:.02em}
main{display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:${gap}px;padding:0 ${padX}px}
figure{width:${tw}px}
img{display:block;width:${tw}px;height:${th}px;border-radius:10px;outline:2px solid #30362a}
figcaption{font:500 20px/1.3 "Plex Mono";color:#b4bda6;margin-top:12px;height:44px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
figcaption b{color:#cdff3d;font-weight:600;margin-right:8px}
</style></head><body><header><h1>${esc(title)}</h1><p>${esc(info)}</p></header><main>${cells}</main></body></html>`;
  return { html, width, height };
}
