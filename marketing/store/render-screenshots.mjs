/**
 * DuoQueue App Store screenshots for build 15 (commit 22ce7b9), two sets from one copy deck.
 *
 *   Set DARK   Volt off-black ground, the dark-theme screens. The recommended default page.
 *   Set LIGHT  Paper ground, the same six screens in Paper. An alternate.
 *
 * The frame is Previously's store frame rebuilt in the Volt identity: a headline at the top, a
 * short line under it, then a REAL app screen presented as one rounded panel on the brand ground.
 * Nothing inside a panel is drawn here: every panel is a window on a PNG that the screen renderer
 * (a port of Previously's tools/render) drew from build 15's own screen code, from a clean,
 * detached checkout pinned at 22ce7b9, told with the review account's seed. Build 10's set came
 * from screen-recording stills, composed by an earlier version of this script that was never
 * committed: this file first entered git in fd93d4b, already the renderer-based composer, so
 * the stills-based one is NOT in git history.
 *
 * THE SOURCES AND WHAT IS CHECKED BEFORE ONE IS USED
 *   The renderer writes shots/<key>.png plus shots/report.json. `--import <that folder>` copies
 *   the shots a slide needs, and the report, into out/shots-b15/<scale>x/ (git-excluded), so later
 *   runs need no flag. Every run then refuses a source unless its report says:
 *     - the checkout is PINNED (detached, clean, its own node_modules) at BUILD.commit;
 *     - the shot rendered with no problems, at 393 x 852 pt, in the theme the set asks for;
 *     - the PNG is exactly 393 x 852 pt at the report's scale (1179 x 2556 at 3x, 1769 x 3834
 *       at 4.5x); build 10's 1180 x 2556 recordings are no longer accepted;
 *     - the shot may go in the App Store set ("yes"). There is NO override: build 15's first
 *       set let DUO LOCKED through with one, and the renderer's "no, until verified" meant the
 *       listing would show either a predicted app defect or a picture that is not the app;
 *     - the slide's window lies inside the window the renderer allows for that shot.
 *   What the renderer says Cameron must confirm before upload (`confirm`) is printed per slide,
 *   written to out/manifest-<set>-b15.json and shown on the contact sheet. A slide whose source
 *   shows the Deck's subscriber strip (confirm "strip shows a subscriber": UNLIMITED, Ping and
 *   the Power-Ups count are all on that screen) must carry the in-app purchase note NOTE_PLUS
 *   (Guideline 2.3.2), or the run stops.
 *
 * PANELS ARE WINDOWS, NOT WHOLE SCREENS. Every panel is the same width (PW). Each slide names a
 * window on its source in POINTS, and the panel shows exactly that window, so a panel ends on
 * content instead of carrying a screen's empty lower half. A window's first and last rows must
 * both be plain ground, so no panel opens or closes through half a UI element. Nothing is ever
 * upscaled: a window narrower than PW source pixels is refused. The chat tools slide is a zoomed
 * window (251 pt wide), so its source is the same screen rendered at 4.5x, where 251 pt is
 * exactly PW pixels and the panel is the render's own pixels, 1:1.
 *
 * WHAT IS RETOUCHED, AND ONLY THIS:
 *   - no status bar: the renderer draws none, and no window starts above 59 pt.
 *   - `pad` (points) adds rows ABOVE a window by repeating the window's own first row, which is
 *     plain app ground, so the first content never sits cramped against the panel's rounded top.
 *
 * Colours come from apps/mobile/src/theme/tokens.ts (imported, not retyped). Fonts are the app's
 * own .ttf files, embedded as data URIs, so nothing is fetched at render time. Rendering is
 * headless Chrome only (no window, muted, each call bounded to CHROME_TIMEOUT_MS), with a
 * throwaway profile (--profile-dir, or a temp folder removed afterwards).
 *
 * Two passes, so every slide in a set shares ONE headline size:
 *   1  measure: every headline line of the set is measured in the real face (--dump-dom).
 *   2  render: each slide is static HTML with that size baked in, screenshotted at 1320x2868.
 *
 * Run:  node --no-warnings marketing/store/render-screenshots.mjs --import <renderer>/shots \
 *         --import <renderer>/shots-4x5 [--set dark|light] [--only 01,03] [--profile-dir <dir>]
 * Out:  marketing/store/out/set-dark-b15/NN-slug.png            1320x2868 (6.9-inch slot, upload these)
 *       marketing/store/out/set-dark-b15/1290x2796/NN-slug.png  the same at 1290x2796 (6.9-inch)
 *       marketing/store/out/set-dark-b15/1284x2778/NN-slug.png  6.5-inch
 *       marketing/store/out/set-dark-b15/1242x2688/NN-slug.png  6.5-inch
 *       marketing/store/out/set-light-b15/...                   the same for Paper
 *       marketing/store/out/contact-{dark,light}-b15.jpg        the whole set, with what to confirm
 *       marketing/store/out/thumbs-{dark,light}-b15.jpg         first three at search-result sizes
 *       marketing/store/out/manifest-{dark,light}-b15.json      sources (sha256), windows, panels, confirms
 * Every smaller size is scaled to its width (lanczos), then the few leftover rows are trimmed
 * evenly off the plain ground at top and bottom (checked to be ground), never stretched. Every
 * file is flattened to RGB (no alpha), sRGB, 72 dpi.
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const OUT = path.join(HERE, "out");
const IN = path.join(OUT, "shots-b15");
const WORK = path.join(OUT, "_work");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CHROME_TIMEOUT_MS = 120_000;

/** The build these pictures are of: every source must be rendered from a pinned checkout of it. */
const BUILD = { n: 15, commit: "22ce7b9" };

const { darkColors, lightColors } = await import(
  pathToFileURL(path.join(REPO, "apps", "mobile", "src", "theme", "tokens.ts")).href
);

/* ---- the canvas ----------------------------------------------------------------------------- */

const W = 1320;
const H = 2868;
/** Every source is this phone, in points (the renderer's iPhone 15 / 16 viewport). */
const PHONE = { w: 393, h: 852 };
/** No window may start above this (points): the status bar's band, which the renderer leaves out. */
const STATUS_BAR_PT = 59;

const PW = 1130; // every panel's width
const PT = 600; // every panel's top
const PMAX = 2045; // tallest a panel may be (to y=2645, leaving room for the disclosure lines)
const PL = (W - PW) / 2;
const RADIUS = 50;

const CAPTION_TOP = 112;
const CAPTION_BOTTOM = PT - 58;
const MEASURE = 1150;
const HEAD_MAX = 112;
const SUB_SIZE = 52;

/** The upload sizes: the first is the canvas, the rest are exported from it into subfolders. */
const SIZES = [
  [1320, 2868], // 6.9-inch
  [1290, 2796], // 6.9-inch (older slot size)
  [1284, 2778], // 6.5-inch
  [1242, 2688], // 6.5-inch
];

/* ---- the sources -----------------------------------------------------------------------------
 * Keys are the renderer's shot keys (render-dq screens.mjs). The dark set uses `key`, the light
 * set `key-paper`. `scale` is the device scale the shot was rendered at (report.json).
 */
const SHOT_SCALE = { tools: 4.5, "tools-paper": 4.5 };
const scaleOf = (key) => SHOT_SCALE[key] ?? 3;
const sourceKey = (theme, key) => (theme === "light" ? `${key}-paper` : key);

/* ---- the copy --------------------------------------------------------------------------------
 * `lines` are the headline's own line breaks and *word* marks the one lit word (never its
 * punctuation). No em dashes, no negations, no prices, no ages in a headline, nothing that reads
 * as dating next to photo cards with ages (COPY_BANS). Every sub-line describes what its panel
 * shows, not merely what is true of the app.
 *
 * Windows are [left, top, right, bottom] in POINTS on the 393 x 852 pt source; `pad` (points)
 * adds plain rows above. Each was measured on the build 15 renders so that the first content
 * sits about 80 panel px under the panel's top and the panel ends on content.
 */
const NOTE_PLUS = ["Unlimited swipes and Ping need DuoQueue+.", "Power-Ups are an in-app purchase."];

// The Deck, from under the status bar (the title's ink starts at 88 pt) to just above the tab
// bar's seam (758 pt), under the Pass / Ping / Like row (ends 741 pt).
const DECK = { win: [0, 60, PHONE.w, 757] };
// The Profile tab: the title and Edit (75 pt), HOW OTHERS SEE YOU, your card and the two lines
// under it (to 714 pt). It ends there: the HOW I PLAY label (751-758 pt) sits on the tab bar with
// nothing under it on this screen, and the card plus HOW I PLAY (132-937 pt) is taller than a
// panel can be (PMAX is 711 pt of a full-width window).
const PROFILE = { win: [0, 60, PHONE.w, 742], pad: 13 };
// DUO LOCKED is OUT of the set until a device recording of build 15's DUO LOCKED is checked
// (render-dq device/bracket_check.py). The renderer holds every DUO LOCKED at "no, until
// verified": build 15's match/[matchId].tsx gives BracketGlyph fontSize and lineHeight both
// BRACKET_SIZE, so iOS is predicted to clip each bracket's top arm (4.3 pt against 8.3 at the
// bottom), and the moment sits high in the sheet with its lower ~45% empty (its window here was
// 114-642 pt, a 1518 px panel over 750 px of bare ground). If the prediction holds, the listing
// shows an app defect; if not, the picture is not the app. It comes back only when the renderer
// says "yes".
// The chat: from the gap above the first whole bubble (164 pt, the renderer's window, clear of
// the glass bar and its SF Pro stand-in) to under the message field (802 pt).
const CHAT = { win: [0, 164, PHONE.w, 830], pad: 24 };
// The chat's ••• sheet, zoomed: 251 pt wide from the left edge (every row's icon and label ends
// by 193 pt), from under the grab handle (308 pt) to under Block (752 pt), as build 10's slide.
// At 4.5x that is exactly PW pixels wide, so the panel is the render's own pixels.
const TOOLS = { win: [0, 308, PW / 4.5, 752], pad: 2 };
// Settings scrolled to its end: the title (79 pt), Safety Center, Blocked people, Hidden words,
// Account and Legal (to 700 pt), ending at 716 pt as the renderer's window allows.
const SAFETY = { win: [0, 60, PHONE.w, 716], pad: 9 };

/*
 * Six slides. Build 15's first set had seven, with DUO LOCKED fourth (see DUO LOCKED above);
 * the chat, tools and safety slides moved up one.
 */
const COPY = [
  {
    n: "01", slug: "deck",
    lines: ["See who can", "*duo* with you"],
    // Was "Rank, games and hours, before you swipe": the card shows no hours (they only order the
    // Deck); it shows League rank, games in common and NA EAST.
    sub: "Rank, games and region, before you swipe",
    // The panel shows the strip's UNLIMITED, the Ping button and the Power-Ups count.
    note: NOTE_PLUS,
    key: "deck-store", ...DECK,
  },
  {
    n: "02", slug: "prompt",
    // The lit word carries the message (was "*Photo* optional.", which lit what the line plays
    // down, on a panel that shows no photo).
    lines: ["*Games* first.", "Photo optional."],
    sub: "One picture if you want, then their prompts",
    // The same Deck chrome as 01: UNLIMITED, Ping and the Power-Ups count.
    note: NOTE_PLUS,
    // The store story's NEXT card (Dae, League Platinum I, can duo), reached by passing Kofi, on
    // his first prompt ("I main / Whatever the draft needs..."). It was deck-prompt-store, 01's
    // own card turned (same name, rank and cells, so two of the three search-visible slots looked
    // alike, and its prompt made "Rocket League" the most legible game name in slot 2).
    key: "deck-prompt-dae-store", ...DECK,
  },
  {
    n: "03", slug: "profile",
    lines: ["Your *card*, as", "others see it"],
    // Was "Rank, platforms and games in common": the card's third cell is GAMES 14, your own
    // total; "games in common" is only in the caption under the card.
    sub: "Rank, platforms and games",
    // profile-store: profile-top told in the store story, which names the review account
    // "Jordan". profile-top reads "App Reviewer" on the card, legible even at search-result size.
    key: "profile-store", ...PROFILE,
  },
  {
    n: "04", slug: "chat",
    lines: ["Plan the *session*", "in chat"],
    // Was "Pick a night, then queue up": "a night" next to photo cards with ages leans dating.
    sub: "Pick a time, then queue up",
    key: "chat", ...CHAT,
  },
  {
    n: "05", slug: "tools",
    // Was "Invite a *third* / to the party": in a swipe app with photos and ages, "a third" is
    // dating-app slang for a threesome partner, and lighting it made that worse.
    lines: ["Grow the duo", "into a *trio*"],
    sub: "Schedule a session, share your handle",
    key: "tools", ...TOOLS,
  },
  {
    n: "06", slug: "safety",
    lines: ["*Safety* tools,", "built in"],
    // Was "18+ only. Block people, hide words": nothing on this panel shows an age or 18+ (the
    // age gate is true of the app, MIN_AGE, but not of this screen), and an age next to photo
    // cards leans dating.
    sub: "Block people and hide words",
    key: "safety", ...SAFETY,
  },
];

/* ---- the two looks -------------------------------------------------------------------------- */

const LOOKS = {
  dark: {
    renderTheme: "dark",
    ground: darkColors.background,
    ink: darkColors.text,
    dim: darkColors.textMuted,
    accent: darkColors.volt,
    // The app's own graticule, faint, so the ground reads as the app's ground.
    grid: "rgba(205,255,61,0.035)",
    tick: "rgba(205,255,61,0.06)",
    // Depth is a seam, never a shadow or glow (tokens.ts): the app's border, at the weight a 1pt
    // hairline has at this scale.
    rim: `inset 0 0 0 3px ${darkColors.border}`,
    sheet: { ground: "#1A1D15", ink: "#EDF1E6" },
  },
  light: {
    renderTheme: "paper",
    ground: lightColors.background,
    ink: lightColors.text,
    dim: lightColors.textMuted,
    accent: lightColors.volt,
    grid: null,
    tick: null,
    rim: `inset 0 0 0 2px ${lightColors.border}`,
    sheet: { ground: "#E2E5DA", ink: "#161A0F" },
  },
};

/* ---- fonts ------------------------------------------------------------------------------------ */

const GF = path.join(REPO, "node_modules", "@expo-google-fonts");
const fontFace = (family, file, weight) =>
  `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/ttf;base64,${fs
    .readFileSync(file)
    .toString("base64")}) format('truetype');}`;
const FONT_CSS = [
  fontFace("Unbounded", path.join(GF, "unbounded", "600SemiBold", "Unbounded_600SemiBold.ttf"), 600),
  fontFace("Manrope", path.join(GF, "manrope", "600SemiBold", "Manrope_600SemiBold.ttf"), 600),
  fontFace("Manrope", path.join(GF, "manrope", "700Bold", "Manrope_700Bold.ttf"), 700),
].join("\n");
const HEAD = { family: "'Unbounded'", weight: 600, tracking: "-0.01em", leading: 1.14 };

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const flags = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]] : []));

/* ---- copy checks ------------------------------------------------------------------------------- */

const COPY_BANS = [
  [/\u2014|\u2013/, "an em or en dash"],
  [/\$|€|£|\bprice|\bfree trial|\/mo\b|per month/i, "a price or trial term"],
  [/\bdat(e|ing)\b|\bsingles?\b|\blove\b|\bromance|\bflirt|\bcrush\b|♥|❤/i, "a dating cue"],
  // Next to photo cards with ages and swipe buttons: "a third" / "unicorn" are dating-app slang
  // for a threesome partner, and a night out or an age gate reads as a dating app.
  [/\bthird\b|\bthreesome|\bunicorns?\b/i, "dating-app slang (a third, unicorn)"],
  [/\b(to)?nights?\b|\bevenings?\b|\b18\s*\+|\badults? only\b/i, "a night out or an age gate, which reads as dating here"],
  [/\bnot\b|n't\b|\bno more\b/i, "a negation"],
  [/#1|\bbest\b|\bnumber one\b/i, "an unverifiable claim"],
];
for (const s of COPY) {
  for (const text of [...s.lines, s.sub, ...(s.note ?? [])]) {
    for (const [re, what] of COPY_BANS) if (re.test(text)) throw new Error(`${s.n}: "${text}" contains ${what}`);
  }
  if (s.lines.join(" ").match(/\b\d{2}\b/)) throw new Error(`${s.n}: a number that could read as an age in a headline`);
  const lit = s.lines.join(" ").match(/\*[^*]+\*/g) ?? [];
  if (lit.length !== 1) throw new Error(`${s.n}: ${lit.length} lit words; a headline has exactly one`);
  // The lit span is the word alone: its punctuation stays ink, as on every other slide.
  if (/[^\p{L}\p{N}\s'’]/u.test(lit[0].slice(1, -1))) throw new Error(`${s.n}: lit span ${lit[0]} lights punctuation`);
}

/* ---- sources: import and verify --------------------------------------------------------------- */

const neededKeys = new Set(Object.keys(LOOKS).flatMap((t) => COPY.map((s) => sourceKey(t, s.key))));
const scaleDir = (scale) => path.join(IN, `${scale}x`);

const checkSource = (src, where) => {
  const why = [];
  if (!src?.pinned) why.push(`not pinned (${(src?.notPinnedBecause ?? []).join("; ") || "no source block"})`);
  if (!String(src?.commit ?? "").startsWith(BUILD.commit)) why.push(`commit ${src?.commit}, expected ${BUILD.commit}`);
  if (src?.dirtyReads?.length) why.push(`uncommitted reads: ${src.dirtyReads.join(", ")}`);
  if (src?.modules && (!src.modules.own || !src.modules.lockfileSame)) why.push("node_modules are not the checkout's own");
  if (why.length) throw new Error(`${where}: the renderer's source is not build ${BUILD.n}: ${why.join("; ")}`);
};

/** Copy the shots the slides need, and their report, out of a renderer shots folder. */
const importShots = (dir) => {
  const report = JSON.parse(fs.readFileSync(path.join(dir, "report.json"), "utf8"));
  checkSource(report.source, path.join(dir, "report.json"));
  const scales = [...new Set(report.rows.map((r) => r.r?.scale).filter(Boolean))];
  if (scales.length !== 1) throw new Error(`${dir}: shots at ${scales.length} scales (${scales.join(", ")})`);
  const scale = scales[0];
  const dest = scaleDir(scale);
  fs.mkdirSync(dest, { recursive: true });
  const copied = [];
  for (const row of report.rows) {
    if (!neededKeys.has(row.key) || scaleOf(row.key) !== scale) continue;
    fs.copyFileSync(path.join(dir, `${row.key}.png`), path.join(dest, `${row.key}.png`));
    copied.push(row.key);
  }
  fs.writeFileSync(path.join(dest, "report.json"), JSON.stringify(report, null, 1));
  console.log(`imported ${copied.length} shot(s) at ${scale}x from ${dir}: ${copied.join(", ")}`);
};
for (const dir of flags("import")) importShots(dir);

const reports = new Map();
const reportAt = (scale) => {
  if (!reports.has(scale)) {
    const f = path.join(scaleDir(scale), "report.json");
    if (!fs.existsSync(f)) throw new Error(`no ${scale}x shots in ${IN}: run with --import <renderer shots folder>`);
    const report = JSON.parse(fs.readFileSync(f, "utf8"));
    checkSource(report.source, f);
    reports.set(scale, report);
  }
  return reports.get(scale);
};

/** A slide's source, verified against the renderer's own report. */
const sourceFor = (theme, slide) => {
  const key = sourceKey(theme, slide.key);
  const scale = scaleOf(key);
  const report = reportAt(scale);
  const row = report.rows.find((r) => r.key === key);
  const where = `${theme} ${slide.n} (${key} at ${scale}x)`;
  if (!row) throw new Error(`${where}: not in the renderer's report`);
  const r = row.r;
  if (!row.ok || !r) throw new Error(`${where}: the renderer did not render it`);
  if (r.problems?.length) throw new Error(`${where}: the renderer lists problems: ${r.problems.join("; ")}`);
  if (r.width !== PHONE.w || r.height !== PHONE.h || r.scale !== scale) {
    throw new Error(`${where}: rendered at ${r.width}x${r.height} pt @${r.scale}x, expected ${PHONE.w}x${PHONE.h} @${scale}x`);
  }
  if (r.theme !== LOOKS[theme].renderTheme) throw new Error(`${where}: rendered in ${r.theme}, the set is ${LOOKS[theme].renderTheme}`);
  const store = String(r.store ?? "");
  if (!/^yes\b/.test(store)) throw new Error(`${where}: the renderer says store "${store.slice(0, 120)}"; only a "yes" goes in the set`);
  const confirm = (r.confirm ?? []).map((c) => c.short);
  if (confirm.some((c) => /subscriber/.test(c)) && slide.note !== NOTE_PLUS) {
    throw new Error(`${where}: the panel shows the Deck's subscriber strip (UNLIMITED, Ping, Power-Ups), so the slide needs note: NOTE_PLUS (Guideline 2.3.2)`);
  }
  const file = path.join(scaleDir(scale), `${key}.png`);
  if (!fs.existsSync(file)) throw new Error(`${where}: ${file} is missing: run with --import`);
  return {
    key, scale, file, store, report,
    window: r.window ?? null,
    confirm,
    mode: r.mode ?? null,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
  };
};

/* ---- panels ------------------------------------------------------------------------------------ */

const SCREEN_DIR = path.join(WORK, "screens");
const HTML_DIR = path.join(WORK, "html");
const RAW_DIR = path.join(WORK, "raw");
for (const d of [SCREEN_DIR, HTML_DIR, RAW_DIR]) fs.mkdirSync(d, { recursive: true });

/**
 * Whether row `y` of a raw RGB buffer `ww` wide is plain ground: one flat colour, give or take
 * the graticule's 2 px lines (no run of more than 3 px off the row's median by > 12, and nothing
 * off by more than 60).
 */
const plainRow = (buf, ww, y) => {
  const sums = new Array(ww);
  for (let x = 0; x < ww; x++) {
    const i = (y * ww + x) * 3;
    sums[x] = buf[i] + buf[i + 1] + buf[i + 2];
  }
  const median = [...sums].sort((p, q) => p - q)[ww >> 1];
  let run = 0, longest = 0, worst = 0;
  for (const v of sums) {
    const d = Math.abs(v - median);
    worst = Math.max(worst, d);
    run = d > 12 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { ok: !(longest > 3 || worst > 60), longest, worst };
};

/**
 * Build a slide's panel image at its final pixel size: the window, plus `pad` repeated ground rows
 * above it, resized once with lanczos to PW wide (or taken 1:1 when the window is PW wide).
 */
const panelFile = async (theme, slide, src) => {
  const meta = await sharp(src.file).metadata();
  const expW = Math.round(PHONE.w * src.scale);
  const expH = Math.round(PHONE.h * src.scale);
  if (meta.width !== expW || meta.height !== expH) {
    throw new Error(`${src.key}: ${meta.width}x${meta.height}, expected ${expW}x${expH} (${PHONE.w}x${PHONE.h} pt at ${src.scale}x)`);
  }
  const [l, t, r, b] = slide.win;
  if (t < STATUS_BAR_PT) throw new Error(`${src.key}: window starts at ${t} pt, inside the status bar's band`);
  if (src.window && (t < src.window[0] || b > src.window[1])) {
    throw new Error(`${src.key}: window ${t}-${b} pt is outside the renderer's store window ${src.window[0]}-${src.window[1]} pt`);
  }
  const px = (v) => Math.round(v * src.scale);
  const [x0, y0, x1, y1] = [px(l), px(t), px(r), px(b)];
  if (x0 < 0 || y0 < 0 || x1 > meta.width || y1 > meta.height || x1 <= x0 || y1 <= y0) {
    throw new Error(`${src.key}: window [${x0}, ${y0}, ${x1}, ${y1}] px is outside ${meta.width}x${meta.height}`);
  }
  const ww = x1 - x0;
  const wh = y1 - y0;
  if (ww < PW) throw new Error(`${src.key}: window ${ww} px wide would be upscaled to ${PW}; render it at a higher scale`);
  const pad = Math.round((slide.pad ?? 0) * src.scale);

  const win = await sharp(src.file).extract({ left: x0, top: y0, width: ww, height: wh }).removeAlpha().raw().toBuffer();
  // Both edge rows must be plain ground: padding repeats the first, and a window must never open
  // or close on half a UI element.
  for (const [y, edge] of [[0, "first"], [wh - 1, "last"]]) {
    const p = plainRow(win, ww, y);
    if (!p.ok) throw new Error(`${src.key}: the window's ${edge} row (y=${y0 + y}) is not plain ground (run ${p.longest}, worst ${p.worst})`);
  }
  // The insets are measured to the first and last row with INK (something off the row's median by
  // more than 150: text, icons, pictures), so the graticule's tick dots (at most ~95) do not count.
  const inked = (y) => plainRow(win, ww, y).worst > 150;
  let first = 0;
  while (first < wh && !inked(first)) first++;
  let last = wh - 1;
  while (last >= 0 && !inked(last)) last--;
  if (first >= wh) throw new Error(`${src.key}: the window holds nothing but ground`);

  const full = Buffer.alloc(ww * (wh + pad) * 3);
  for (let row = 0; row < pad; row++) win.copy(full, row * ww * 3, 0, ww * 3);
  win.copy(full, pad * ww * 3);

  const scale = PW / ww;
  const ph = Math.round((wh + pad) * scale);
  if (ph > PMAX) throw new Error(`${src.key}: panel ${ph}px is taller than ${PMAX}`);
  const out = path.join(SCREEN_DIR, `${theme}-${slide.n}-${slide.slug}.png`);
  let img = sharp(full, { raw: { width: ww, height: wh + pad, channels: 3 } });
  if (ww !== PW || wh + pad !== ph) img = img.resize(PW, ph, { kernel: "lanczos3" });
  await img.png({ compressionLevel: 6 }).toFile(out);
  return {
    file: out,
    height: ph,
    scale,
    windowPx: [x0, y0, x1, y1],
    padPx: pad,
    // Panel px from the panel's top edge to the first content, and from the last content to the bottom.
    insetTop: Math.round((first + pad) * scale),
    insetBottom: Math.round((wh - 1 - last) * scale),
  };
};

/* ---- html ------------------------------------------------------------------------------------ */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const lit = (line) => esc(line).replace(/\*([^*]+)\*/g, '<span class="lit">$1</span>');
const plain = (line) => line.replace(/\*/g, "");
const url = (p) => pathToFileURL(p).href;

const baseCss = (look) => `
${FONT_CSS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:${look.ground};-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
`;

const measurePage = (look, slides) => `<!doctype html><html><head><meta charset="utf-8"><style>
${baseCss(look)}
.m{position:absolute;left:0;top:0;white-space:nowrap;font-family:${HEAD.family};font-weight:${HEAD.weight};
  font-size:100px;letter-spacing:${HEAD.tracking};font-kerning:normal}
.s{position:absolute;left:0;top:200px;white-space:nowrap;font-family:'Manrope';font-weight:600;font-size:${SUB_SIZE}px}
.n{position:absolute;left:0;top:400px;white-space:nowrap;font-family:'Manrope';font-weight:700;font-size:44px}
</style></head><body>
${slides.flatMap((s) => s.lines).map((l) => `<span class="m">${esc(plain(l))}</span>`).join("\n")}
${slides.map((s) => `<span class="s">${esc(s.sub)}</span>`).join("\n")}
${NOTE_PLUS.map((l) => `<span class="n">${esc(l)}</span>`).join("\n")}
<pre id="out">pending</pre>
<script>
document.fonts.ready.then(() => {
  const ok = document.fonts.check("${HEAD.weight} 100px ${HEAD.family}") && document.fonts.check("600 ${SUB_SIZE}px 'Manrope'");
  const w = (sel) => [...document.querySelectorAll(sel)].map((e) => [e.textContent, e.getBoundingClientRect().width]);
  document.getElementById('out').textContent = JSON.stringify({ ok, widths: w('.m'), subs: w('.s'), notes: w('.n') });
});
</script></body></html>`;

const slidePage = (look, slide, size, panel) => {
  const grid = look.grid
    ? `<svg class="grid" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>
        <pattern id="g" width="63.4" height="63.4" patternUnits="userSpaceOnUse" x="${PL}" y="${PT}">
          <path d="M0 0H63.4M0 0V63.4" stroke="${look.grid}" stroke-width="1.5" fill="none"/></pattern>
        <pattern id="t" width="253.6" height="253.6" patternUnits="userSpaceOnUse" x="${PL}" y="${PT}">
          <circle cx="0" cy="0" r="3" fill="${look.tick}"/><circle cx="126.8" cy="126.8" r="3" fill="${look.tick}"/></pattern>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.55"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0.2"/></linearGradient>
        <mask id="m"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask></defs>
        <g mask="url(#m)"><rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#t)"/></g></svg>`
    : "";
  const noteTop = PT + panel.height + 46;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${baseCss(look)}
.grid{position:absolute;left:0;top:0}
.caption{position:absolute;left:${(W - MEASURE) / 2}px;width:${MEASURE}px;top:${CAPTION_TOP}px;height:${CAPTION_BOTTOM - CAPTION_TOP}px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
h1{font-family:${HEAD.family};font-weight:${HEAD.weight};font-size:${size}px;line-height:${HEAD.leading};
  letter-spacing:${HEAD.tracking};color:${look.ink};font-kerning:normal}
h1 .line{display:block;white-space:nowrap}
h1 .lit{color:${look.accent}}
.sub{margin-top:${Math.round(size * 0.34)}px;font-family:'Manrope';font-weight:600;font-size:${SUB_SIZE}px;line-height:1.25;
  letter-spacing:-0.005em;color:${look.dim};white-space:nowrap}
.card{position:absolute;left:${PL}px;top:${PT}px;width:${PW}px;height:${panel.height}px;border-radius:${RADIUS}px;overflow:hidden}
.card img{display:block;width:${PW}px;height:${panel.height}px}
.card::after{content:"";position:absolute;inset:0;border-radius:${RADIUS}px;box-shadow:${look.rim};pointer-events:none}
.note{position:absolute;left:0;right:0;top:${noteTop}px;text-align:center;font-family:'Manrope';font-weight:700;
  font-size:44px;line-height:1.3;color:${look.ink};white-space:nowrap}
</style></head><body>
${grid}
<div class="caption">
  <h1>${slide.lines.map((l) => `<span class="line">${lit(l)}</span>`).join("")}</h1>
  <div class="sub">${esc(slide.sub)}</div>
</div>
<div class="card"><img src="${url(panel.file)}"></div>
${slide.note ? `<div class="note">${slide.note.map(esc).join("<br>")}</div>` : ""}
</body></html>`;
};

/* ---- chrome ------------------------------------------------------------------------------------ */

const profileArg = flag("profile-dir");
const CHROME_PROFILE = profileArg ? path.resolve(profileArg) : fs.mkdtempSync(path.join(os.tmpdir(), "dq-store-chrome-"));
fs.mkdirSync(CHROME_PROFILE, { recursive: true });

const chromeArgs = (extra) => [
  "--headless=new",
  "--mute-audio",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--allow-file-access-from-files",
  "--force-device-scale-factor=1",
  "--force-color-profile=srgb",
  `--window-size=${W},${H}`,
  "--virtual-time-budget=6000",
  `--user-data-dir=${CHROME_PROFILE}`,
  ...extra,
];
const chrome = (extra, opts = {}) => {
  const r = spawnSync(CHROME, chromeArgs(extra), { encoding: "utf8", timeout: CHROME_TIMEOUT_MS, windowsHide: true, ...opts });
  if (r.error) throw new Error(`chrome: ${r.error.message}`);
  return r;
};

const dumpDom = (file) => {
  const r = chrome(["--dump-dom", url(file)], { maxBuffer: 64 << 20 });
  const m = r.stdout.match(/<pre id="out">([^<]*)<\/pre>/);
  if (!m || m[1] === "pending") throw new Error(`measure pass did not finish: ${r.stderr.slice(-400)}`);
  return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
};

const screenshot = (file, out) => {
  if (fs.existsSync(out)) fs.rmSync(out);
  chrome([`--screenshot=${out}`, url(file)]);
  if (!fs.existsSync(out)) throw new Error(`chrome wrote no screenshot for ${file}`);
};

/* ---- export ----------------------------------------------------------------------------------- */

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * The upload file: flattened onto the ground, no alpha, sRGB, 72 dpi, PNG. A smaller size is
 * scaled to its width with lanczos and the leftover rows trimmed evenly off the top and bottom;
 * every trimmed row must be ground (the faint graticule allowed), so nothing is cut or stretched.
 */
const exportPng = async (raw, out, width, height, ground) => {
  let img = sharp(raw).flatten({ background: ground });
  if (width !== W || height !== H) {
    const h = Math.round((H * width) / W);
    const trim = h - height;
    if (trim < 0) throw new Error(`${out}: ${width}x${height} is taller in proportion than ${W}x${H}`);
    const top = Math.floor(trim / 2);
    const scaled = await img.resize(width, h, { kernel: "lanczos3" }).removeAlpha().raw().toBuffer();
    const g = hexRgb(ground);
    for (const y of [...Array(top).keys(), ...Array.from({ length: trim - top }, (_, i) => h - 1 - i)]) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3;
        const d = Math.max(Math.abs(scaled[i] - g[0]), Math.abs(scaled[i + 1] - g[1]), Math.abs(scaled[i + 2] - g[2]));
        if (d > 20) throw new Error(`${out}: trimmed row ${y} is not ground at x=${x} (off by ${d})`);
      }
    }
    img = sharp(scaled, { raw: { width, height: h, channels: 3 } }).extract({ left: 0, top, width, height });
  }
  await img.removeAlpha().toColorspace("srgb").withMetadata({ density: 72 }).png({ compressionLevel: 9 }).toFile(out);
  const m = await sharp(out).metadata();
  const ok = m.width === width && m.height === height && !m.hasAlpha && m.channels === 3 && m.space === "srgb";
  if (!ok) throw new Error(`${out}: ${m.width}x${m.height} alpha=${m.hasAlpha} channels=${m.channels} space=${m.space}`);
  return m;
};

/** The first three at App Store search-result sizes (230 and 134 px wide), on white and on black. */
const thumbs = async (files, out) => {
  const rows = [];
  for (const tw of [230, 134]) {
    const th = Math.round((H * tw) / W);
    const gap = 14;
    const pad = 28;
    const rowW = pad * 2 + tw * 3 + gap * 2;
    for (const bg of ["#FFFFFF", "#000000"]) {
      const tiles = await Promise.all(
        files.map(async (f) => {
          const mask = Buffer.from(`<svg width="${tw}" height="${th}"><rect width="${tw}" height="${th}" rx="10" ry="10"/></svg>`);
          return sharp(f).resize(tw, th, { kernel: "lanczos3" }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
        }),
      );
      rows.push({
        w: rowW,
        h: th + pad * 2,
        buf: await sharp({ create: { width: rowW, height: th + pad * 2, channels: 3, background: bg } })
          .composite(tiles.map((input, i) => ({ input, left: pad + i * (tw + gap), top: pad })))
          .png()
          .toBuffer(),
      });
    }
  }
  const sheetW = Math.max(...rows.map((r) => r.w));
  let y = 0;
  const layers = rows.map((r) => {
    const l = { input: r.buf, left: 0, top: y };
    y += r.h;
    return l;
  });
  await sharp({ create: { width: sheetW, height: y, channels: 3, background: "#808080" } })
    .composite(layers)
    .jpeg({ quality: 92 })
    .toFile(out);
};

/** The whole set on one sheet; under each slide its name, source and what to confirm (amber). */
const contact = async (files, labels, out, sheet) => {
  const tw = 440;
  const th = Math.round((H * tw) / W);
  const gap = 28;
  const head = 64;
  const lineH = 28;
  const maxLines = Math.max(...labels.items.map((l) => l.length));
  const cols = files.length;
  const sheetW = gap + cols * (tw + gap);
  const sheetH = head + th + gap + maxLines * lineH + gap;
  const tiles = await Promise.all(files.map((f) => sharp(f).resize(tw, th, { kernel: "lanczos3" }).png().toBuffer()));
  const text = Buffer.from(
    `<svg width="${sheetW}" height="${sheetH}" xmlns="http://www.w3.org/2000/svg">
      <text x="${gap}" y="44" font-family="Consolas, monospace" font-size="26" fill="${sheet.ink}">${esc(labels.title)}</text>
      ${labels.items
        .map((lines, i) =>
          lines
            .map(([t, warn], j) => `<text x="${gap + i * (tw + gap)}" y="${head + th + gap + 8 + j * lineH}" font-family="Consolas, monospace" font-size="${j ? 18 : 22}" fill="${warn ? "#E0A33E" : sheet.ink}">${esc(t)}</text>`)
            .join(""),
        )
        .join("")}
    </svg>`,
  );
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: sheet.ground } })
    .composite([...tiles.map((input, i) => ({ input, left: gap + i * (tw + gap), top: head })), { input: text, left: 0, top: 0 }])
    .jpeg({ quality: 90 })
    .toFile(out);
};

/* ---- run ------------------------------------------------------------------------------------- */

const onlySet = flag("set");
const only = flag("only")?.split(",") ?? null;
const themes = onlySet ? [onlySet] : ["dark", "light"];
for (const t of themes) if (!LOOKS[t]) throw new Error(`no set "${t}"`);

const report = [];
try {
  for (const theme of themes) {
    const look = LOOKS[theme];
    const setName = `${theme}-b${BUILD.n}`;
    const setDir = path.join(OUT, `set-${setName}`);
    const sizeDirs = SIZES.slice(1).map(([w, h]) => path.join(setDir, `${w}x${h}`));
    for (const d of sizeDirs) fs.mkdirSync(d, { recursive: true });
    // Clear last run's PNGs so a renamed slide cannot linger in an upload folder.
    if (!only) {
      for (const d of [setDir, ...sizeDirs]) for (const f of fs.readdirSync(d)) if (f.endsWith(".png")) fs.rmSync(path.join(d, f));
    }

    // Pass 1: one headline size for the whole set, and every sub-line and note must fit the measure.
    const mFile = path.join(HTML_DIR, `measure-${setName}.html`);
    fs.writeFileSync(mFile, measurePage(look, COPY));
    const m = dumpDom(mFile);
    if (!m.ok) throw new Error("a face did not load in the measure pass");
    const widest = Math.max(...m.widths.map(([, w]) => w));
    const size = Math.min(HEAD_MAX, Math.floor((MEASURE / widest) * 100 * 0.98));
    for (const [t, w] of [...m.subs, ...m.notes]) if (w > W - 80) throw new Error(`"${t}" is ${Math.round(w)}px, wider than the canvas`);

    const made = [];
    for (const slide of COPY) {
      if (only && !only.includes(slide.n)) continue;
      const name = `${slide.n}-${slide.slug}`;
      const src = sourceFor(theme, slide);
      const panel = await panelFile(theme, slide, src);
      const html = path.join(HTML_DIR, `${setName}-${name}.html`);
      fs.writeFileSync(html, slidePage(look, slide, size, panel));
      const raw = path.join(RAW_DIR, `${setName}-${name}.png`);
      screenshot(html, raw);
      const files = {};
      for (const [w, h] of SIZES) {
        const out = w === W && h === H ? path.join(setDir, `${name}.png`) : path.join(setDir, `${w}x${h}`, `${name}.png`);
        await exportPng(raw, out, w, h, look.ground);
        files[`${w}x${h}`] = out;
      }
      made.push({
        name, files, big: files[`${W}x${H}`],
        headline: slide.lines.map(plain).join(" / "), sub: slide.sub, note: slide.note ?? null,
        source: { key: src.key, scale: src.scale, mode: src.mode, sha256: src.sha256, store: src.store.slice(0, 160) },
        windowPt: slide.win.map((v) => Math.round(v * 100) / 100), padPt: slide.pad ?? 0, windowPx: panel.windowPx,
        panel: { width: PW, height: panel.height, scale: Number(panel.scale.toFixed(4)), insetTop: panel.insetTop, insetBottom: panel.insetBottom },
        confirm: src.confirm,
      });
    }
    report.push({ theme, setDir, size, widest: Math.round(widest), subs: m.subs, made });

    if (!only) {
      const renderSrc = reportAt(3).source;
      fs.writeFileSync(
        path.join(OUT, `manifest-${setName}.json`),
        JSON.stringify({ build: BUILD, renderedFrom: { commit: renderSrc.commit, real: renderSrc.real, pinned: renderSrc.pinned }, headline: size, slides: made }, null, 1),
      );
      await thumbs(made.slice(0, 3).map((x) => x.big), path.join(OUT, `thumbs-${setName}.jpg`));
      await contact(
        made.map((x) => x.big),
        {
          title: `DuoQueue App Store screenshots / set ${theme.toUpperCase()} / 1320x2868 / build ${BUILD.n} (${BUILD.commit}), rendered from the pinned checkout`,
          items: made.map((x) => [
            [x.name],
            [`${x.source.key} @${x.source.scale}x, panel ${x.panel.height}px`],
            ...x.confirm.map((c) => [`confirm: ${c}`, true]),
          ]),
        },
        path.join(OUT, `contact-${setName}.jpg`),
        look.sheet,
      );
    }
  }
} finally {
  if (!profileArg) fs.rmSync(CHROME_PROFILE, { recursive: true, force: true });
}

for (const r of report) {
  console.log(`\nset ${r.theme}: headline ${r.size}px, widest line ${r.widest}px at 100px; widest sub ${Math.round(Math.max(...r.subs.map(([, w]) => w)))}px -> ${r.setDir}`);
  for (const x of r.made) {
    console.log(
      `  ${x.name}.png  ${x.source.key} @${x.source.scale}x  window ${x.windowPt[1]}-${x.windowPt[3]} pt  panel ${PW}x${x.panel.height} at ${x.panel.scale}x  inset top ${x.panel.insetTop} bottom ${x.panel.insetBottom}`,
    );
    for (const c of x.confirm) console.log(`      confirm: ${c}`);
  }
}
