// The text files Cameron posts from: caption.txt per slideshow, HOW TO POST.txt, sources.txt
// and posting-log.csv. Plain words, no dashes.
import { bgSourceNote } from "../backgrounds.mjs";

const pad2 = (n) => String(n).padStart(2, "0");

const LAYOUT_NAMES = {
  "hook-photo": "photo",
  "tip-photo": "photo with a text panel",
  card: "Volt type, tip card",
  paper: "Volt type, paper card",
  flood: "Volt type, full chartreuse",
  log: "Volt type, list of rows",
  rails: "Volt type, you say / your duo says",
  slab: "Volt type",
  cta: "Volt type with a plain drawn search box (no app screens)",
};

export function folderName(show) {
  const clean = show.title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  return `${show.id} - ${clean}`;
}

export function fallbackCaption(show) {
  return show.caption
    .replace(/\s*DuoQueue isn't endorsed by Riot Games\./, "")
    .replace(/\s*#duoqueue\b/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatOf(show) {
  const photos = show.slides.filter((s) => s.bg).length;
  if (photos === show.slides.length) return "photo on every slide";
  if (photos === 0) return "all Volt type";
  if (show.slides[0].bg && photos === 1) return "photo hook + Volt type";
  return `photo hook + Volt type + ${photos - 1} more photo${photos > 2 ? "s" : ""}`;
}

export function slideLabel(s) {
  const head = s.head.replace(/\s*\n\s*/g, " ");
  return s.quote ? `"${head}"` : head;
}

export function captionTxt(show) {
  const n = show.slides.length;
  const L = [];
  L.push(`SLIDESHOW ${show.id}: ${show.title}`);
  L.push(`TikTok only. Photo post with ${n} photos: add 01.png to ${pad2(n)}.png in order, 01 first.`);
  L.push("");
  L.push(`TITLE (paste into the title field; ${show.title.length} of 90 characters):`);
  L.push(show.title);
  L.push("");
  L.push("DESCRIPTION (paste into the description):");
  L.push(show.caption);
  L.push("");
  L.push("BEFORE YOU POST:");
  if (show.appCta) {
    L.push("- DISCLOSURE ON. The last slide names DuoQueue, so before you post: More options, then");
    L.push("  Content disclosure and ads, switch on Disclose commercial content, then pick Your brand.");
  } else {
    L.push("- No disclosure. Nothing in this post names DuoQueue, so leave Disclose commercial content off.");
    L.push("  Don't add DuoQueue or #duoqueue to the description or a comment either.");
  }
  L.push("- Sound: TikTok puts a song on photo posts by itself. Change it to one from Commercial Sounds");
  L.push("  (Add sound, Sounds, then the Commercial Sounds list), or turn the volume to zero.");
  L.push("- Cover: slide 01.");
  L.push("- No #leagueoflegends, #lol or #riot, and no screenshots of the app or the game.");
  if (show.appCta) {
    L.push("");
    L.push("ONLY IF HOW TO POST.txt TELLS YOU TO DROP THE DUOQUEUE SLIDE:");
    L.push(`Post 01.png to ${pad2(n - 1)}.png only (leave out ${pad2(n)}.png), leave disclosure OFF, and use this description:`);
    L.push(fallbackCaption(show));
  }
  L.push("");
  L.push(`HOOK TYPE: ${show.hookType}. OPENER: "${show.opener.replace(/\.$/, "")}". FORMAT: ${formatOf(show)}.`);
  L.push("");
  L.push("WHAT IS ON EACH SLIDE:");
  show.slides.forEach((s, i) => {
    L.push(`${pad2(i + 1)}  ${slideLabel(s)}`);
    L.push(`    background: ${s.bg ? bgSourceNote(s.bg) : LAYOUT_NAMES[s.layout]}`);
    if (s.source) L.push(`    source: ${s.source}`);
    if (s.take) L.push(`    marked on the slide as ${s.take} (opinion)`);
    if (s.role === "cta") L.push("    the one DuoQueue slide");
  });
  L.push("");
  L.push("FULL SOURCES:");
  for (const src of show.sources) L.push(`- ${src}`);
  return L.join("\n") + "\n";
}

export function sourcesTxt(shows) {
  const L = ["SOURCES FOR THE TIKTOK SLIDESHOWS, BATCH 1 (3 Oct 2026)", ""];
  L.push("Each slide prints a short source tag; the full citation is listed under its slideshow.");
  L.push("A MY TAKE chip on a slide means that line is Cameron's opinion, not a finding.");
  for (const show of shows) {
    L.push("");
    L.push(`${show.id}  ${show.title}`);
    show.slides.forEach((s, i) => {
      if (s.source || s.take) L.push(`  slide ${pad2(i + 1)}: ${[s.source, s.take].filter(Boolean).join(" + ")}`);
    });
    for (const src of show.sources) L.push(`  - ${src}`);
  }
  return L.join("\n") + "\n";
}

export const OLD_DRAFT_DIR = "Old draft (do not post)";

export function howToPostTxt(shows, postOrder, { staleFolders = [], oldDraft = false } = {}) {
  const byId = Object.fromEntries(shows.map((s) => [s.id, s]));
  const L = [];
  L.push("DUOQUEUE TIKTOK SLIDESHOWS, BATCH 1 (made 3 Oct 2026)");
  L.push("");
  if (staleFolders.length) {
    L.push("DELETE BEFORE POSTING");
    L.push("These folders are an older draft of this batch with different slides. Don't post them:");
    for (const f of staleFolders) L.push(`  ${f}`);
    L.push("The folders to post are the ones named like \"07 - 5 ranked myths you still believe\".");
    L.push("");
  }
  L.push("WHAT THIS IS");
  L.push("Ten photo posts for TikTok ONLY (TikTok calls them photo mode). Each folder holds the slides in");
  L.push("order (01.png, 02.png, ...), caption.txt with the title, the description and what to switch on,");
  L.push("and contact-sheet.jpg, which shows the whole slideshow on one image. There are no app screens");
  L.push("anywhere. Gaming tips come first:");
  L.push("- 01 to 06 end with ONE text slide: \"Search DuoQueue on the App Store. Free to download on iPhone.\"");
  L.push("- 07 to 10 never mention DuoQueue. They are pure tips, and they also show whether your account");
  L.push("  itself is being held back.");
  L.push("Every fact has a short source tag on its slide (full list in sources.txt). Opinions carry a");
  L.push("MY TAKE chip.");
  if (oldDraft) {
    L.push(`Ignore the folder "${OLD_DRAFT_DIR}". It holds an older draft of this batch.`);
  }
  L.push("");
  L.push("HOW TO POST ONE (iPhone)");
  L.push("1. Get that folder's PNGs onto your iPhone. AirDrop doesn't work from this PC, so use iCloud Drive:");
  L.push("   a. On this PC, go to icloud.com/iclouddrive in your browser and sign in. Open the slideshow");
  L.push("      folder in File Explorer, select the PNGs (01.png and up; the files, not the folder, because");
  L.push("      iCloud.com only takes files) and drag them into the iCloud Drive window.");
  L.push("   b. On your iPhone, open the Files app, then Browse, then iCloud Drive. Tap the three dots at the");
  L.push("      top right, then Select, tick the PNGs, tap Share (bottom left), then Save Images (or Save");
  L.push("      Items with a number). They land in Photos, under Recents.");
  L.push("   Not icloud.com/photos: it may refuse PNG files. If iCloud Drive gives you trouble, email the");
  L.push("   PNGs to yourself and save each picture from the email on your iPhone.");
  L.push("2. In TikTok: + (Add Post), then Photo, then Upload. Pick the photos in order, 01 first");
  L.push("   (contact-sheet.jpg shows the order if Photos mixes them up).");
  L.push("   Make sure it posts as a PHOTO post people flip through, not turned into a video.");
  L.push("3. Paste the TITLE and DESCRIPTION from caption.txt.");
  L.push("4. Sound: TikTok adds a song by itself. Change it to one from Commercial Sounds (Add sound,");
  L.push("   Sounds, Commercial Sounds), or turn the volume to zero.");
  L.push("5. 01 to 06 only: More options, then Content disclosure and ads, switch on Disclose commercial");
  L.push("   content, then pick Your brand. 07 to 10: leave it off.");
  L.push("6. Post. Then fill in that row of posting-log.csv.");
  L.push("(The button names come from TikTok's help pages; nobody has checked them on your phone yet.)");
  L.push("");
  L.push("ORDER (one a day; 07 goes first because it is the clean test of the account)");
  postOrder.forEach((id, i) => {
    const s = byId[id];
    L.push(`  Day ${String(i + 1).padStart(2)}: ${id}  ${s.title}   (${s.appCta ? "names DuoQueue: disclosure ON" : "no app: no disclosure"})`);
  });
  L.push("");
  L.push("WHAT TO CHECK");
  L.push("- 24 hours after 07: if it has 0 views, the problem is the account, not these posts. Check");
  L.push("  Account status before posting more, and don't post the DuoQueue ones yet.");
  const firstApp = postOrder.find((id) => byId[id].appCta);
  const laterApp = postOrder.filter((id) => byId[id].appCta && id !== firstApp);
  L.push(`- After ${firstApp}, wait 48 hours. If ${firstApp} shows about 0 For You views, or a not eligible or rejected`);
  L.push("  notice, while 07 to 10 got views: post the rest of the DuoQueue ones");
  L.push(`  (${laterApp.join(", ")}) WITHOUT their last slide, without #duoqueue and with no disclosure.`);
  L.push("  Each caption.txt has that shorter description ready.");
  L.push("- Don't use Promote on 01 to 06 until one of them gets For You views on its own.");
  L.push("- Saves and shares are what slideshows are good at. Write them down next to views.");
  L.push("- Be realistic: Metricool (May 2026, 2.3 million posts) found TikTok videos got about 5 times the");
  L.push("  reach of photo posts, while Fanpage Karma (Jan to May 2025, about 700,000 posts) found photo");
  L.push("  posts got about 81% more engagement. Treat this batch as a test of hooks and formats.");
  L.push("");
  L.push("THE TEST INSIDE THE BATCH");
  L.push("Each slideshow uses a different opener and hook type. Formats are mixed: a photo of you or your");
  L.push("cat on slide 1 then type slides, all-type slides (02), and a photo on every slide (08).");
  L.push("posting-log.csv lets you see which opener and which format pulled views.");
  L.push("");
  L.push("TRY THESE IN YOUR LEAGUE CLIENT BEFORE POSTING THE SLIDESHOW THEY ARE IN");
  L.push("- 10, slide 3: hold Tab and click the enemy's Flash on the scoreboard. It should post their Flash");
  L.push("  in team chat.");
  L.push("- 02, slide 2: in a replay, check the speed control goes to 8x (a 2021 Dignitas guide says so).");
  L.push("- 02, slide 3: in a replay, set the fog of war to your own team.");
  L.push("If any of these doesn't work the way the slide says, tell Claude and it will change that slide.");
  L.push("");
  L.push("DO NOT");
  L.push("- Add app screenshots, gameplay, champion art or Riot logos.");
  L.push("- Use #leagueoflegends, #lol or #riot.");
  L.push("- Add DuoQueue to the description, hashtags or comments of 07 to 10.");
  L.push("- Post the same slideshow twice. Re-cut it with a new first slide instead.");
  return L.join("\n") + "\n";
}

export const LOG_HEADER = [
  "day", "date posted", "slideshow", "title", "names DuoQueue", "hook type", "opener", "format",
  "slide 1 background", "disclosure on", "sound", "views 24h", "views 72h", "For You %", "likes",
  "comments", "shares", "saves", "notes",
];
// Columns Cameron fills in by hand. If any of them has data, the log is never overwritten.
export const LOG_FILLED = ["date posted", "disclosure on", "sound", "views 24h", "views 72h", "For You %", "likes", "comments", "shares", "saves", "notes"];

const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export function postingLogCsv(shows, postOrder) {
  const byId = Object.fromEntries(shows.map((s) => [s.id, s]));
  const rows = [LOG_HEADER.join(",")];
  postOrder.forEach((id, i) => {
    const s = byId[id];
    const first = s.slides[0];
    const cells = {
      day: i + 1,
      slideshow: id,
      title: s.title,
      "names DuoQueue": s.appCta ? "yes" : "no",
      "hook type": s.hookType,
      opener: s.opener.replace(/\.$/, ""),
      format: formatOf(s),
      "slide 1 background": first.bg ? first.bg : "Volt type",
    };
    rows.push(LOG_HEADER.map((h) => csvCell(cells[h] ?? "")).join(","));
  });
  return rows.join("\n") + "\n";
}

// Minimal CSV reader (quoted cells, commas, doubled quotes).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function logHasPostingData(text) {
  const rows = parseCsv(text);
  if (!rows.length) return false;
  const head = rows[0];
  const idx = LOG_FILLED.map((h) => head.indexOf(h)).filter((i) => i >= 0);
  return rows.slice(1).some((r) => idx.some((i) => (r[i] || "").trim()));
}
