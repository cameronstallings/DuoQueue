import type { Hook } from "../types";

/**
 * The queue. One object per video, appended to; nothing else is needed to add a post.
 *
 * Order inside a format is posting priority, because the selector takes the lowest-index
 * unrendered hook of the format it is up to. The strongest hook of each format is first.
 *
 * House voice, all of it enforced by `pnpm validate` except the last:
 * - Lowercase. The app's own machine voice is uppercase mono in brackets; the hook lines are
 *   the human half and read as someone typing, not as advertising.
 * - The banned words (dating, romance, hookup, ...) may appear only inside a denial, in the
 *   same string as the denial. "no this isn't a dating app" is the strongest hook the spec
 *   has and has to stay sayable; "meet singles" must never be.
 * - ASCII apostrophes. A curly one is invisible in a diff and would render fine, but the
 *   captions file Cameron reads every morning is ASCII, so the whole content model is.
 * - Roughly 28 characters per rendered line. `fitText` shrinks anything longer rather than
 *   overflowing, so this is a taste budget and validate only warns.
 * - Claims are checkable. Every line in the `spec` list below is backed by the privacy policy
 *   or the shipping app, because a marketing claim this app cannot support is a support
 *   ticket at best and an App Review problem at worst.
 */
export const hooks: Hook[] = [
  // ---- reframe: the surprise is the engagement driver. Spec section 2, format 1. ----
  { id: "reframe-001", format: "reframe", seconds: 9, clip: "deck-dark",
    beatOne: "no this isn't a dating app",
    beatTwo: "it's for finding people to actually play with",
    caption: "swiping, but for your next duo" },

  { id: "reframe-002", format: "reframe", seconds: 8, clip: "deck-cards",
    beatOne: "you swipe on playstyles",
    beatTwo: "not on faces",
    caption: "the deck is built from what you play, not how you look" },

  { id: "reframe-003", format: "reframe", seconds: 8, clip: "duo-locked",
    beatOne: "everyone assumes wrong",
    beatTwo: "this is not a dating app",
    caption: "the assumption is the hook, the correction is the point" },

  // Shorter than its siblings because its clip is. The light half of the recording is thin
  // (see public/footage/README.md), and a reframe that outruns its footage plays the last
  // seconds over an empty frame. Lengthen this only after re-recording in Paper.
  { id: "reframe-004", format: "reframe", seconds: 7, clip: "deck-light",
    beatOne: "there are no gender filters",
    beatTwo: "because this is not dating",
    caption: "you filter on games and hours, not on people" },

  { id: "reframe-005", format: "reframe", seconds: 8, clip: "own-profile",
    beatOne: "your profile is your setup",
    beatTwo: "games, hours, mic, vibe",
    caption: "what you play, when you play, and how you like to play it" },

  // 6s for the same reason as reframe-004, and this is the floor validate allows.
  { id: "reframe-006", format: "reframe", seconds: 6, clip: "matches-light",
    beatOne: "everyone here wants a duo",
    beatTwo: "that is the whole filter",
    caption: "one thing in common, guaranteed" },

  { id: "reframe-007", format: "reframe", seconds: 6, clip: "chat-priya",
    beatOne: "the first message is easy",
    beatTwo: "when are you on tonight",
    caption: "no opener required, just a schedule" },

  // ---- pain: name the feeling, no product knowledge required. Spec section 2, format 2. ----
  { id: "pain-001", format: "pain", seconds: 8, clip: "broll-quiet",
    lines: ["your duo quit the game", "3 months ago", "you still queue alone"],
    caption: "solo queue is a choice you stopped making on purpose" },

  { id: "pain-002", format: "pain", seconds: 8, clip: "broll-quiet",
    lines: ["you posted in lfg", "nobody replied", "you queued solo anyway"],
    caption: "lfg posts are a coin flip and the coin keeps landing wrong" },

  { id: "pain-003", format: "pain", seconds: 7, clip: "broll-teamfight",
    lines: ["no mic", "no plan", "no chance"],
    caption: "randoms again tonight" },

  { id: "pain-004", format: "pain", seconds: 7, clip: "broll-quiet",
    lines: ["40 friends online", "none of them play this"],
    caption: "the friends list is full and the party is empty" },

  { id: "pain-005", format: "pain", seconds: 7, clip: "broll-loss",
    lines: ["four losses in a row", "nobody said a word"],
    caption: "silence is the worst part of a losing streak" },

  { id: "pain-006", format: "pain", seconds: 9, clip: "broll-loss",
    lines: ["you play better", "when someone is talking", "so you play less"],
    caption: "playing well is a team sport even in solo queue" },

  { id: "pain-007", format: "pain", seconds: 8, clip: "broll-quiet",
    lines: ["still installed", "for a duo who left", "in march"],
    caption: "you kept the game for someone who stopped showing up" },

  // ---- spec: pure interface, no footage. Cheap, infinitely variable. Format 4. ----
  { id: "spec-001", format: "spec", seconds: 11, title: "what this is",
    items: ["match on games, not looks", "18+ only", "no gender filters", "platonic, not dating"],
    caption: "the whole pitch in four lines" },

  { id: "spec-002", format: "spec", seconds: 11, title: "how it works",
    items: ["build a profile from games", "swipe the deck", "match, then chat", "queue up tonight"],
    caption: "four steps and none of them are a personality quiz" },

  // Every line here is quoted from site/privacy/index.html sections 2, 3 and 6.
  { id: "spec-003", format: "spec", seconds: 11, title: "what we do not do",
    items: ["no ads", "no analytics sdk", "no gps tracking", "we do not sell your data"],
    caption: "the privacy label is clean on purpose" },

  { id: "spec-004", format: "spec", seconds: 11, title: "the rules",
    items: ["18 and over only", "every photo is moderated", "report and block anywhere", "no under 18, no exceptions"],
    caption: "18+ and moderated, both enforced" },

  // The tags are PLAYSTYLE_LABELS from apps/mobile/src/features/onboarding/profile-labels.ts.
  { id: "spec-005", format: "spec", seconds: 10, title: "who it is for",
    items: ["chill", "competitive", "late night", "weekend warrior"],
    caption: "the playstyle tags do the matching, they are not decoration" },

  { id: "spec-006", format: "spec", seconds: 11, title: "what it costs",
    items: ["matching is free", "chat is free", "duoqueue+ is optional", "no ads anywhere"],
    caption: "free to use, and the paid tier is a shortcut not a gate" },

  { id: "spec-007", format: "spec", seconds: 11, title: "what you fill in",
    items: ["the games you play", "the hours you play", "your platforms and rank", "how you handle tilt"],
    caption: "the profile is a setup sheet, not a highlight reel" },

  // ---- demo: lowest reach, highest intent, so the cycle serves it once per four. Format 3. ----
  // Steps never cross the dark/light boundary in the recording. See clips.ts.
  { id: "demo-001", format: "demo", seconds: 15,
    steps: [{ clip: "deck-dark", label: "01 / DECK" }, { clip: "match-kofi", label: "02 / MATCH" },
            { clip: "chat-typing", label: "03 / CHAT" }],
    caption: "fifteen seconds of the whole thing" },

  { id: "demo-002", format: "demo", seconds: 14,
    steps: [{ clip: "deck-cards", label: "01 / CARD" }, { clip: "duo-locked", label: "02 / DUO LOCKED" },
            { clip: "own-profile", label: "03 / PROFILE" }],
    caption: "a full card, a locked duo, and the profile behind it" },

  { id: "demo-003", format: "demo", seconds: 15,
    steps: [{ clip: "deck-light", label: "01 / DECK" }, { clip: "matches-light", label: "02 / MATCHES" },
            { clip: "chat-priya", label: "03 / CHAT" }],
    caption: "the same app in paper, for anyone who cannot stand dark mode" },
];
