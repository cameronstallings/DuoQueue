import { formatClock } from "../match/matchMoment";

import type { PopOutcome } from "./queueState";

/**
 * Every word Queue Up says: the header pill's sheet, the Duo Pop card, the Duo Pops opt-in card,
 * the empty deck, Online Now and the ended Duo Call line. One module so a single test sweeps all
 * of it (queueCopy.test.ts): no em or en dashes, always "moments", nothing that reads as dating
 * (DuoQueue is 18+ and for teammates, and was rejected once under 2.3.6), never "Accept" or
 * "Lock In" (a Duo Pop is answered with "I'm in" and "Not now"), and only honest counts: a line
 * says how many players were told only when the server told them. The Settings row for Duo Pops
 * lives with the other rows in notificationCategories.ts.
 *
 * Strings stay sentence case; uppercase comes only from the type styles (the pill's chipText,
 * ticks), never from the text.
 */

/** "{n} min" inside a sentence; the pill has its own shorter "42m". */
function minutes(n: number): string {
  return `${n} min`;
}

export const QUEUE_COPY = {
  titleIdle: "Queue up",
  titleQueued: "You're queued",
  titleLocked: "Duo locked",
  gameSection: "Game",
  pingLabel: "Ping players",
  pingHint: "Send a Duo Pop to up to 6 players in this game. The first to tap I'm in is your duo.",
  matchesSeeYou: "Your matches see that you're free for the next hour.",
  queueUp: "Queue up",
  outsideNa: "Duo Pops reach players in North America for now. You can still share your LFG post.",
  noGames: "Add a game to your profile to queue up.",
  /** The games read failed (offline): a player with games is never told to add one. */
  gamesLoadFailed: "Couldn't load your games.",
  editDetails: "Edit details",
  share: "Share my LFG post",
  copy: "Copy post",
  copied: "Post copied",
  adultsOnly:
    "DuoQueue is 18+ and it is for finding teammates, not dates. Only share your post where adults look for teammates. Your code stops working when you stop queueing.",
  permissionPrompt: "Turn on notifications to hear the moment someone's in.",
  turnOn: "Turn on",
  seeWhosOn: "See who's on now",
  stop: "Stop queueing",
  stopped: "You're not queued anymore.",
  /** Queued by the profile's flag with no live queue-up behind it (0085 not live yet, or a 1.0.1
   * phone's free-to-duo switch): the one thing that is true is that matches can see it. */
  queuedFree: "Your matches can see you're free.",
  sendMessage: "Send a message",
  startFailed: "Couldn't queue you up. Please try again.",
  rateLimited: "You've queued up a lot in the last hour. Try again a little later.",
  banned: "This account cannot do that right now.",
  notReady: "Queue Up isn't ready yet. Please try again later.",
  stopFailed: "Couldn't stop queueing. Please try again.",
  loadFailed: "Couldn't load your queue.",
  tryAgain: "Try again",
} as const;

/**
 * The sheet's result line once queued: how many players heard (only a count the server
 * returned), that nobody answered in the 10 minutes, or the server's reason none were pinged.
 * Every "none" line still says the player is queued and visible, because they are: start_queue_up
 * sets them free to duo for the hour whatever happens to the pops.
 */
export function outcomeLine(
  outcome: PopOutcome,
  facts: { notified: number; gameName: string | null; minutesLeft: number },
): string {
  switch (outcome) {
    case "popping":
      // Never "We let 0 players know": a pop with nobody in it is the no-players case.
      if (facts.notified <= 0) return outcomeLine("no_players", facts);
      return facts.notified === 1 ? "We let 1 player know." : `We let ${facts.notified} players know.`;
    case "no_answer":
      return `Nobody grabbed it this time. You're still queued for ${minutes(facts.minutesLeft)}.`;
    case "ping_off":
      return "You're queued quietly. Your matches can see you're free.";
    case "outside_na":
      return "Duo Pops reach players in North America for now. Your matches can see you're free.";
    case "daily_limit":
      return "You've sent 3 Duo Pops today. Your matches can still see you're free.";
    case "no_players":
      return `No one in ${facts.gameName ?? "your game"} could get a Duo Pop right now. Share your post so someone can find you.`;
    case "too_new":
      return "Duo Pops start working a day after you join. Your matches can see you're free.";
    case "unavailable":
      return "Duo Pops aren't available on this account right now. Your matches can see you're free.";
  }
}

/** "On until 10:40 PM." The time is formatted by the caller (Intl, in the phone's own clock). */
export function untilLine(time: string): string {
  return `On until ${time}.`;
}

/** The sheet once someone grabbed the sender's pop. */
export function lockedLine(name: string): string {
  return `${name} grabbed your Duo Pop.`;
}

/** The Pop card's sentence under the player. */
export function popSentence(name: string, game: string | null): string {
  const what = game ? `${game} now` : "now";
  return `${name} is queueing ${what}. The first player to tap I'm in gets the duo.`;
}

/** The Pop card when the sender stopped queueing before anyone was in. */
export function popEndedTitle(name: string): string {
  return `${name} stopped queueing`;
}

/** The Pop card reopened after this player already tapped I'm in. */
export function popLockedTitle(name: string): string {
  return `You're duo locked with ${name}`;
}

/** The countdown ring's m:ss ("9:41"). */
export function ringClock(seconds: number): string {
  return formatClock(seconds);
}

export const POP_COPY = {
  imIn: "I'm in",
  notNow: "Not now",
  report: "Report",
  block: "Block",
  canDuoChip: "Can duo (by rank)",
  loadFailed: "Couldn't load this Duo Pop.",
  tryAgain: "Try again",
  answerFailed: "Couldn't answer this Duo Pop. Please try again.",
  sendMessage: "Send a message",
  queueUp: "Queue up",
  close: "Close",
  openChat: "Open chat",
  reportSubmittedTitle: "Report submitted",
  reportSubmittedBody: "Thanks. Our team will review this.",
  blockTitle: "Block this user?",
  blockBody: "They will be removed from your matches and deck.",
  blockConfirm: "Block",
  cancel: "Cancel",
  /** A report or block that failed (the app's usual pair). */
  failedTitle: "Something went wrong",
  failedBody: "Please try again.",
} as const;

/** "Duo Pops go fast", for a Pop someone else got to first and one that ran out. */
const GO_FAST = "Duo Pops go fast. Queue up and players in your game hear from you.";

/** What the Pop card says when it is over: a title, maybe a line, and its buttons. "ended" is
 * titled by name (popEndedTitle). */
export const POP_RESULT_COPY = {
  taken: { title: "Someone grabbed this one", body: GO_FAST },
  expired: { title: "This Duo Pop ended", body: GO_FAST },
  already_matched: { title: "You two are already matched" },
  unavailable: { title: "This Duo Pop isn't available anymore" },
} as const;

export const DUO_POPS_OPT_IN_COPY = {
  title: "Get Duo Pops?",
  body: "When someone who plays your game queues up, your phone pops. The first to tap I'm in gets the duo. Up to 3 a day, never between 1 am and 10 am.",
  primary: "Turn on Duo Pops",
  secondary: "Not now",
  on: "Duo Pops are on.",
  needsSettings: "Duo Pops are on. Turn on notifications for DuoQueue in Settings to get them.",
  failed: "Couldn't turn on Duo Pops. You can try again in Settings.",
} as const;

export const EMPTY_DECK_COPY = {
  tick: "YOU ARE EARLY",
  title: "You are early",
  /** The ping sentence only when the empty deck knows notifications can reach them. */
  subtitle: (canPing: boolean): string =>
    "There is nobody new in your deck right now. Queue up to let players in your game know you're on, or bring somebody you already play with." +
    (canPing ? " We will ping you when a player who shares your games joins." : ""),
  invite: "Invite your duo",
  refresh: "Refresh",
} as const;

export const ONLINE_NOW_COPY = {
  queuedTitle: (game: string | null): string => (game ? `Queued for ${game}` : "You're queued"),
  stop: "Stop",
  idleTitle: "You're not queued",
  idleBody: "Queue up so players in your game can find you.",
  queueUp: "Queue up",
  emptyTitle: "No one's on right now",
  emptyBody: "Queue up so players in your game can find you, or share your LFG post to bring someone in.",
  emptyTick: "NONE ONLINE",
  loadFailed: "Couldn't load who's online.",
  tryAgain: "Try again",
  duo: "Duo",
  duoFailedTitle: "Something went wrong",
  duoFailedBody: "Please try again.",
} as const;

/** The front door's invite field, for a Duo Call code whose queue-up is over. */
export const CALL_ENDED_COPY = "That Duo Call has ended. You can still set up your card and find players here.";

/**
 * A Queue Up RPC's failure as a sentence. Never the raw message: the rate limit raises a machine
 * token (`rate_limit_exceeded:queue_up`), and PostgREST and Postgres put their own words on
 * errors this app never anticipated. In order:
 *  - the shared rate limit, recognised by its token;
 *  - a banned account (`account_banned`, raised before anything else);
 *  - a plpgsql RAISE with a hint, which is a sentence the server wrote for people
 *    ("Pick one of the games on your profile.");
 *  - PGRST202, no such function: 0085 is not live yet, so Queue Up says it is not ready;
 *  - anything else, a dropped connection included: the caller's fallback.
 */
export function queueErrorMessage(err: unknown, fallback: string): string {
  const fields =
    err && typeof err === "object" ? (err as { code?: unknown; message?: unknown; hint?: unknown }) : {};
  const code = typeof fields.code === "string" ? fields.code : undefined;
  const message = typeof fields.message === "string" ? fields.message : "";
  const hint = typeof fields.hint === "string" ? fields.hint.trim() : "";

  if (message.includes("rate_limit_exceeded")) return QUEUE_COPY.rateLimited;
  if (message.trim() === "account_banned") return QUEUE_COPY.banned;
  if (code === "P0001" && hint) return hint;
  if (code === "PGRST202") return QUEUE_COPY.notReady;
  return fallback;
}
