/**
 * Words the party screens show, decided without React or Supabase so they can be tested: how a
 * list of names reads, what a refused invite says, and every word of the party LFG post.
 */

import { isPartyLfgUnavailable } from "./partyCall";

/** "Sam", "Sam & Alex", "Sam, Alex & Jo". Empty for no names. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 2) return names.join(" & ");
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export const INVITE_EXPIRED_MESSAGE = "This invite expired. Party invites stay open for 7 days.";
export const PARTY_FULL_MESSAGE = "This party already has three people, so there is no room left.";
export const INVITE_CLOSED_MESSAGE = "This invite is no longer open.";
export const TOO_MANY_TRIES_MESSAGE = "Too many tries. Wait a few minutes and try again.";
export const INVITE_FALLBACK_MESSAGE = "Something went wrong. Check your connection and try again.";

/**
 * Why `respond_party_invite` refused, as a sentence.
 *
 * The error arrives as PostgREST's plain object (`{ code, message, hint }`), not an Error, so
 * `err instanceof Error` (what this banner used to check) failed for every refusal the server
 * made and the user read a generic line instead of the reason.
 *
 * In order:
 *  - A P0001 (a plpgsql RAISE, so a sentence this codebase wrote) with a `hint` shows the hint,
 *    the convention `toUserMessage` in src/lib/userMessage.ts set for the same reason.
 *  - Otherwise the refusals this screen can actually meet are recognised by what they say:
 *    expired and full (0070's two new ones, by message or detail), an invite already answered or swept away
 *    ("No pending invite"), and the shared rate limit (`rate_limit_exceeded:<bucket>`). Machine
 *    tokens never reach the screen as they are.
 *  - Anything else, a dropped connection included, gets the fallback.
 */
export function partyInviteErrorMessage(err: unknown): string {
  const fields =
    err && typeof err === "object"
      ? (err as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown })
      : {};
  const code = typeof fields.code === "string" ? fields.code : undefined;
  const message = typeof fields.message === "string" ? fields.message : "";
  const details = typeof fields.details === "string" ? fields.details : "";
  const hint = typeof fields.hint === "string" ? fields.hint.trim() : "";

  if (code === "P0001" && hint) return hint;

  // 0070 raises its two with a sentence in `message` and a token in `details`
  // (`party_invite_expired`, `party_full`); either one is enough to recognise them.
  const said = `${message} ${details} ${hint}`.toLowerCase();
  if (said.includes("expire")) return INVITE_EXPIRED_MESSAGE;
  // "full" as a word of its own, or a token's part ("party_full"), never inside "successfully".
  if (/(^|[^a-z])full([^a-z]|$)/.test(said)) return PARTY_FULL_MESSAGE;
  if (said.includes("no pending invite")) return INVITE_CLOSED_MESSAGE;
  if (said.includes("rate_limit_exceeded")) return TOO_MANY_TRIES_MESSAGE;
  return INVITE_FALLBACK_MESSAGE;
}

/**
 * THE PARTY LFG POST (0089). A party of two shares a plain-text post with a code; whoever joins
 * DuoQueue with it first takes the last seat. Every word below is swept by partyCopy.test.ts: no
 * dashes, no "beats", nothing that reads as dating, sentence case, and only what is true (the
 * code works for 2 hours plus 15 minutes for sign-ups in progress, and stops the moment someone
 * joins or a member stops it).
 */
export const PARTY_LFG_COPY = {
  share: "Share LFG post",
  shareAgain: "Share again",
  /** The member who did not start the post shares it under their own rank. */
  sharePost: "Share post",
  copy: "Copy post",
  copied: "Post copied",
  stop: "Stop post",
  stopped: "Post stopped. Its code no longer works.",
  startFailed: "Couldn't make your post. Please try again.",
  /** start_party_call's party_not_ready: not two, not a live match, or a member not active. */
  notReady: "Only two matched players with active accounts can post for a third.",
  rateLimited: "You've made a lot of posts in the last hour. Try again a little later.",
  /** The alert's title over 0089's partner_not_ready hint (partyLfgStartFailure). */
  partnerFirstTitle: "One more step",
  /** partner_not_ready without the hint that names them. */
  partnerFirst: "Ask your partner to open this party on the latest DuoQueue first. Then they can see your post and stop it.",
  banned: "This account cannot do that right now.",
  stopFailed: "Couldn't stop the post. Please try again.",
} as const;

/** "Your LFG post works until 11:40 PM." / "Sam's LFG post works until 11:40 PM." */
export function partyLiveLine(input: { mine: boolean; sharerName: string | null; time: string | null }): string {
  const whose = input.mine ? "Your" : input.sharerName ? `${input.sharerName}'s` : "Your party's";
  return input.time ? `${whose} LFG post works until ${input.time}.` : `${whose} LFG post is live.`;
}

/**
 * The sharer's explicit consent, asked before a post leaves the phone. The first post also writes
 * a note into the party chat from the sharer (0089), so the other member is told, not asked: the
 * body says so by name. The member who did not start the post is asked too before their first
 * share, because their post carries their own rank under the party's code.
 */
export function partyConsent(input: { time: string | null; otherName: string | null; firstPost: boolean }): {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
} {
  const whose = input.firstPost ? "your code" : "your party's code";
  const until = input.time ? `until ${input.time}` : "for 2 hours";
  const who = input.otherName ?? "Your partner";
  const sentences = [
    `Anyone who joins DuoQueue with ${whose} can take the last seat in this party.`,
    // preview_party_code shows every member's name and age to a player with the code before
    // they join (AGES STAY), so the sharer hears it before anything leaves the phone.
    "Players with the code can see both your names and ages.",
    `The code works ${until}, plus 15 minutes for anyone already signing up.`,
    input.firstPost ? `${who} will see a note in your party chat.` : "Your post shows your own rank.",
    "Only share it where adults look for teammates.",
  ];
  return { title: "Share a post to find a third?", body: sentences.join(" "), confirm: "Share post", cancel: "Not now" };
}

/** A PostgREST error's fields, as strings ("" when absent). */
function errorFields(err: unknown): { code: string; message: string; details: string; hint: string } {
  const fields =
    err && typeof err === "object"
      ? (err as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown })
      : {};
  return {
    code: typeof fields.code === "string" ? fields.code : "",
    message: typeof fields.message === "string" ? fields.message.trim() : "",
    details: typeof fields.details === "string" ? fields.details.trim() : "",
    hint: typeof fields.hint === "string" ? fields.hint.trim() : "",
  };
}

/**
 * A party post RPC's failure as a sentence (start_party_call, end_party_call). Never the raw
 * message. In order: the shared rate limit by its token; a banned account; a full party by 0070's
 * detail token, in the party screens' own words; start_party_call's party_not_ready (detail
 * party_not_ready: not two, not a live match, or a member not active) in this app's own words,
 * because the hint 0089 sends with it ("A party needs two players...") is false for a pair of two
 * who are not matched; any other RAISE with a hint (a sentence the server wrote for people, such
 * as partner_not_ready's "Ask {name} to open this party..."); party_not_ready by its message
 * alone; else the caller's fallback.
 */
export function partyLfgErrorMessage(err: unknown, fallback: string): string {
  const { code, message, details, hint } = errorFields(err);

  if (message.includes("rate_limit_exceeded")) return PARTY_LFG_COPY.rateLimited;
  if (message === "account_banned") return PARTY_LFG_COPY.banned;
  if (details === "party_full" || message === "party_full") return PARTY_FULL_MESSAGE;
  if (details === "party_not_ready") return PARTY_LFG_COPY.notReady;
  if (code === "P0001" && hint) return hint;
  if (details === "partner_not_ready") return PARTY_LFG_COPY.partnerFirst;
  if (message === "party_not_ready") return PARTY_LFG_COPY.notReady;
  return fallback;
}

/**
 * Share's failure: an error toast with partyLfgErrorMessage's sentence, except 0089's
 * partner_not_ready ("Ask {name} to open this party on the latest DuoQueue first. Then they can
 * see your post and stop it."). That is a step to take, not a failure, and too long for a 2 s
 * toast, so it is a plain alert with no error buzz.
 */
export function partyLfgStartFailure(
  err: unknown,
): { kind: "step"; title: string; message: string } | { kind: "error"; message: string } {
  const message = partyLfgErrorMessage(err, PARTY_LFG_COPY.startFailed);
  return errorFields(err).details === "partner_not_ready"
    ? { kind: "step", title: PARTY_LFG_COPY.partnerFirstTitle, message }
    : { kind: "error", message };
}

/** The party deck's words around the post. The caption is only false once a code can bring
 * someone in, so it changes only while the post row is there. */
export const PARTY_DECK_COPY = {
  caption: "Everyone in the party has to like someone before they get invited.",
  captionWithPost: "From the deck, everyone in the party has to like someone before they get invited.",
  emptyTitle: "No more profiles right now",
  emptySubtitle: "Check back later for more people to consider together.",
  emptySubtitleWithPost:
    "Share an LFG post to find your third anywhere, or check back later for more people to consider together.",
  refresh: "Refresh",
} as const;

/** "Sam, 24" (AGES STAY), or the name alone when the age is not known. */
export function partyMemberLine(name: string, age: number | null): string {
  return age !== null ? `${name}, ${age}` : name;
}

/** The arrival screen for a party code (/invited, kind "party"). The tick is rendered by
 * type.tick, which uppercases it. */
export const PARTY_ARRIVAL_COPY = {
  tick: "Invited",
  title: (name: string): string => `Join ${name}'s party`,
  body: "They're looking for a third. Join and you're in their party chat.",
  join: "Join the party",
  notNow: "Not right now",
  joinFailedTitle: "Couldn't join the party",
  /** A member who entered their own party's code. */
  alreadyIn: "You're already in this party.",
  openChat: "Open party chat",
  loadFailed: "Couldn't load the party.",
  tryAgain: "Try again",
  findPlayers: "Find players",
} as const;

/** Why a code had no seat, said on the arrival screen (preview or join). */
export const PARTY_JOIN_RESULT_COPY = {
  full: "That party's last seat was taken before you got there. You can still find players here.",
  ended: "That party post ended before you got there. You can still find players here.",
  unavailable: "That party isn't available. You can still find players here.",
} as const;

/**
 * Join's thrown failure (join_party_by_code): what the alert says, and whether to leave the
 * arrival screen. A refusal that will not change by tapping again leaves: 0089's kill switch
 * (42501) or a function that is gone (PGRST202) reads as the party not being available, as every
 * other read of this feature does; a banned account says so; any RAISE with a hint (a profile
 * that is not set up) says that. Only what a second tap can fix stays: the rate limit ("Wait a
 * few minutes"), and a dropped connection or anything unknown (the fallback).
 */
export function partyJoinErrorOutcome(err: unknown): { message: string; leave: boolean } {
  if (isPartyLfgUnavailable(err)) return { message: PARTY_JOIN_RESULT_COPY.unavailable, leave: true };
  const { message } = errorFields(err);
  if (message === "account_banned") return { message: PARTY_LFG_COPY.banned, leave: true };
  const said = partyInviteErrorMessage(err);
  return { message: said, leave: said !== INVITE_FALLBACK_MESSAGE && said !== TOO_MANY_TRIES_MESSAGE };
}

/** The front door's invite field, for a party code that has no seat. */
export const PARTY_INVITE_FIELD_LINES = {
  full: "That party's last seat is spoken for. You can still set up your card and find players here.",
  ended: "That party post has ended. You can still set up your card and find players here.",
} as const;

/** Matches > "Have a party code?", for players who already have an account (the shared link
 * opens the App Store, not the app, so this is how DuoQueue's own players answer a post). */
export const PARTY_CODE_FIELD_COPY = {
  open: "Have a party code?",
  label: "Party code",
  hint: "10 characters, from the LFG post.",
  checking: "Checking that code...",
  notFound: "That code did not work. Check it against the post.",
  /** The code could not be asked about (offline, a timeout): says nothing about the code. Tap to
   * ask again. */
  checkFailed: "Couldn't check that code. Tap to try again.",
  full: "That party's last seat is spoken for.",
  ended: "That party post has ended.",
} as const;
