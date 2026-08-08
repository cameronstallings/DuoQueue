// scripts/build-site.mjs — builds the public duoqueue.io site into site/.
//
// Zero dependencies on purpose (matches the rest of this repo's scripts/ policy):
// only node:fs, node:path, node:url. No markdown library, no bundler, no fonts,
// no external requests of any kind — every page is fully self-contained HTML
// with an inline <style> block and inline SVG.
//
// What this does:
//   docs/legal/privacy-policy.md   -> site/privacy/index.html
//   docs/legal/terms-of-service.md -> site/terms/index.html
//   (hand-written, not from markdown) -> site/index.html
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
// site/. Once every marker is resolved (including rewriting the two closing
// draft-disclaimer paragraphs, which name the markers themselves), the build
// will proceed normally. Do not loosen or remove this check to "get it
// building" — fix the source markdown instead.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LEGAL_DIR = path.join(ROOT, "docs", "legal");
const SITE_DIR = path.join(ROOT, "site");

// ---------------------------------------------------------------------------
// Volt design tokens — mirrors the app's dark (default) and Paper (light)
// palettes. Kept as plain JS objects so the CSS template below and the rings
// mark can both reference the same values instead of duplicating hex codes.
// ---------------------------------------------------------------------------
const COLORS = {
  dark: {
    bg: "#0A0B09",
    surface: "#12140F",
    seam: "#232720",
    ink: "#EDF1E6",
    muted: "#98A18A",
    accent: "#CDFF3D", // chartreuse — links, the mark; used sparingly
    amber: "#FFB627", // reserved for money-specific callouts; unused here (see CSS comment)
  },
  light: {
    bg: "#F2F4EB",
    surface: "#FFFFFF",
    // No seam color was specified for Paper; derived as a subtle step down
    // from the light background, same family as the rest of the light palette.
    seam: "#DDE1D0",
    ink: "#161A0F",
    muted: "#5C6450",
    // Raw chartreuse is unreadable as a large fill/text color on light
    // backgrounds, so Paper mode uses the app's olive accent instead.
    accent: "#4A6B00",
    amber: "#FFB627",
  },
};

// ---------------------------------------------------------------------------
// Rings mark — geometry ported directly from the `ringGeometry` /
// `ringsMark` functions in scripts/generate-app-icons.mjs (the source of
// truth for the app icon). Colors are swapped for CSS custom properties so
// the same markup works in both the dark and Paper themes; everything else
// (radii, stroke weight, the chain-weave crossing math, the Q tail) is an
// exact copy so the header mark reads as the same shape as the app icon.
// ---------------------------------------------------------------------------
const MARK_CANVAS = 1024;
const MARK_CENTER = MARK_CANVAS / 2;
const MARK_FULL_SCALE = 1;

function ringGeometry(scale) {
  const R = MARK_CANVAS * 0.21 * scale;
  const W = R * 0.46;
  const d = R * 1.5;
  const nudge = MARK_CANVAS * 0.012;
  const cxA = MARK_CENTER - nudge - d / 2;
  const cxB = MARK_CENTER - nudge + d / 2;
  const k = Math.SQRT1_2;
  const nubDist = R + W * 0.42;
  const tail = {
    cx: cxB + nubDist * k,
    cy: MARK_CENTER + nubDist * k,
    r: W * 0.56,
  };
  return { R, W, cxA, cxB, cy: MARK_CENTER, tail };
}

/** Chain-weave rings mark as an inline SVG string. `ink`/`duo` are CSS values
 * (var(--mark-ink) / var(--mark-duo)) so the theme media query controls the
 * actual colors — the geometry itself never changes between themes. */
function ringsMarkSvg({ scale = MARK_FULL_SCALE, size = 32 } = {}) {
  const { R, W, cxA, cxB, cy, tail } = ringGeometry(scale);
  const s = ((138.59 - 27.5) * Math.PI) / 180;
  const e = ((138.59 + 27.5) * Math.PI) / 180;
  const seg = `M ${cxB + R * Math.cos(s)} ${cy + R * Math.sin(s)} A ${R} ${R} 0 0 1 ${cxB + R * Math.cos(e)} ${cy + R * Math.sin(e)}`;
  const ink = "var(--mark-ink)";
  const duo = "var(--mark-duo)";
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 ${MARK_CANVAS} ${MARK_CANVAS}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DuoQueue">
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
 * spec, this is a deliberate fallback, not a silent guess. (In practice the
 * TODO guard above means this function never sees a TODO-tainted effective
 * date in a real run — it would already have exited — but the fallback path
 * stays correct in isolation regardless.) */
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
// Shared CSS — inlined into every page, no external stylesheet request.
// System font stacks only (no webfonts). Sharp corners throughout: no
// border-radius is used anywhere in this file, by design. Dark (Volt) is the
// default; @media (prefers-color-scheme: light) swaps in Paper.
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}
/** Blends `ink` toward `bg` at `inkWeight` (0-1) — the same 58%-ink /
 * 42%-background ratio scripts/generate-app-icons.mjs uses to derive its
 * DUO_SOLID tone from INK, applied here to get an equivalent second ink
 * strength for the Paper (light) theme, which the icon generator has no
 * precedent for. */
function blend(ink, bg, inkWeight) {
  const [ir, ig, ib] = hexToRgb(ink);
  const [br, bg2, bb] = hexToRgb(bg);
  return rgbToHex([ir * inkWeight + br * (1 - inkWeight), ig * inkWeight + bg2 * (1 - inkWeight), ib * inkWeight + bb * (1 - inkWeight)]);
}

// Dark-mode mark colors are the exact values from generate-app-icons.mjs
// (INK / DUO_SOLID) — same background (#0A0B09), so the header mark should
// look identical to the app icon. Light-mode has no app precedent, so its
// duo-tone is derived with the same blend ratio the icon generator uses.
const MARK_INK_DARK = "#F5F3EE";
const MARK_DUO_DARK = "#92918D";
const MARK_INK_LIGHT = COLORS.light.ink;
const MARK_DUO_LIGHT = blend(MARK_INK_LIGHT, COLORS.light.bg, 0.58);

const CSS = `
  :root {
    --bg: ${COLORS.dark.bg};
    --surface: ${COLORS.dark.surface};
    --seam: ${COLORS.dark.seam};
    --ink: ${COLORS.dark.ink};
    --muted: ${COLORS.dark.muted};
    --accent: ${COLORS.dark.accent};
    --amber: ${COLORS.dark.amber};
    --mark-ink: ${MARK_INK_DARK};
    --mark-duo: ${MARK_DUO_DARK};
    color-scheme: dark;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: ${COLORS.light.bg};
      --surface: ${COLORS.light.surface};
      --seam: ${COLORS.light.seam};
      --ink: ${COLORS.light.ink};
      --muted: ${COLORS.light.muted};
      --accent: ${COLORS.light.accent};
      --amber: ${COLORS.light.amber};
      --mark-ink: ${MARK_INK_LIGHT};
      --mark-duo: ${MARK_DUO_LIGHT};
      color-scheme: light;
    }
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
  }

  a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
  a:hover { text-decoration: none; }

  .skip-link {
    position: absolute; left: -9999px; top: 0;
    background: var(--surface); color: var(--ink); padding: 0.75em 1em;
    border: 1px solid var(--seam);
  }
  .skip-link:focus { left: 0.5em; top: 0.5em; z-index: 10; }

  header.site-header {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1em; flex-wrap: wrap;
    padding: 1.25em 1.25em;
    border-bottom: 1px solid var(--seam);
  }
  .brand {
    display: inline-flex; align-items: center; gap: 0.6em;
    color: var(--ink); text-decoration: none; font-weight: 600; font-size: 1.05em;
    letter-spacing: 0.01em;
  }
  .brand:hover { text-decoration: none; color: var(--accent); }
  .brand-mark { display: block; flex: none; }
  header.site-header nav { display: flex; gap: 1.25em; flex-wrap: wrap; }
  header.site-header nav a { color: var(--muted); text-decoration: none; font-size: 0.95em; }
  header.site-header nav a:hover { color: var(--accent); text-decoration: underline; }

  main {
    max-width: 68ch;
    margin: 0 auto;
    padding: 2.5em 1.25em 4em;
  }

  article h1 { font-size: 1.7em; line-height: 1.3; margin: 0 0 0.3em; }
  article h2 { font-size: 1.3em; line-height: 1.35; margin: 1.8em 0 0.6em; padding-top: 0.6em; border-top: 1px solid var(--seam); }
  article h2:first-child { border-top: none; padding-top: 0; margin-top: 0; }
  article h3 { font-size: 1.05em; margin: 1.4em 0 0.5em; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  article p { margin: 0 0 1em; }
  article ul, article ol { margin: 0 0 1em; padding-left: 1.4em; }
  article li { margin: 0.3em 0; }
  article li > ul, article li > ol { margin-top: 0.3em; }
  article hr { border: none; border-top: 1px solid var(--seam); margin: 2em 0; }
  article strong { color: var(--ink); }
  article code {
    background: var(--surface); border: 1px solid var(--seam);
    padding: 0.15em 0.4em; font-size: 0.9em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .table-scroll { overflow-x: auto; margin: 0 0 1.4em; border: 1px solid var(--seam); }
  table { border-collapse: collapse; width: 100%; min-width: 480px; font-size: 0.92em; }
  th, td { text-align: left; padding: 0.6em 0.75em; border-bottom: 1px solid var(--seam); vertical-align: top; }
  thead th { background: var(--surface); color: var(--muted); font-weight: 600; white-space: nowrap; }
  tbody tr:last-child td { border-bottom: none; }

  .intro { font-size: 1.1em; color: var(--ink); }
  .lede { color: var(--muted); }

  section.card {
    border: 1px solid var(--seam); background: var(--surface);
    padding: 1.5em; margin: 1.5em 0;
  }
  section.card h2 { margin-top: 0; border-top: none; padding-top: 0; }

  footer.site-footer {
    border-top: 1px solid var(--seam);
    padding: 1.5em 1.25em 2.5em;
    max-width: 68ch; margin: 0 auto;
    color: var(--muted); font-size: 0.9em;
  }
  footer.site-footer nav { margin-top: 0.5em; }
  footer.site-footer nav a { color: var(--muted); }
  footer.site-footer nav a:hover { color: var(--accent); }

  @media (max-width: 480px) {
    header.site-header { padding: 1em; }
    main { padding: 2em 1em 3em; }
  }
`;

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

function pageShell({ title, description, bodyHtml, lastUpdatedLabel, isPlaceholder }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<style>${CSS}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="/">${ringsMarkSvg({ size: 28 })}<span>DuoQueue</span></a>
  <nav>
    <a href="/">Home</a>
    <a href="/privacy/">Privacy</a>
    <a href="/terms/">Terms</a>
    <a href="/#support">Support</a>
  </nav>
</header>
<main id="main">
<article>
${bodyHtml}
</article>
</main>
<footer class="site-footer">
  <p>Last updated: ${escapeHtml(lastUpdatedLabel)}${isPlaceholder ? ". Placeholder, see script header." : ""}</p>
  <nav>
    <a href="/">Home</a> &middot; <a href="/privacy/">Privacy Policy</a> &middot; <a href="/terms/">Terms of Service</a>
  </nav>
</footer>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// site/index.html — hand-written landing + support page (not from markdown).
// URLs and the support address come from apps/mobile/src/lib/legal.ts so the
// site matches exactly what the app links to.
// ---------------------------------------------------------------------------

const SUPPORT_EMAIL = "support@duoqueue.io";

function buildIndexHtml(lastUpdated) {
  const body = `
<h1>DuoQueue</h1>
<p class="intro">DuoQueue is an 18+ app for finding people to play games with. It's platonic, not dating. You're matching on games, schedules, and vibe so you always have someone good to duo with.</p>
<p class="lede">Swipe on profiles built around what you play, when you play, and how you like to play it, then chat and queue up with the people you match.</p>

<h2>Legal</h2>
<ul>
  <li><a href="/privacy/">Privacy Policy</a>: what we collect, why, and who we share it with.</li>
  <li><a href="/terms/">Terms of Service</a>: the rules for using DuoQueue.</li>
</ul>

<section class="card" id="support">
  <h2>Support</h2>
  <p>Questions, account issues, or anything else? Reach us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
  <p>Report a safety concern: if you need to report abuse, harassment, or other user-content issues, email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. Reports can also be filed directly in the app from a profile or conversation.</p>
</section>
`;
  return pageShell({
    title: "DuoQueue: find your duo",
    description: "DuoQueue is an 18+ app for finding people to play games with. Platonic, not dating.",
    bodyHtml: body,
    lastUpdatedLabel: lastUpdated.label,
    isPlaceholder: lastUpdated.isPlaceholder,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function buildLegalPage({ srcFile, destDir, description }) {
  const srcPath = path.join(LEGAL_DIR, srcFile);
  const markdown = readFileSync(srcPath, "utf8");
  const { html, title } = mdToHtml(markdown);
  const lastUpdated = resolveLastUpdated(srcPath, markdown);
  const pageHtml = pageShell({
    title: title ? `${title} | DuoQueue` : "DuoQueue",
    description,
    bodyHtml: html,
    lastUpdatedLabel: lastUpdated.label,
    isPlaceholder: lastUpdated.isPlaceholder,
  });
  const outDir = path.join(SITE_DIR, destDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "index.html"), pageHtml, "utf8");
  return path.join(outDir, "index.html");
}

function main() {
  const legalFiles = [
    { srcFile: "privacy-policy.md", label: "docs/legal/privacy-policy.md" },
    { srcFile: "terms-of-service.md", label: "docs/legal/terms-of-service.md" },
  ];

  // TODO guard runs first, across both files, before anything is written.
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

  mkdirSync(SITE_DIR, { recursive: true });

  const privacyOut = buildLegalPage({
    srcFile: "privacy-policy.md",
    destDir: "privacy",
    description: "DuoQueue's Privacy Policy: what we collect, why, and who we share it with.",
  });
  console.log(`wrote ${path.relative(ROOT, privacyOut)}`);

  const termsOut = buildLegalPage({
    srcFile: "terms-of-service.md",
    destDir: "terms",
    description: "DuoQueue's Terms of Service.",
  });
  console.log(`wrote ${path.relative(ROOT, termsOut)}`);

  const indexLastUpdated = resolveLastUpdated(path.join(__dirname, "build-site.mjs"), null, {
    fallbackNote:
      "derived from this script's last-modified time, since the landing page has no source markdown file",
  });
  const indexPath = path.join(SITE_DIR, "index.html");
  writeFileSync(indexPath, buildIndexHtml(indexLastUpdated), "utf8");
  console.log(`wrote ${path.relative(ROOT, indexPath)}`);

  console.log("\nBuilt site/ successfully.");
}

// Run main() only when this file is executed directly (`node
// scripts/build-site.mjs`), not when it's imported — lets a test script
// import the pure functions above (findTodoMarkers, mdToHtml, etc.) without
// triggering a full build.
if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}

export { findTodoMarkers, mdToHtml, slugify, escapeHtml, renderInline, rewriteLink, resolveLastUpdated, ringsMarkSvg };
