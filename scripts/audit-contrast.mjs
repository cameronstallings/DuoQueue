// scripts/audit-contrast.mjs
//
// WCAG 2.x contrast audit for apps/mobile/src/theme/tokens.ts — the Volt design
// system's permanent contrast authority (Task 12 of the 2026-08-03 Volt restyle).
//
// Tokens are parsed straight out of the tokens.ts *source text* via regex, not by
// importing the module: the file is a stable set of `as const` object literals, and
// staying regex-only keeps this a dependency-free Node script (no ts-node/tsx, no
// react-native runtime) that runs identically in CI and locally.
//
// For every enumerated {fg, bg} pair, in BOTH the "dark" and "light" (paper) palettes:
//   1. Resolve fg/bg token values to opaque sRGB colors, alpha-compositing any
//      translucent rgba() literal over its stated backdrop first.
//   2. Compute WCAG 2.x relative luminance and contrast ratio.
//   3. Compare against the pair's minimum (4.5 normal text, 3.0 for LARGE-marked
//      decorative/large-scale marks).
//
// Exit 0 when every pair passes. Exit 1 with a `scheme · pair · ratio · needed`
// failure table otherwise. This script is the authority: if a pair fails, darken
// (or lighten — keep hue, move lightness) the failing token in tokens.ts until this
// goes green. Do not loosen the thresholds or pair list to make it pass.
//
// Run: pnpm audit:contrast   (== node scripts/audit-contrast.mjs)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_PATH = path.resolve(__dirname, "../apps/mobile/src/theme/tokens.ts");
const src = readFileSync(TOKENS_PATH, "utf8");

// ---------------------------------------------------------------------------
// 1. Parse color literals out of the tokens.ts source.
// ---------------------------------------------------------------------------

/** Returns the `{ ... }` body of a top-level `[export] const NAME = { ... }` block. */
function extractBlock(source, name) {
  const re = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*\\{`, "m");
  const m = re.exec(source);
  if (!m) throw new Error(`audit-contrast: could not find "const ${name} = {" in tokens.ts`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") depth--;
  }
  if (depth !== 0) throw new Error(`audit-contrast: unbalanced braces reading block "${name}"`);
  return source.slice(start, i - 1);
}

/** Pulls `key: "#hex"` / `key: "rgba(...)"` literal pairs out of a block body. */
function parseLiterals(body) {
  const out = {};
  const re = /(\w+):\s*"((?:#[0-9A-Fa-f]{3,8})|(?:rgba?\([^)]*\)))"/g;
  let m;
  while ((m = re.exec(body))) out[m[1]] = m[2];
  return out;
}

/** Pulls `key: CONST_NAME` bareword references (e.g. `overlap: OVERLAP_DARK`). */
function parseRefs(body) {
  const out = {};
  const re = /(\w+):\s*([A-Z][A-Z0-9_]*)\b/g;
  let m;
  while ((m = re.exec(body))) out[m[1]] = m[2];
  return out;
}

function parsePalette(blockName) {
  const body = extractBlock(src, blockName);
  const literals = parseLiterals(body);
  const refs = parseRefs(body);
  for (const [key, constName] of Object.entries(refs)) {
    literals[key] = parseLiterals(extractBlock(src, constName));
  }
  return literals;
}

const darkColors = parsePalette("darkColors");
const lightColors = parsePalette("lightColors");

// Categorical dicts (overlap, playstyle) must carry identical key sets in both
// palettes — Tasks 1–11 established this invariant; a mismatch here means a typo
// in tokens.ts silently drops a pair from the audit below, so fail loudly instead.
for (const group of ["overlap", "playstyle"]) {
  const dKeys = Object.keys(darkColors[group] ?? {}).sort();
  const lKeys = Object.keys(lightColors[group] ?? {}).sort();
  if (dKeys.length === 0 || dKeys.join() !== lKeys.join()) {
    throw new Error(
      `audit-contrast: "${group}" key mismatch — dark=[${dKeys}] light=[${lKeys}]`
    );
  }
}

// EXEMPT — parsed but deliberately not measured against WCAG text minimums:
//   voltRaw (both schemes) — spec: "small marks only (ticks/underlines); never a
//   button fill" / raw chartreuse decorative accent, legal at ≤ chip scale, never
//   run as body text or a fill a user reads text on top of. LARGE-decorative, exempt.
const EXEMPT = ["voltRaw"];

// ---------------------------------------------------------------------------
// 2. Color math — WCAG 2.x relative luminance + contrast ratio.
// ---------------------------------------------------------------------------

function hexToRgba(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function parseColor(value) {
  if (value.startsWith("#")) return hexToRgba(value);
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value);
  if (!m) throw new Error(`audit-contrast: unparseable color literal: ${value}`);
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}

/** Alpha-composites translucent `fg` (rgba) over opaque `bg`, in sRGB (encoded) space —
 *  matches how the RN/CSS renderer actually blends a translucent fill on screen. */
function compositeOver(fg, bg) {
  const a = fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

function channelToLinear(c) {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }) {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// 3. Enumerated pairs — task-12-brief.md + spec §Verification + Task 9's bubbleOwn.
//    `fg`/`bg` are dotted token paths ("overlap.two"); `fill`, when set, is a
//    translucent token composited over `bg` first — the pair is then measured as
//    fg-on-top-of-that-composite (e.g. success text over successFill-over-background).
// ---------------------------------------------------------------------------

const NORMAL = 4.5;
const LARGE = 3.0;

function get(colors, dottedPath) {
  return dottedPath.split(".").reduce((o, k) => o?.[k], colors);
}

function pairLabel({ fg, bg, fill, label }) {
  if (label) return label;
  return fill ? `${fg}/(${fill} over ${bg})` : `${fg}/${bg}`;
}

const BASE_PAIRS = [
  { fg: "text", bg: "background" },
  { fg: "text", bg: "surface" },
  { fg: "text", bg: "surfaceAlt" },
  { fg: "textMuted", bg: "background" },
  { fg: "textMuted", bg: "surface" },
  // Dark: volt renders as literal text (SwipeCard "P1" label, match-moment "DUO
  // LOCKED"/brackets). Paper: volt IS ink per the "inks fill, chartreuse marks"
  // rule (voltDim/volt both stand in for accent text there too) — so this pair is
  // real in both schemes, not dark-only, despite reading that way at a glance.
  { fg: "volt", bg: "background" },
  { fg: "voltDim", bg: "background" },
  { fg: "onVolt", bg: "volt" },
  { fg: "onAmber", bg: "amber" },
  { fg: "amber", bg: "background" },
  { fg: "danger", bg: "background" },
  { fg: "onFill", bg: "dangerDark" },
  { fg: "success", bg: "background" },
  { fg: "success", bg: "background", fill: "successFill" },
  { fg: "warning", bg: "background", fill: "warningFill" },
  { fg: "info", bg: "background" },
  { fg: "volt", bg: "background", fill: "voltSoft" },
  { fg: "p2Line", bg: "background" },
  // Task 9: own chat-bubble fill is a solid tinted surface with colors.text rendered
  // directly on top (MessageBubble / party chat) — text/bubbleOwn per Task 12 dispatch.
  { fg: "text", bg: "bubbleOwn" },
  { fg: "textMuted", bg: "surfaceSolid", label: "tabInactive(textMuted)/surfaceSolid" },
];

for (const group of ["overlap", "playstyle"]) {
  for (const key of Object.keys(darkColors[group])) {
    BASE_PAIRS.push({ fg: `${group}.${key}`, bg: "surface" });
  }
}

// ---------------------------------------------------------------------------
// 4. Evaluate every pair against both palettes.
// ---------------------------------------------------------------------------

function evaluatePair(colors, pair) {
  const threshold = pair.threshold ?? NORMAL;
  const bgLiteral = get(colors, pair.bg);
  if (bgLiteral === undefined) throw new Error(`audit-contrast: unknown bg token "${pair.bg}"`);
  let effectiveBg = parseColor(bgLiteral);
  if (effectiveBg.a < 1) throw new Error(`audit-contrast: backdrop token "${pair.bg}" must be opaque`);

  if (pair.fill) {
    const fillLiteral = get(colors, pair.fill);
    if (fillLiteral === undefined) throw new Error(`audit-contrast: unknown fill token "${pair.fill}"`);
    effectiveBg = compositeOver(parseColor(fillLiteral), effectiveBg);
  }

  const fgLiteral = get(colors, pair.fg);
  if (fgLiteral === undefined) throw new Error(`audit-contrast: unknown fg token "${pair.fg}"`);
  let fgColor = parseColor(fgLiteral);
  if (fgColor.a < 1) fgColor = compositeOver(fgColor, effectiveBg);

  const ratio = contrastRatio(fgColor, effectiveBg);
  return { ratio, threshold, pass: ratio >= threshold - 1e-9 };
}

const SCHEMES = [
  { name: "dark", colors: darkColors },
  { name: "light", colors: lightColors },
];

const results = [];
for (const scheme of SCHEMES) {
  for (const pair of BASE_PAIRS) {
    const { ratio, threshold, pass } = evaluatePair(scheme.colors, pair);
    results.push({ scheme: scheme.name, label: pairLabel(pair), ratio, threshold, pass });
  }
}

// ---------------------------------------------------------------------------
// 5. Report.
// ---------------------------------------------------------------------------

const failures = results.filter((r) => !r.pass);

console.log(`Volt contrast audit — ${results.length} pair-checks (${BASE_PAIRS.length} pairs × ${SCHEMES.length} schemes)`);
console.log(`Exempt from measurement: ${EXEMPT.join(", ")} (decorative/LARGE marks, see EXEMPT comment in script)`);
console.log("");

const col = (s, n) => String(s).padEnd(n);
console.log(col("scheme", 7) + col("pair", 46) + col("ratio", 8) + "needed");
console.log("-".repeat(70));
for (const r of results) {
  const mark = r.pass ? "PASS" : "FAIL";
  console.log(
    col(r.scheme, 7) + col(r.label, 46) + col(r.ratio.toFixed(2), 8) + `${r.threshold.toFixed(1)}  ${mark}`
  );
}

console.log("");

if (failures.length > 0) {
  console.error(`FAIL — ${failures.length}/${results.length} pair-checks below threshold:`);
  console.error("");
  console.error(col("scheme", 7) + col("pair", 46) + col("ratio", 8) + "needed");
  for (const f of failures) {
    console.error(col(f.scheme, 7) + col(f.label, 46) + col(f.ratio.toFixed(2), 8) + f.threshold.toFixed(1));
  }
  process.exitCode = 1;
} else {
  console.log(`PASS — all ${results.length} pair-checks meet or exceed their WCAG minimum.`);
}
