// scripts/seed-review-demo.mjs — creates (and can fully remove) everything App Review needs
// to see a working app: the review account itself, ~14 demo gaming-partner profiles, one
// pre-built match with a conversation, and a few profiles who've already liked the review
// account. Every row this script touches is flagged `is_demo = true`, which the visibility
// gating added in supabase/migrations/0059_review_demo_visibility.sql hides from every real
// user (KittyKat included) at the database level — see that migration's header for the full
// argument. This script does not touch that gating; it only produces data for it to gate.
//
// Photos are the abstract Volt-palette avatars from scripts/generate-demo-avatars.mjs
// (assets/demo/*.png) — geometric generated art, never anything that could read as a real or
// AI-generated face.
//
// Usage (from repo root, requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env):
//   node scripts/seed-review-demo.mjs                  create/update everything
//   node scripts/seed-review-demo.mjs --reset-password  also rotate the review account's password
//   node scripts/seed-review-demo.mjs --remove          delete every trace (auth users, DB rows via
//                                                        cascade, and the uploaded storage objects)
//
// Idempotency: every account's id is deterministically derived from a fixed slug (see
// `demoId` below), not randomly generated, so re-running the create path finds the same auth
// users again instead of making new ones. Every child table (games/shows/platforms/
// playstyles/prompts/media/messages) is fully replaced (delete-then-insert) for each id on
// every run, so re-running never leaves duplicate or stale rows behind either.
//
// The review account's password is generated once on first creation and then left alone on
// every subsequent run (re-running this script must not silently invalidate a credential
// Cameron has already handed to Apple). Pass --reset-password to rotate it deliberately.

import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = path.join(__dirname, "..", "assets", "demo");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment. Copy .env.example " +
      "to .env, fill in the service role key, and re-run (never commit that key).",
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// =============================================================================
// Deterministic ids — sha256(namespace:seed), formatted as a v4-shaped UUID. Not a real
// RFC 4122 v5 (no need for interop with anything that cares), just a stable, collision-safe
// way to compute "the same id every time" for a given slug so reruns are idempotent without
// needing to look anything up by email first.
// =============================================================================
const ID_NAMESPACE = "duoqueue-review-demo-v1";
function demoId(seed) {
  const hash = createHash("sha256").update(`${ID_NAMESPACE}:${seed}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4 nibble
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function generatePassword() {
  return randomBytes(18).toString("base64url"); // ~24 chars, URL/paste-safe, plenty strong
}

function dobForAge(years) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 20); // buffer well past the "must be 18" boundary
  return d.toISOString().slice(0, 10);
}

const NOW = Date.now();
const minutesAgoIso = (m) => new Date(NOW - m * 60000).toISOString();
const afterMinutesIso = (iso, m) => new Date(new Date(iso).getTime() + m * 60000).toISOString();

// =============================================================================
// The review account itself. Flagged is_demo = true so it can see the demo pool (that's the
// whole gating mechanism), fully onboarded so nothing in the app nags it to finish setup.
// =============================================================================
const REVIEW_EMAIL = "review@duoqueue.io";
const REVIEW_ID = demoId("review-account");
const REVIEWER = {
  displayName: "App Reviewer",
  age: 29,
  gender: "prefer_not_to_say",
  region: "na_east",
  timezone: "America/New_York",
  bio: "Here to find people to duo up with for relaxed co-op nights and the occasional competitive match.",
  discordUsername: null,
  games: [
    { name: "Stardew Valley", skill: "casual" },
    { name: "Rocket League", skill: "casual" },
  ],
  shows: ["The Office"],
  platforms: ["pc"],
  playstyles: ["chill"],
  prompts: [
    { q: "My comfort game is", a: "Stardew Valley, hands down." },
    { q: "I geek out on", a: "Finding new co-op games to try with friends." },
    { q: "I'll never turn down a round of", a: "Rocket League, even though I'm mediocre at it." },
  ],
  vibe: { intensity: 50, commsStyle: 50, coachingPref: 50, tiltHandling: "stays_calm" },
  playWindow: [18, 22],
  avatar: "avatar-01-circuit-traces.png",
  lastActiveMinutesAgo: 15,
};

// =============================================================================
// ~14 demo gaming-partner profiles. Real games/shows from the live catalog (verified against
// the DB before writing this list — see the seed script's companion verification notes),
// plausible platonic gaming bios and prompt answers. Nothing here reads as a dating profile:
// no romantic language anywhere, every prompt answer is about how/when/what they play.
// =============================================================================
const PERSONAS = [
  {
    slug: "priya-ferra",
    displayName: "Priya",
    age: 24,
    gender: "female",
    region: "na_east",
    timezone: "America/New_York",
    bio: "Diamond-to-Immortal Valorant grinder who takes ranked way too seriously on weeknights. Looking for a consistent duo who calls out rotations instead of just pinging.",
    discordUsername: "priya.aims",
    games: [
      { name: "Valorant", skill: "competitive", rank: "Immortal 1" },
      { name: "Counter-Strike 2", skill: "competitive" },
      { name: "Overwatch 2", skill: "intermediate" },
      { name: "Apex Legends", skill: "competitive" },
      { name: "Rocket League", skill: "intermediate" },
    ],
    shows: ["Arcane", "The Boys"],
    platforms: ["pc"],
    playstyles: ["competitive", "mic_required", "grinder"],
    prompts: [
      { q: "My most controversial gaming opinion is", a: "Aim assist doesn't belong in a tac shooter. Fight me in ranked." },
      { q: "My ideal co-op session involves", a: "Comms on, a clear callout economy, and zero tilt after a lost round." },
      { q: "I'll never turn down a round of", a: "Valorant ranked, especially if you can hold an angle without me asking twice." },
    ],
    vibe: { intensity: 78, commsStyle: 80, coachingPref: 60, tiltHandling: "tilts_but_recovers_fast" },
    playWindow: [18, 23],
    avatar: "avatar-01-circuit-traces.png",
    lastActiveMinutesAgo: 120,
  },
  {
    slug: "dae-lumen",
    displayName: "Dae",
    age: 27,
    gender: "non_binary",
    region: "sea",
    timezone: "Asia/Manila",
    bio: "Support main who lives for a clean vision game. Been climbing League ranked with the same three friends since season 9. There's always room for one more in the Discord.",
    discordUsername: "dae.lumen",
    games: [
      { name: "League of Legends", skill: "ranked_grinder", rank: "Diamond II" },
      { name: "Teamfight Tactics", skill: "competitive" },
      { name: "Valorant", skill: "intermediate" },
      { name: "Path of Exile 2", skill: "casual" },
    ],
    shows: ["Jujutsu Kaisen", "Solo Leveling"],
    platforms: ["pc", "mobile"],
    playstyles: ["competitive", "team_player", "late_night"],
    prompts: [
      { q: "I main", a: "Whatever the draft needs. I'll flex support if it wins us the game." },
      { q: "My go-to strategy in any game is", a: "Vision control first, fights second. Wards win more games than kills." },
      { q: "The best trash talk I've ever received was", a: "'You ward like you're getting paid by the hour.' Devastating. Accurate." },
    ],
    vibe: { intensity: 70, commsStyle: 65, coachingPref: 75, tiltHandling: "gets_frustrated_sometimes" },
    playWindow: [21, 2],
    avatar: "avatar-02-isometric-blocks.png",
    lastActiveMinutesAgo: 300,
  },
  {
    slug: "marcus-holt",
    displayName: "Marcus",
    age: 31,
    gender: "male",
    region: "eu",
    timezone: "Europe/Berlin",
    bio: "Deep Rock Galactic enjoyer, professional extraction-mission overthinker. Best nights are four strangers, one objective, and a lot of yelling 'rock and stone.'",
    discordUsername: "marcus.holt",
    games: [
      { name: "Deep Rock Galactic", skill: "ranked_grinder" },
      { name: "Helldivers 2", skill: "competitive" },
      { name: "Lethal Company", skill: "casual" },
      { name: "Left 4 Dead 2", skill: "intermediate" },
    ],
    shows: ["The Mandalorian", "Invincible"],
    platforms: ["pc", "playstation"],
    playstyles: ["casual_coop", "mic_required", "weekend_warrior"],
    prompts: [
      { q: "My ideal co-op session involves", a: "Four of us, one broken mission plan, and laughing too hard to dig straight." },
      { q: "A skill I'm weirdly proud of", a: "I can talk a team through a Helldivers extraction without anyone panicking." },
      { q: "My comfort game is", a: "Deep Rock Galactic. Rock and stone, every single time." },
    ],
    vibe: { intensity: 55, commsStyle: 70, coachingPref: 40, tiltHandling: "stays_calm" },
    playWindow: [19, 23],
    avatar: "avatar-03-hex-field.png",
    lastActiveMinutesAgo: 30,
  },
  {
    slug: "wren-oaks",
    displayName: "Wren",
    age: 29,
    gender: "prefer_not_to_say",
    region: "na_west",
    timezone: "America/Los_Angeles",
    bio: "Slow-paced games only, please. My Stardew farm is color-coded and my Animal Crossing island has a theme. Looking for chill co-op, not competitive anything.",
    discordUsername: "wren.oaks",
    games: [
      { name: "Stardew Valley", skill: "casual" },
      { name: "Palworld", skill: "intermediate" },
      { name: "Animal Crossing: New Horizons", skill: "casual" },
      { name: "Terraria", skill: "intermediate" },
      { name: "Minecraft", skill: "casual" },
    ],
    shows: ["Community", "Parks and Recreation"],
    platforms: ["switch", "pc"],
    playstyles: ["chill", "casual_coop", "no_mic"],
    prompts: [
      { q: "My comfort game is", a: "Stardew Valley. My farm is unreasonably organized and I regret nothing." },
      { q: "I geek out on", a: "Cozy game soundtracks. I will talk your ear off about lo-fi farming music." },
      { q: "My setup includes", a: "A Switch, tea, and zero interest in anything competitive after 9pm." },
    ],
    vibe: { intensity: 25, commsStyle: 30, coachingPref: 20, tiltHandling: "stays_calm" },
    playWindow: [10, 14],
    avatar: "avatar-04-waveform-bars.png",
    lastActiveMinutesAgo: 1440,
  },
  {
    slug: "kofi-mensah",
    displayName: "Kofi",
    age: 26,
    gender: "male",
    region: "africa",
    timezone: "Africa/Lagos",
    bio: "Grand Champion in Rocket League, still humble about it (mostly). Also deep in the Apex ranked grind, and happy to coach rotations if you're newer to the game.",
    discordUsername: "kofi.mensah",
    games: [
      { name: "Rocket League", skill: "ranked_grinder", rank: "Grand Champion" },
      { name: "Apex Legends", skill: "competitive" },
      { name: "Fortnite", skill: "intermediate" },
      { name: "Marvel Rivals", skill: "competitive" },
    ],
    shows: ["The Boys", "Attack on Titan"],
    platforms: ["pc", "xbox"],
    playstyles: ["competitive", "grinder", "mic_required"],
    prompts: [
      { q: "My proudest gaming achievement is", a: "Hit Grand Champion in Rocket League solo queue. Took two years. Worth it." },
      { q: "I will absolutely carry you if", a: "You're new to Apex and just want reps in. I love teaching rotations." },
      { q: "My win condition in life is", a: "A clean 50 burst and a teammate who calls out the third party." },
    ],
    vibe: { intensity: 82, commsStyle: 75, coachingPref: 65, tiltHandling: "tilts_but_recovers_fast" },
    playWindow: [17, 22],
    avatar: "avatar-05-concentric-target.png",
    lastActiveMinutesAgo: 180,
  },
  {
    slug: "sana-orimoto",
    displayName: "Sana",
    age: 23,
    gender: "female",
    region: "asia",
    timezone: "Asia/Tokyo",
    bio: "FFXIV raider who builds spreadsheets for fun. Currently pushing ultimate content and always recruiting reliable static members who show up on time.",
    discordUsername: "sana.orimoto",
    games: [
      { name: "Final Fantasy XIV", skill: "ranked_grinder", rank: "Savage Cleared" },
      { name: "Genshin Impact", skill: "competitive" },
      { name: "Monster Hunter Wilds", skill: "intermediate" },
      { name: "World of Warcraft", skill: "competitive" },
    ],
    shows: ["Demon Slayer", "Spy x Family"],
    platforms: ["pc", "playstation"],
    playstyles: ["team_player", "grinder", "mic_required"],
    prompts: [
      { q: "I'm looking for a duo who", a: "Shows up for raid night on time and actually reads the boss mechanics." },
      { q: "My proudest gaming achievement is", a: "Cleared ultimate content in FFXIV with a static I built from scratch." },
      { q: "Ask me about my favorite build", a: "My Genshin support rotation. I have opinions and a spreadsheet." },
    ],
    vibe: { intensity: 60, commsStyle: 55, coachingPref: 70, tiltHandling: "stays_calm" },
    playWindow: [20, 1],
    avatar: "avatar-06-dot-matrix.png",
    lastActiveMinutesAgo: 360,
  },
  {
    slug: "tobin-reyes",
    displayName: "Tobin",
    age: 33,
    gender: "male",
    region: "oce",
    timezone: "Australia/Sydney",
    bio: "Couch co-op evangelist. It Takes Two, Overcooked, anything that makes two people yell at a screen together. Bring snacks, I'll bring the chaos.",
    discordUsername: "tobin.reyes",
    games: [
      { name: "It Takes Two", skill: "casual" },
      { name: "Overcooked! 2", skill: "casual" },
      { name: "Fall Guys", skill: "casual" },
      { name: "Human: Fall Flat", skill: "casual" },
    ],
    shows: ["Rick and Morty", "Brooklyn Nine-Nine"],
    platforms: ["switch", "pc", "xbox"],
    playstyles: ["chill", "casual_coop", "weekend_warrior"],
    prompts: [
      { q: "A game night with me includes", a: "Snacks, Overcooked chaos, and at least one flipped table (in-game)." },
      { q: "My friend group calls me the", a: "The one who always picks the co-op game nobody's tried yet." },
      { q: "I'll never turn down a round of", a: "Fall Guys. I am bad at it and I do not care." },
    ],
    vibe: { intensity: 20, commsStyle: 60, coachingPref: 25, tiltHandling: "stays_calm" },
    playWindow: [19, 22],
    avatar: "avatar-07-radar-sweep.png",
    lastActiveMinutesAgo: 720,
  },
  {
    slug: "nadia-farouk",
    displayName: "Nadia",
    age: 28,
    gender: "female",
    region: "mena",
    timezone: "Asia/Dubai",
    bio: "Souls-like completionist with a soft spot for co-op summons. Slow, deliberate, and will absolutely make you watch a boss fight cutscene twice.",
    discordUsername: "nadia.farouk",
    games: [
      { name: "Elden Ring", skill: "competitive" },
      { name: "Baldur's Gate 3", skill: "ranked_grinder" },
      { name: "Diablo IV", skill: "intermediate" },
      { name: "Path of Exile 2", skill: "intermediate" },
    ],
    shows: ["Arcane", "Cyberpunk: Edgerunners"],
    platforms: ["pc", "playstation"],
    playstyles: ["solo_queue", "chill", "no_mic"],
    prompts: [
      { q: "The genre I always come back to is", a: "Souls-likes. I like games that respect my time and punish my mistakes." },
      { q: "My most underrated pick is", a: "Elden Ring co-op summons, an underrated way to make a brutal boss fun." },
      { q: "A game I'll defend to the death is", a: "Baldur's Gate 3. Yes, every playthrough takes 100 hours. Worth it." },
    ],
    vibe: { intensity: 45, commsStyle: 35, coachingPref: 50, tiltHandling: "needs_space_after_losses" },
    playWindow: [21, 0],
    avatar: "avatar-08-scanline-glitch.png",
    lastActiveMinutesAgo: 540,
  },
  {
    slug: "chase-abernathy",
    displayName: "Chase",
    age: 25,
    gender: "male",
    region: "na_east",
    timezone: "America/Chicago",
    bio: "Horror co-op only after midnight, non-negotiable. Phasmophobia and Lethal Company regular. Bring a working mic and low expectations for our survival odds.",
    discordUsername: "chase.abernathy",
    games: [
      { name: "Phasmophobia", skill: "competitive" },
      { name: "Lethal Company", skill: "ranked_grinder" },
      { name: "Left 4 Dead 2", skill: "intermediate" },
      { name: "DayZ", skill: "casual" },
    ],
    shows: ["The Office", "The Boys"],
    platforms: ["pc"],
    playstyles: ["late_night", "mic_required", "casual_coop"],
    prompts: [
      { q: "My gamertag origin story is", a: "Picked it during a Phasmophobia session at 2am and it just stuck." },
      { q: "The last game that made me rage quit", a: "Lethal Company, when a teammate opened every door at once. Every time." },
      { q: "I'll never turn down a round of", a: "Anything horror co-op after midnight. Bring headphones and low expectations." },
    ],
    vibe: { intensity: 50, commsStyle: 85, coachingPref: 30, tiltHandling: "gets_frustrated_sometimes" },
    playWindow: [22, 3],
    avatar: "avatar-09-triangle-mesh.png",
    lastActiveMinutesAgo: 1200,
  },
  {
    slug: "yuki-hashimoto",
    displayName: "Yuki",
    age: 22,
    gender: "non_binary",
    region: "asia",
    timezone: "Asia/Seoul",
    bio: "Fighting game grinder who studies frame data for fun. Street Fighter 6 ranked most evenings. Always looking for training partners, not just opponents.",
    discordUsername: "yuki.hash",
    games: [
      { name: "Street Fighter 6", skill: "ranked_grinder", rank: "Master Rank" },
      { name: "Tekken 8", skill: "competitive" },
      { name: "Super Smash Bros. Ultimate", skill: "competitive" },
      { name: "Apex Legends", skill: "casual" },
    ],
    shows: ["My Hero Academia", "Jujutsu Kaisen"],
    platforms: ["pc", "playstation"],
    playstyles: ["competitive", "solo_queue", "grinder"],
    prompts: [
      { q: "My tier list is unhinged because", a: "I will die on the hill that execution matters more than matchup knowledge." },
      { q: "A skill I'm weirdly proud of", a: "Frame data. Ask me anything about punish windows, I have it memorized." },
      { q: "I peaked in", a: "Street Fighter 6 ranked, briefly, before someone found my sidestep habit." },
    ],
    vibe: { intensity: 88, commsStyle: 40, coachingPref: 80, tiltHandling: "tilts_but_recovers_fast" },
    playWindow: [15, 19],
    avatar: "avatar-10-pixel-blocks.png",
    lastActiveMinutesAgo: 2880,
  },
  {
    slug: "bea-lindqvist",
    displayName: "Bea",
    age: 30,
    gender: "female",
    region: "eu",
    timezone: "Europe/London",
    bio: "Survival crafting is basically my meditation practice. Valheim base currently has a moat. Looking for someone patient enough to help me finish the roof.",
    discordUsername: "bea.lindqvist",
    games: [
      { name: "Valheim", skill: "intermediate" },
      { name: "Sons of the Forest", skill: "intermediate" },
      { name: "Raft", skill: "casual" },
      { name: "Rust", skill: "competitive" },
    ],
    shows: ["The Office", "Community"],
    platforms: ["pc"],
    playstyles: ["chill", "casual_coop", "weekend_warrior"],
    prompts: [
      { q: "My ideal co-op session involves", a: "A half-built base, a thunderstorm rolling in, and someone forgetting to save." },
      { q: "My backlog of shame includes", a: "Three survival games I abandoned right after building the first wall." },
      { q: "I geek out on", a: "Base-building efficiency. Ask me how I organized my Valheim storage room." },
    ],
    vibe: { intensity: 40, commsStyle: 50, coachingPref: 35, tiltHandling: "stays_calm" },
    playWindow: [18, 21],
    avatar: "avatar-11-orbit-rings.png",
    lastActiveMinutesAgo: 240,
  },
  {
    slug: "remy-castillo",
    displayName: "Remy",
    age: 27,
    gender: "male",
    region: "sa",
    timezone: "America/Sao_Paulo",
    bio: "Tac-shooter squad leader. I'll call the rotation, you just need to hold the angle. Rainbow Six and Warzone most nights after work.",
    discordUsername: "remy.castillo",
    games: [
      { name: "Call of Duty: Warzone", skill: "competitive" },
      { name: "Rainbow Six Siege", skill: "ranked_grinder", rank: "Diamond" },
      { name: "Counter-Strike 2", skill: "intermediate" },
      { name: "Escape from Tarkov", skill: "competitive" },
    ],
    shows: ["Invincible", "The Mandalorian"],
    platforms: ["pc", "playstation"],
    playstyles: ["team_player", "mic_required", "competitive"],
    prompts: [
      { q: "My go-to strategy in any game is", a: "Call the rotation before it's obvious. Info wins more than aim does." },
      { q: "I get weirdly competitive about", a: "Site executes. I will run the same one ten times until it's clean." },
      { q: "My ideal squad has", a: "One shot-caller, one entry, and nobody who mutes comms mid-round." },
    ],
    vibe: { intensity: 75, commsStyle: 78, coachingPref: 55, tiltHandling: "tilts_but_recovers_fast" },
    playWindow: [20, 0],
    avatar: "avatar-12-spectrum-radial.png",
    lastActiveMinutesAgo: 420,
  },
  {
    slug: "ophelia-marsh",
    displayName: "Ophelia",
    age: 35,
    gender: "female",
    region: "na_west",
    timezone: "America/Denver",
    bio: "Roguelite and deckbuilder obsessive. I will absolutely talk your ear off about run strategy in Slay the Spire or Hades II if you let me.",
    discordUsername: "ophelia.marsh",
    games: [
      { name: "Slay the Spire", skill: "ranked_grinder" },
      { name: "Hades II", skill: "competitive" },
      { name: "Balatro", skill: "intermediate" },
      { name: "Path of Exile 2", skill: "casual" },
    ],
    shows: ["Community", "Rick and Morty"],
    platforms: ["pc", "switch"],
    playstyles: ["solo_queue", "chill", "no_mic"],
    prompts: [
      { q: "My most controversial gaming opinion is", a: "Roguelites are better solo. Co-op just means two people arguing over relics." },
      { q: "The genre I always come back to is", a: "Deckbuilders. Give me a run-based game and a spreadsheet and I'm gone for hours." },
      { q: "I main", a: "Whatever character punishes greedy play. Currently it's the Hades II witch." },
    ],
    vibe: { intensity: 35, commsStyle: 25, coachingPref: 45, tiltHandling: "stays_calm" },
    playWindow: [20, 23],
    avatar: "avatar-13-crosshair-dpad.png",
    lastActiveMinutesAgo: 900,
  },
  {
    slug: "devon-price",
    displayName: "Devon",
    age: 32,
    gender: "male",
    region: "na_east",
    timezone: "America/New_York",
    bio: "Factory optimization is a personality trait at this point. Satisfactory and Factorio enjoyer. If you like spreadsheets and conveyor belts, we'll get along.",
    discordUsername: "devon.price",
    games: [
      { name: "Satisfactory", skill: "ranked_grinder" },
      { name: "Factorio", skill: "competitive" },
      { name: "Cities: Skylines II", skill: "intermediate" },
      { name: "No Man's Sky", skill: "casual" },
    ],
    shows: ["The Office", "Parks and Recreation"],
    platforms: ["pc"],
    playstyles: ["solo_queue", "chill", "weekend_warrior"],
    prompts: [
      { q: "My setup includes", a: "Way too many browser tabs open to a factory planner, if I'm honest." },
      { q: "The role I always end up playing is", a: "The one optimizing throughput while everyone else just wants to build." },
      { q: "A game I could talk about for hours", a: "Factorio. Send help, or better, send blueprints." },
    ],
    vibe: { intensity: 30, commsStyle: 20, coachingPref: 40, tiltHandling: "stays_calm" },
    playWindow: [19, 22],
    avatar: "avatar-14-node-graph.png",
    lastActiveMinutesAgo: 60,
  },
];

const MATCH_PARTNER_SLUG = "priya-ferra";
const ADMIRER_SLUGS = ["marcus-holt", "kofi-mensah", "bea-lindqvist"];

// The pre-built conversation: two people arranging to play together, spread over ~4 days,
// ending on an unread message from the demo partner so the Matches list shows its unread
// badge for the reviewer without them having to do anything first.
const CONVERSATION = [
  { sender: "partner", atMin: 5900, readAfterMin: 35, text: "Hey! Saw we're both grinding Valorant ranked, wanted to say hi. What rank are you sitting at right now?" },
  { sender: "reviewer", atMin: 5865, readAfterMin: 10, text: "Hey! Bouncing between Diamond and Immortal depending on the day. You?" },
  { sender: "partner", atMin: 5850, readAfterMin: 20, text: "Immortal 1, currently tilting off a 3-game losing streak lol. Want to duo queue sometime this week?" },
  { sender: "reviewer", atMin: 4200, readAfterMin: 15, text: "Yes, absolutely. I'm free most evenings after 7pm my time. Does that work?" },
  { sender: "partner", atMin: 4180, readAfterMin: 40, text: "Perfect, I'm usually on by 6. Let's aim for Thursday, I'll bring snacks and a controller cooldown." },
  { sender: "reviewer", atMin: 2900, readAfterMin: 5, text: "Thursday works. I'll queue up around 7 and send an invite." },
  { sender: "partner", atMin: 1400, readAfterMin: 120, text: "Bumping this. Still on for tonight? I've got the evening free and I'm dying to try that new agent." },
  { sender: "partner", atMin: 120, readAfterMin: null, text: "Hey, you around later tonight? Didn't want to double-book the slot if you're busy." },
];

// =============================================================================
// Auth-user + child-table helpers
// =============================================================================

async function getExistingUser(id) {
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error) {
    if (error.status === 404 || /not.*found/i.test(error.message ?? "")) return null;
    throw new Error(`getUserById failed for ${id}: ${error.message}`);
  }
  return data?.user ?? null;
}

async function ensureAuthUser(id, email, p, { resetPassword = false } = {}) {
  const existing = await getExistingUser(id);
  if (existing) {
    if (!resetPassword) return { created: false, password: null };
    const password = generatePassword();
    const { error } = await db.auth.admin.updateUserById(id, { password, email_confirm: true });
    if (error) throw new Error(`updateUserById failed for ${id}: ${error.message}`);
    return { created: false, password };
  }
  const password = generatePassword();
  // handle_new_user() (supabase/migrations/0056_reapply_null_dob_guard.sql) reads dob
  // straight out of raw_user_meta_data at INSERT time and raises if it's missing or under
  // 18 — the profiles row it creates is built from this metadata, not left for a later
  // UPDATE to fill in. timezone is read the same way (falls back to null if invalid).
  const { error } = await db.auth.admin.createUser({
    id,
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: p.displayName, dob: dobForAge(p.age), timezone: p.timezone },
  });
  if (error) throw new Error(`createUser failed for ${email}: ${error.message}`);
  return { created: true, password };
}

async function fetchIdMap(table, names) {
  const unique = [...new Set(names)];
  const { data, error } = await db.from(table).select("id, name").in("name", unique);
  if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
  const map = new Map((data ?? []).map((r) => [r.name, r.id]));
  for (const name of unique) {
    if (!map.has(name)) {
      throw new Error(`${table} catalog is missing "${name}" — check spelling against the live catalog.`);
    }
  }
  return map;
}

async function fetchPromptMap() {
  const { data, error } = await db.from("prompts").select("id, question");
  if (error) throw new Error(`Failed to load prompts: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.question, r.id]));
}

async function replaceRows(table, id, column, rows) {
  const { error: delErr } = await db.from(table).delete().eq(column, id);
  if (delErr) throw new Error(`${table} delete failed for ${id}: ${delErr.message}`);
  if (rows.length === 0) return;
  const { error: insErr } = await db.from(table).insert(rows);
  if (insErr) throw new Error(`${table} insert failed for ${id}: ${insErr.message}`);
}

async function ensureProfileCore(id, p) {
  const { error } = await db
    .from("profiles")
    .update({
      display_name: p.displayName,
      dob: dobForAge(p.age),
      gender: p.gender,
      region: p.region,
      timezone: p.timezone,
      bio: p.bio,
      discord_username: p.discordUsername ?? null,
      onboarding_completed: true,
      is_active: true,
      is_demo: true,
      last_active_at: minutesAgoIso(p.lastActiveMinutesAgo),
      usual_play_start_hour: p.playWindow[0],
      usual_play_end_hour: p.playWindow[1],
    })
    .eq("id", id);
  if (error) throw new Error(`profiles update failed for ${id}: ${error.message}`);
}

async function ensureVibe(id, vibe) {
  const { error } = await db
    .from("profile_vibe")
    .update({
      intensity: vibe.intensity,
      comms_style: vibe.commsStyle,
      coaching_pref: vibe.coachingPref,
      tilt_handling: vibe.tiltHandling,
    })
    .eq("profile_id", id);
  if (error) throw new Error(`profile_vibe update failed for ${id}: ${error.message}`);
}

async function uploadAvatarAndBuildMediaRows(id, avatarFile) {
  const buffer = readFileSync(path.join(AVATAR_DIR, avatarFile));
  const rows = [];
  for (const role of ["profile", "header"]) {
    const storagePath = `${id}/${role}.png`;
    const { error } = await db.storage.from("profile-photos").upload(storagePath, buffer, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw new Error(`storage upload failed for ${storagePath}: ${error.message}`);
    rows.push({
      profile_id: id,
      storage_path: storagePath,
      photo_role: role,
      position: null,
      moderation_status: "approved",
    });
  }
  return rows;
}

async function seedPersonaTree(id, p, { gameIdByName, showIdByName, promptIdByQuestion }) {
  await ensureProfileCore(id, p);

  await replaceRows(
    "profile_platforms",
    id,
    "profile_id",
    p.platforms.map((platform) => ({ profile_id: id, platform })),
  );
  await replaceRows(
    "profile_playstyles",
    id,
    "profile_id",
    p.playstyles.map((tag) => ({ profile_id: id, tag })),
  );
  await replaceRows(
    "profile_languages",
    id,
    "profile_id",
    [{ profile_id: id, language_code: "en" }],
  );
  await replaceRows(
    "profile_games",
    id,
    "profile_id",
    p.games.map((g, i) => ({
      profile_id: id,
      game_id: gameIdByName.get(g.name),
      skill_level: g.skill,
      rank_text: g.rank ?? null,
      priority: i,
    })),
  );
  await replaceRows(
    "profile_shows",
    id,
    "profile_id",
    p.shows.map((name, i) => ({ profile_id: id, show_id: showIdByName.get(name), priority: i })),
  );
  await replaceRows(
    "profile_prompts",
    id,
    "profile_id",
    p.prompts.map((pr, i) => ({
      profile_id: id,
      prompt_id: promptIdByQuestion.get(pr.q),
      answer: pr.a,
      position: i,
    })),
  );
  await replaceRows("profile_media", id, "profile_id", await uploadAvatarAndBuildMediaRows(id, p.avatar));
  await ensureVibe(id, p.vibe);
}

async function ensureSwipe(swiperId, targetId, action, createdAtIso) {
  const { error } = await db
    .from("swipes")
    .upsert(
      { swiper_id: swiperId, target_id: targetId, action, created_at: createdAtIso },
      { onConflict: "swiper_id,target_id" },
    );
  if (error) throw new Error(`swipe upsert failed (${swiperId} -> ${targetId}): ${error.message}`);
}

async function ensureMatchAndConversation(reviewId, partnerId) {
  const userA = reviewId < partnerId ? reviewId : partnerId;
  const userB = reviewId < partnerId ? partnerId : reviewId;
  const matchedAtIso = minutesAgoIso(8640); // 6 days ago, before the first message

  const { data: matchRow, error: matchErr } = await db
    .from("matches")
    .upsert(
      { user_a_id: userA, user_b_id: userB, matched_at: matchedAtIso, unmatched_at: null, unmatched_by: null },
      { onConflict: "user_a_id,user_b_id" },
    )
    .select("id")
    .single();
  if (matchErr) throw new Error(`match upsert failed: ${matchErr.message}`);
  const matchId = matchRow.id;

  const { error: delMsgErr } = await db.from("messages").delete().eq("match_id", matchId);
  if (delMsgErr) throw new Error(`messages delete failed for match ${matchId}: ${delMsgErr.message}`);

  const rows = CONVERSATION.map((m) => {
    const createdAt = minutesAgoIso(m.atMin);
    return {
      match_id: matchId,
      sender_id: m.sender === "reviewer" ? reviewId : partnerId,
      content: m.text,
      read_at: m.readAfterMin == null ? null : afterMinutesIso(createdAt, m.readAfterMin),
      created_at: createdAt,
    };
  });
  const { error: insMsgErr } = await db.from("messages").insert(rows);
  if (insMsgErr) throw new Error(`messages insert failed for match ${matchId}: ${insMsgErr.message}`);

  // Mutual 'like' swipes backing the match, same as perform_swipe() would have produced —
  // without these the matched partner would still show up in the reviewer's own deck.
  await ensureSwipe(reviewId, partnerId, "like", minutesAgoIso(5900));
  await ensureSwipe(partnerId, reviewId, "like", minutesAgoIso(5901));

  return matchId;
}

// =============================================================================
// Removal
// =============================================================================

async function removeAll() {
  const allIds = [REVIEW_ID, ...PERSONAS.map((p) => demoId(`profile:${p.slug}`))];
  console.log(`Removing ${allIds.length} demo/review accounts and everything that hangs off them...`);

  const storagePaths = allIds.flatMap((id) => [`${id}/profile.png`, `${id}/header.png`]);
  const { data: rmData, error: rmErr } = await db.storage.from("profile-photos").remove(storagePaths);
  if (rmErr) {
    console.warn(`storage removal warning: ${rmErr.message}`);
  } else {
    console.log(`storage: removed ${rmData?.length ?? 0} object(s) (of ${storagePaths.length} paths attempted)`);
  }

  let deleted = 0;
  let missing = 0;
  for (const id of allIds) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) {
      if (error.status === 404 || /not.*found/i.test(error.message ?? "")) {
        missing++;
        continue;
      }
      throw new Error(`deleteUser failed for ${id}: ${error.message}`);
    }
    deleted++;
  }
  console.log(`auth users: deleted ${deleted}, already absent ${missing} (profiles and everything referencing them cascade from each auth-user delete)`);

  const { count, error: countErr } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_demo", true);
  if (countErr) throw new Error(`post-removal count failed: ${countErr.message}`);
  console.log(`profiles remaining with is_demo = true: ${count}`);
  if (count && count > 0) {
    console.warn("WARNING: demo rows still present after removal — investigate before relying on this being clean.");
    process.exitCode = 1;
  } else {
    console.log("Clean — no demo data remains.");
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--remove")) {
    await removeAll();
    return;
  }
  const resetPassword = args.includes("--reset-password");

  console.log("Loading games/shows/prompts catalog...");
  const allGameNames = [...REVIEWER.games, ...PERSONAS.flatMap((p) => p.games)].map((g) => g.name);
  const allShowNames = [...REVIEWER.shows, ...PERSONAS.flatMap((p) => p.shows)];
  const [gameIdByName, showIdByName, promptIdByQuestion] = await Promise.all([
    fetchIdMap("games", allGameNames),
    fetchIdMap("shows", allShowNames),
    fetchPromptMap(),
  ]);
  for (const p of [REVIEWER, ...PERSONAS]) {
    for (const pr of p.prompts) {
      if (!promptIdByQuestion.has(pr.q)) {
        throw new Error(`prompts catalog is missing question "${pr.q}" for ${p.displayName ?? p.slug}`);
      }
    }
  }

  console.log(`Ensuring review account (${REVIEW_EMAIL})...`);
  const reviewResult = await ensureAuthUser(REVIEW_ID, REVIEW_EMAIL, REVIEWER, { resetPassword });
  await seedPersonaTree(REVIEW_ID, REVIEWER, { gameIdByName, showIdByName, promptIdByQuestion });

  const personaIds = new Map();
  for (const p of PERSONAS) {
    const id = demoId(`profile:${p.slug}`);
    personaIds.set(p.slug, id);
    console.log(`Ensuring demo profile: ${p.displayName} (${p.slug})...`);
    await ensureAuthUser(id, `duoqueue.demo.${p.slug}@duoqueue.io`, p, { resetPassword: false });
    await seedPersonaTree(id, p, { gameIdByName, showIdByName, promptIdByQuestion });
  }

  console.log("Building the pre-seeded match + conversation...");
  const partnerId = personaIds.get(MATCH_PARTNER_SLUG);
  const matchId = await ensureMatchAndConversation(REVIEW_ID, partnerId);
  console.log(`  match ${matchId} with ${PERSONAS.find((p) => p.slug === MATCH_PARTNER_SLUG).displayName}, ${CONVERSATION.length} messages, last one unread`);

  console.log("Seeding inbound interest (Who wants to duo)...");
  const admirerCreatedAtByMin = { "marcus-holt": 180, "kofi-mensah": 1440, "bea-lindqvist": 360 };
  for (const slug of ADMIRER_SLUGS) {
    const id = personaIds.get(slug);
    await ensureSwipe(id, REVIEW_ID, "like", minutesAgoIso(admirerCreatedAtByMin[slug]));
    console.log(`  ${PERSONAS.find((p) => p.slug === slug).displayName} liked the review account`);
  }

  console.log("");
  console.log("=".repeat(72));
  console.log("Done. Summary:");
  console.log(`  review account:      1  (${REVIEW_EMAIL})`);
  console.log(`  demo profiles:       ${PERSONAS.length}`);
  console.log(`  pre-built match:     1  (with ${personaIds.size ? PERSONAS.find((p) => p.slug === MATCH_PARTNER_SLUG).displayName : ""}, ${CONVERSATION.length} messages, last one unread)`);
  console.log(`  inbound admirers:    ${ADMIRER_SLUGS.length}`);
  console.log("");
  console.log("Review account credentials (App Store Connect -> App Review Information):");
  console.log(`  Email:    ${REVIEW_EMAIL}`);
  if (reviewResult.password) {
    console.log(`  Password: ${reviewResult.password}`);
    console.log("");
    console.log("  This password was just (re)generated — copy it into docs/APP-STORE-SUBMISSION.md now.");
  } else {
    console.log("  Password: unchanged — already set on a previous run. See docs/APP-STORE-SUBMISSION.md,");
    console.log("            or re-run with --reset-password to rotate it (then update the doc).");
  }
  console.log("=".repeat(72));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
