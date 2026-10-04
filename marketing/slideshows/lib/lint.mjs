// Copy rules for the TikTok slideshows. Every rule here came from Cameron or from TikTok's
// policy research (3 Oct 2026); render.mjs refuses to render while any of them fails.

export const DASHES = /[‐-―−﹘﹣－]/; // hyphen-minus "-" is fine
// Nothing that reads as a dating or meeting app, never "beats", no promised results.
export const BANNED =
  /\b(beats?|match(es|ed|ing)?|matchmak\w*|swip(e|es|ed|ing)|dat(e|es|ing)|meet(s|ing|up)?|romance|romantic|partners?|single|couples?|flirt\w*|crush|soulmates?|guarantee(d|s)?)\b/i;
export const RIOT_TAGS = /#(leagueoflegends|lol|riot\w*|lolesports|valorant)\b/i;
export const APP_WORDS = /duo\s?queue|duoq\b|app\s?store|\bapps?\b|iphone|download/i;
const BRAND = /duo\s*q\w*/gi;

export function slideStrings(slide) {
  const out = [];
  for (const k of ["opener", "kicker", "chip", "head", "mark", "body", "line", "small", "take", "source", "ghost"]) {
    if (slide[k]) out.push([k, String(slide[k])]);
  }
  for (const r of slide.rows || []) out.push(["rows", r.join(" ")]);
  for (const r of slide.rails || []) out.push(["rails", r.join(" ")]);
  return out;
}

export function lintShow(show, { seriesLabel }) {
  const errs = [];
  const where = (i, k) => `${show.id} slide ${i + 1} ${k}`;
  const n = show.slides.length;
  if (n < 5 || n > 8) errs.push(`${show.id}: ${n} slides (want 5 to 8)`);
  if (show.title.length > 90) errs.push(`${show.id}: title is ${show.title.length} characters (TikTok max 90)`);
  if (!/^\d\d$/.test(show.id)) errs.push(`${show.id}: id must be two digits`);

  const texts = [[`${show.id} title`, show.title], [`${show.id} caption`, show.caption], [`${show.id} series label`, seriesLabel]];
  show.slides.forEach((s, i) => slideStrings(s).forEach(([k, v]) => texts.push([where(i, k), v])));

  for (const [w, t] of texts) {
    if (DASHES.test(t)) errs.push(`${w}: em/en dash or other dash character in "${t}"`);
    const b = t.match(BANNED);
    if (b) errs.push(`${w}: banned word "${b[0]}" in "${t}"`);
    const r = t.match(RIOT_TAGS);
    if (r) errs.push(`${w}: Riot hashtag ${r[0]}`);
    for (const m of t.matchAll(BRAND)) {
      if (m[0] !== "DuoQueue" && !(m[0] === "duoqueue" && t[m.index - 1] === "#")) {
        errs.push(`${w}: spell it DuoQueue, not "${m[0]}"`);
      }
    }
  }

  // App mentions: 07 to 10 never; 01 to 06 only on the last slide (and #duoqueue in the caption).
  show.slides.forEach((s, i) => {
    const isCta = show.appCta && i === n - 1;
    if (isCta) return;
    for (const [k, v] of slideStrings(s)) {
      const m = v.match(APP_WORDS);
      if (m) errs.push(`${where(i, k)}: app mention "${m[0]}" outside the CTA slide`);
    }
  });
  if (!show.appCta) {
    for (const [w, t] of [[`${show.id} title`, show.title], [`${show.id} caption`, show.caption]]) {
      const m = t.match(APP_WORDS);
      if (m) errs.push(`${w}: app mention "${m[0]}" in a no-app slideshow`);
    }
  } else {
    const last = show.slides[n - 1];
    if (last.layout !== "cta") errs.push(`${show.id}: appCta slideshows must end on a cta slide`);
    if (!/DuoQueue/.test(`${last.line} ${last.small}`)) errs.push(`${show.id}: CTA must name DuoQueue`);
    if (!/#duoqueue\b/.test(show.caption)) errs.push(`${show.id}: caption should carry #duoqueue`);
  }
  if (show.title.match(APP_WORDS)) errs.push(`${show.id}: title mentions the app`);

  // Every tip is backed by a source or flagged as opinion.
  show.slides.forEach((s, i) => {
    if (s.role === "tip" && !s.source && !s.take) errs.push(`${where(i, "")}: tip with no source and no MY TAKE`);
    if (s.role === "hook" && !s.opener) errs.push(`${where(i, "")}: hook with no opener`);
    if (s.openerInHead) {
      // the opener is drawn as part of the headline, so the headline has to start with it
      const stem = s.opener.replace(/[_\s.]+$/, "").toLowerCase();
      if (!s.head.toLowerCase().startsWith(stem)) errs.push(`${where(i, "")}: openerInHead but the headline doesn't start with "${stem}"`);
    }
    if ((s.layout === "hook-photo" || s.layout === "tip-photo") && !s.bg) errs.push(`${where(i, "")}: photo layout with no bg`);
    if (s.layout === "rails" && (!s.rails || s.rails.length !== 2)) errs.push(`${where(i, "")}: rails needs two rails`);
    if (s.layout === "log" && !(s.rows && s.rows.length)) errs.push(`${where(i, "")}: log needs rows`);
  });
  if (show.slides[0].role !== "hook") errs.push(`${show.id}: first slide must be the hook`);
  return errs;
}

// The whole batch: no two slideshows may share a run of 7 words in their headlines, bodies or
// rails. Posting one a day, a follower would otherwise meet the same finding twice in a week.
const RUN = 7;
export function lintBatch(shows) {
  const seen = new Map(); // shingle -> "07 slide 3"
  const errs = [];
  for (const show of shows) {
    show.slides.forEach((s, i) => {
      const text = [s.head, s.body, ...(s.rails || []).map((r) => r[1])].filter(Boolean).join(" ");
      const words = text.toLowerCase().replace(/[^a-z0-9%' ]+/g, " ").split(/\s+/).filter(Boolean);
      for (let j = 0; j + RUN <= words.length; j++) {
        const sh = words.slice(j, j + RUN).join(" ");
        const prev = seen.get(sh);
        if (prev && !prev.startsWith(`${show.id} `)) errs.push(`${show.id} slide ${i + 1} repeats ${prev}: "${sh}"`);
        if (!prev) seen.set(sh, `${show.id} slide ${i + 1}`);
      }
    });
  }
  return [...new Set(errs)];
}

// Generated text files: no dashes anywhere, never "beats".
export function lintFile(name, text) {
  const errs = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (DASHES.test(line)) errs.push(`${name}:${i + 1}: dash character`);
    if (/\bbeats?\b/i.test(line)) errs.push(`${name}:${i + 1}: the word "beats"`);
  });
  return errs;
}
