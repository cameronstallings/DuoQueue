// The words of the two Queue Up pushes (DuoQueue 1.0.2, migration 0085): the Duo Pop a recipient
// gets, and "Duo locked" the sender gets when someone taps I'm in. Pure (no Deno globals, no
// npm: imports), so apps/mobile's vitest runs duoPopCopy.test.ts the way it runs
// superPingCopy.test.ts.
//
// THE DUO POP NAMES NOBODY. It goes to a stranger's lock screen, so it carries the game, the
// sender's rank text and whether Riot's duo table lets the two of them queue together, and never
// a name, an age or a photo. The Pop card behind it shows the name and age once the recipient
// opens it (get_duo_pop re-checks blocks and reports first).
//
// Cameron's standing rules for every user-visible string: no em or en dashes, never "beats",
// nothing that reads as dating, League of Legends as plain text, and the Duo Pop words are
// "Duo Pop", "I'm in" and "Not now" (never "Accept" or "Lock In"). The bodies are Group Q's copy
// in docs/superpowers/plans/2026-10-15-build-19.md, word for word.

import type { PushCopy } from "./superPingCopy.ts";

export const DUO_POP_TITLE = "Duo Pop";
export const DUO_LOCKED_TITLE = "Duo locked";

/** The rank text a push may quote. Longer than this reads as a sentence, not a rank, and is
 * dropped (the same bound as the LFG post's rank line, Group Q's lfgRankParts). */
export const RANK_TEXT_MAX = 24;

const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);
const DASHES = new RegExp(`[${EN_DASH}${EM_DASH}]`, "g");
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

/** Text a player typed (rank text, a custom game's name) made safe for one line of a push:
 * control characters become spaces, an en or em dash becomes a hyphen, whitespace collapses. */
function oneLine(raw: string): string {
  return raw.replace(CONTROL_CHARS, " ").replace(DASHES, "-").replace(/\s+/g, " ").trim();
}

/**
 * The sender's rank for this game as the push may show it, or null to leave rank out: not a
 * string, blank, "Unranked" (not a rank to queue against), or over 24 characters. League rows
 * hold the canonical label ("Gold II", 0069); other games hold whatever the player typed.
 */
export function sanitizeRankText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = oneLine(raw);
  if (!text || text.length > RANK_TEXT_MAX) return null;
  if (/^unranked$/i.test(text)) return null;
  return text;
}

/** "A" or "An" for the word that follows. By its first letter, which covers every catalog
 * title and League tier ("An Emerald II", "An Apex Legends player"); it cannot hear "an NBA". */
function article(next: string): "A" | "An" {
  return /^[aeiou]/i.test(next) ? "An" : "A";
}

/** Which of the three rank-less bodies a pop gets: the first 8 hex digits of its id, mod 3. The
 * same pop always reads the same, so a retried push never changes its words. */
export function duoPopVariant(popId: string): number {
  const n = Number.parseInt(String(popId).slice(0, 8), 16);
  return Number.isFinite(n) ? n % 3 : 0;
}

export interface DuoPopCopyInput {
  gameName: string;
  rankText: string | null | undefined;
  /** Riot's duo table says these two can queue together (League only, queue_ups.can_duo). */
  canDuo: boolean;
  /** duoPopVariant(popId). */
  variant: number;
}

/**
 * The push a Duo Pop recipient gets. With a rank: the can-duo line when, and only when, Riot's
 * table says the two can duo, else the plain rank line. Without one: one of three, by variant.
 */
export function duoPopPush({ gameName, rankText, canDuo, variant }: DuoPopCopyInput): PushCopy {
  const game = oneLine(gameName) || "your game";
  const rank = sanitizeRankText(rankText);
  if (rank && canDuo) {
    return { title: DUO_POP_TITLE, body: `${article(rank)} ${rank} player who can duo with you (by rank) is queueing ${game} now.` };
  }
  if (rank) {
    return { title: DUO_POP_TITLE, body: `${article(rank)} ${rank} ${game} player is queueing now. First to tap I'm in gets the duo.` };
  }
  const v = Number.isInteger(variant) ? ((variant % 3) + 3) % 3 : 0;
  if (v === 1) return { title: DUO_POP_TITLE, body: `Someone in ${game} wants a duo right now.` };
  if (v === 2) return { title: DUO_POP_TITLE, body: `${article(game)} ${game} player just queued up. Want in?` };
  return { title: DUO_POP_TITLE, body: `${article(game)} ${game} player is queueing now. First to tap I'm in gets the duo.` };
}

/** The 10-minute window a pop can be answered in, and so its push's ttl (0085). */
export const DUO_POP_SECONDS = 600;

/** Seconds from the tap that queued to the tap that locked, as get_my_queue_up computes it:
 * ceil, clamped to 1..600. Null when either time does not parse (then it is not treated as a
 * pop at all, and the match gets its ordinary pushes). */
export function poppedInSeconds(createdAt: string | null | undefined, lockedAt: string | null | undefined): number | null {
  const created = Date.parse(String(createdAt ?? ""));
  const locked = Date.parse(String(lockedAt ?? ""));
  if (!Number.isFinite(created) || !Number.isFinite(locked)) return null;
  return Math.min(DUO_POP_SECONDS, Math.max(1, Math.ceil((locked - created) / 1000)));
}

/** "0:41", "9:41", "10:00". Whole seconds, clamped to 1..600 like the server's value. */
export function formatPoppedIn(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.min(DUO_POP_SECONDS, Math.max(1, Math.round(seconds))) : 1;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** To the SENDER when someone taps I'm in on their pop. Nothing goes to the player who tapped:
 * their Pop card plays the moment in place. */
export function duoLockedPush(lockerName: string | null | undefined, seconds: number): PushCopy {
  const name = oneLine(String(lockerName ?? "")) || "Someone";
  return { title: DUO_LOCKED_TITLE, body: `${name} grabbed your Duo Pop. Popped in ${formatPoppedIn(seconds)}.` };
}
