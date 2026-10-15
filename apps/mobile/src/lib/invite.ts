import type { InviteRedemption } from "@duoqueue/shared-types";

import type { ProfileStatus } from "@/features/auth/sessionRouting";
import type { ResolvedPartyCode } from "@/features/party/partyCall";

/**
 * Everything about invites that can be WRONG without a component being involved: the code
 * format, what a shared link looks like, what the share message says, and where a tapped
 * invite link should send somebody.
 *
 * Every import is type-only, so they are erased before this file ever runs and the module
 * stays as free-standing as the rest of its family. `ProfileStatus` is shared rather than
 * restated because a copy of a four-member union is a copy that drifts, and the member that
 * matters here ("missing") is the one an 18+ gate is built on.
 *
 * Same shape `deckQueue.ts`, `emptyDeckDecisions.ts` and `notificationRouting.ts`
 * established. What is left in the hooks and screens after this is queries and JSX.
 *
 * ============================================================================
 * THE CODE IS THE PRIMITIVE, NOT THE URL
 * ============================================================================
 *
 * iOS has no install referrer, so a person who taps an invite link, is sent to the App
 * Store, installs, and opens DuoQueue arrives with nothing: there is no deferred deep link
 * and no way for the app to ask which link brought them. Two hosts could have bridged that
 * with a landing page and neither can:
 *
 *   * duoqueue.io is GitHub Pages with no server-side routing, and its published privacy
 *     policy says in those words that there is no JavaScript on the site at all, so a
 *     client-side /i/<code> reader would make a live legal document false.
 *   * The Supabase Functions origin rewrites any text/html response to text/plain and
 *     sandboxes it. Measured, not assumed: see the header of
 *     supabase/functions/_shared/invite-link.ts.
 *
 * So the code travels in the SHARE MESSAGE, where a human reads it, and the app takes it
 * two ways: automatically from a `duoqueue://invite/<code>` deep link when the app is
 * already installed, and typed into the sign-up screen's invite field when it is not. The
 * link still exists and is still per-user, because its destination flips from the waitlist
 * to the App Store on launch day with one UPDATE and no app release.
 */

/** Crockford base32: the 32 symbols an invite code can contain (no I, L, O or U). */
const CODE_ALPHABET = /^[0-9A-HJKMNP-TV-Z]{10}$/;

export const INVITE_CODE_LENGTH = 10;

/**
 * The same normalisation `public.normalize_invite_code(text)` performs and the same one
 * `supabase/functions/_shared/invite-link.ts` performs.
 *
 * THREE COPIES, ON PURPOSE, AND CROSS-CHECKED. The rule has to exist in Postgres (it is
 * what the code column is matched against), in the Edge Function (which validates a code
 * before redirecting) and here (so a typed code can be checked before a round trip, and so
 * a deep link can be parsed). No runtime is shared by all three. `invite.test.ts` imports
 * this module and the Edge Function's and asserts they agree on one table of inputs; the
 * live SQL check asserts Postgres agrees too.
 *
 * I, L and O are not in the alphabet, so a real code can never contain them, which means
 * mapping them onto 1, 1 and 0 can only ever fix somebody's typing. U is excluded from the
 * alphabet as well and deliberately NOT mapped: there is no digit it obviously means.
 */
export function normalizeInviteCode(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

/** Whether a normalised string is exactly the shape of an invite code. */
export function isInviteCodeShape(normalized: string): boolean {
  return CODE_ALPHABET.test(normalized);
}

/**
 * Pulls an invite code out of any URL that could plausibly carry one.
 *
 * Three shapes reach this, and all three are real:
 *   `duoqueue://invite/ABCDE12345`   the deep link, when the app is already installed
 *   `https://<ref>.supabase.co/functions/v1/invite/ABCDE12345`   the shared link itself
 *   `...?c=ABCDE12345`               the query form, for a client that mangles a path
 *
 * NOT a URL parser: React Native's URL polyfill handles `https://` well and custom schemes
 * inconsistently (the host of `duoqueue://invite/X` lands in `hostname` on one platform and
 * inside `pathname` on another), and getting that wrong silently drops the invite. This
 * scans the whole string for a code-shaped run instead, which is why it takes the `invite`
 * marker into account rather than trusting position: the point is to find the code, and a
 * string that does not look like a DuoQueue invite link should not yield one.
 */
export function parseInviteCode(url: string | null | undefined): string | null {
  if (!url) return null;
  // Everything after the scheme, lowercased only for the marker test.
  if (!/invite/i.test(url)) return null;

  const query = /[?&]c=([^&#]+)/i.exec(url);
  if (query?.[1]) {
    const fromQuery = normalizeInviteCode(decodeURIComponent(query[1]));
    if (isInviteCodeShape(fromQuery)) return fromQuery;
  }

  // The segment that follows the `invite` marker, whatever separated them.
  const path = /invite[/:=]+([0-9A-Za-z-]+)/i.exec(url);
  if (path?.[1]) {
    const fromPath = normalizeInviteCode(path[1]);
    if (isInviteCodeShape(fromPath)) return fromPath;
  }

  return null;
}

/**
 * The shareable link for a code.
 *
 * Built from the Supabase project URL the app is already configured with, so there is no
 * second place to update if the project ever moves, and so a dev build points at its own
 * project rather than at production.
 */
export function inviteUrl(code: string, supabaseUrl: string | undefined): string {
  const base = (supabaseUrl ?? "").replace(/\/+$/, "");
  return `${base}/functions/v1/invite/${code}`;
}

/**
 * What the share sheet puts in the message.
 *
 * THE CONSTRAINTS, because they are not obvious from the string:
 *
 *  - DuoQueue is 18+ and PLATONIC and was rejected once under App Store guideline 2.3.6.
 *    This is the single most public string the app produces, because it gets pasted into
 *    group chats by people the app has never met. "18+" and "not dates" are both stated
 *    outright rather than implied, and there is a test asserting the message never matches
 *    /date(?!s,)|dating|singles|hookup|nearby|meet people/i.
 *  - THE CODE IS ON ITS OWN LINE. It is the part that has to survive being read on a phone,
 *    retyped, or dictated over voice chat, and it is the only part that still works after a
 *    trip through the App Store. Burying it inside a sentence is how it gets lost.
 *  - No em dashes, per the project's copy rule.
 */
export function inviteShareMessage(code: string, url: string): string {
  return (
    "Come queue with me on DuoQueue. It is 18+ and it matches you with people who play " +
    "your games at your hours. For teammates, not dates.\n\n" +
    `Enter my invite code when you sign up and my profile is the first one you see: ${code}\n\n` +
    url
  );
}

/**
 * What tapping an invite link should do, decided without React or a router.
 *
 * The states are the same four `notificationRouting.ts` had to reason about, for the same
 * reason: a deep link can be what LAUNCHES the app, so it arrives before there is a
 * session, before there is a profile, and sometimes before there is a navigator.
 */
export interface InviteRouteInput {
  /** Whether the tapped URL yielded a code-shaped string at all. */
  codeValid: boolean;
  sessionStatus: "loading" | "signed_out" | "signed_in";
  /**
   * What the store actually knows about the profile row. `onboardingCompleted` alone cannot
   * say: it is `undefined` both while a read is in flight and when the read came back and
   * there is no row, and those two need opposite answers.
   */
  profileStatus: ProfileStatus;
  /** `profile.onboarding_completed`, or undefined while the profile row is still loading. */
  onboardingCompleted: boolean | undefined;
  /**
   * Where `redeem_invite_code` has got to for the pending code. "idle" means it has not
   * started, which for a signed-in user means the redemption hook has not run yet.
   */
  redemption: "idle" | "pending" | "done" | "failed";
}

export type InviteRouteAction =
  /** Not ready to decide. Hold, and re-ask when the session or the redemption settles. */
  | "wait"
  /** No account yet. The code is stored; the sign-in screen shows who invited them. */
  | "sign-in"
  /** Signed in mid-wizard. Finishing onboarding is what leads to the arrival screen. */
  | "onboarding"
  /** Redeemed and ready: show them who brought them. */
  | "arrival"
  /** Nothing to do with this link. Let the app's normal entry routing take over. */
  | "home";

export function inviteRouteAction(input: InviteRouteInput): InviteRouteAction {
  // A link that carries no code is not an error worth a screen. Send them into the app.
  if (!input.codeValid) return "home";

  if (input.sessionStatus === "loading") return "wait";
  if (input.sessionStatus === "signed_out") return "sign-in";

  // Authenticated with no profile row: an Apple signup that has not passed the age gate yet.
  // "home" is not a shrug here, it is the address. Every layout guard in the app redirects a
  // profile-less session to "/", and app/index.tsx renders the age gate there, so this link
  // hands the user to exactly the same routing as any other entry point. The pending code was
  // already stored by the effect on the screen above, and the redemption hook now waits for a
  // profile, so nothing is lost by walking away from this screen.
  //
  // It must be checked BEFORE the line below, which is the bug it exists to close: for a
  // missing profile `onboardingCompleted` is undefined forever, so a deep link tapped by a
  // half-signed-up Apple user rendered the held Logo frame with no timer that could ever
  // change the answer, no back gesture on a deep-link entry, and no way out but force-quit.
  if (input.profileStatus === "missing") return "home";

  // Signed in, but the profile row has not landed. We cannot tell whether they are
  // mid-wizard, and both guesses are a wrong screen. Reachable now only for "unknown" and
  // "error", both of which a retry resolves.
  if (input.onboardingCompleted === undefined) return "wait";
  if (!input.onboardingCompleted) return "onboarding";

  // Onboarded. The arrival screen needs the inviter, which only redemption provides.
  switch (input.redemption) {
    case "idle":
    case "pending":
      return "wait";
    case "done":
      return "arrival";
    case "failed":
      // Expired window, already invited by somebody else, a revoked code. All of them mean
      // there is no arrival to show, and none of them are worth an error screen for a link
      // the user merely tapped.
      return "home";
  }
}

/**
 * Whether it is time to spend a pending invite code, which is a question with one wrong
 * answer and the wrong answer is expensive.
 *
 * PURE AND TESTED BECAUSE IT IS THE LINE THAT BROKE. `useInviteRedemption` used to ask
 * `status === "signed_in"` and nothing else, which was correct for exactly as long as a
 * session implied a profile. Sign in with Apple ended that: the account authenticates first,
 * the age gate runs after, and in between `redeem_invite_code` reads `profiles.created_at`
 * for its 14 day window (0066), finds no row, and raises `invite_window_closed` -- the one
 * verdict that is flatly untrue of the newest account it is possible to have. The hook reads
 * every failure as settled, so the code was deleted from the store AND from AsyncStorage
 * before the profile existed. Silently, on every invited Apple install: no attribution row,
 * no credit to the inviter, no arrival screen, and nothing left to retry with.
 *
 * So the gate is the PROFILE, not the session. Three consequences worth naming:
 *
 *  - "loaded" only. An "error" read says nothing about whether a row exists, and a "missing"
 *    one says the age gate has not been passed; both come back around on their own, and
 *    guessing costs the invite permanently while waiting costs seconds.
 *  - It is self-timing. `completeSignup` finishes with a `refreshProfile()`, which flips the
 *    status to "loaded", which re-runs the effect at exactly the first moment the RPC can
 *    succeed. Nothing has to remember to retry.
 *  - The email path is untouched: `initialize()` reads the profile before it flips `status`,
 *    so both facts arrive in the same store update.
 */
export interface InviteRedemptionGateInput {
  sessionStatus: "loading" | "signed_out" | "signed_in";
  profileStatus: ProfileStatus;
  /** The code held by the invite store, or null when this install did not arrive from a link. */
  pendingCode: string | null;
  /** How far redemption has got. Anything but "idle" means it has already been attempted. */
  redemption: "idle" | "pending" | "done" | "failed";
}

export function shouldRedeemInvite(input: InviteRedemptionGateInput): boolean {
  if (input.sessionStatus !== "signed_in") return false;
  if (input.profileStatus !== "loaded") return false;
  if (!input.pendingCode) return false;
  return input.redemption === "idle";
}

/** Somebody's own invite, or a Duo Call code: the arrival screen shows the inviter's card. An
 * arrival stored by an older build has no `kind` and is one of these. */
export interface DuoInviteArrival {
  kind?: "duo";
  inviterId: string;
  inviterName: string;
}

/**
 * A party LFG post's code (0089): the arrival screen previews the party and offers its last seat.
 * Only the code and the sharer's name are kept: nothing is written for a party code until the
 * player taps Join (join_party_by_code), so an abandoned sign-up never holds a seat.
 */
export interface PartyInviteArrival {
  kind: "party";
  code: string;
  inviterName: string;
}

export type InviteArrival = DuoInviteArrival | PartyInviteArrival;

/**
 * The stored arrival, read back after a restart. Tolerant of anything: a malformed blob, or one
 * from an older build missing a field, is dropped (it costs one screen), and a blob marked
 * "party" is a party arrival or nothing, never a duo one (it has no inviter to duo with).
 */
export function parseArrival(raw: string | null | undefined): InviteArrival | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const blob = parsed as { kind?: unknown; code?: unknown; inviterId?: unknown; inviterName?: unknown };
  if (typeof blob.inviterName !== "string") return null;
  if (blob.kind === "party") {
    if (typeof blob.code !== "string" || !isInviteCodeShape(blob.code)) return null;
    return { kind: "party", code: blob.code, inviterName: blob.inviterName };
  }
  if (blob.kind !== undefined && blob.kind !== "duo") return null;
  if (typeof blob.inviterId !== "string") return null;
  return { inviterId: blob.inviterId, inviterName: blob.inviterName };
}

/** A pending party code that was full or ended by the time the player's profile existed, said
 * once as an info toast. "before you finished": they are mid sign-up. */
export const PARTY_REDEEM_NOTICE = {
  full: "That party's last seat was taken before you finished. You can still find players here.",
  ended: "That party post ended before you finished. You can still find players here.",
} as const;

/** The same, for a player who is already set up (a `duoqueue://invite/<code>` deep link). */
export const PARTY_LINK_NOTICE = {
  full: "That party's last seat was taken. You can still find players here.",
  ended: "That party post has ended. You can still find players here.",
} as const;

export type PartyRedemptionOutcome =
  | { kind: "arrival"; arrival: PartyInviteArrival }
  | { kind: "refused"; notice: string }
  | { kind: "not-party" };

/**
 * What a pending code is, asked of resolve_party_code BEFORE redeem_invite_code. Read-only, so
 * asking first costs an ordinary invite nothing, and it has to be first: redeem_invite_code
 * returns an account's earlier redemption whatever code it is given (0066), so it cannot be the
 * one to say "this is not mine".
 *  - live: a party arrival (the code, normalised, and the sharer's name);
 *  - full or ended: no arrival, and a notice worded for where the player is;
 *  - zero rows, an unknown status or ANY error (PGRST202 before 0089, offline): not a party code,
 *    so today's redeem_invite_code path runs exactly as before. An error here must never lose an
 *    ordinary invite.
 */
export function partyRedemptionOutcome(input: {
  error: unknown;
  rows: unknown;
  code: string;
  onboarded: boolean;
}): PartyRedemptionOutcome {
  if (input.error) return { kind: "not-party" };
  const first = Array.isArray(input.rows) ? (input.rows[0] as Partial<ResolvedPartyCode> | undefined) : undefined;
  if (!first) return { kind: "not-party" };
  const notices = input.onboarded ? PARTY_LINK_NOTICE : PARTY_REDEEM_NOTICE;
  switch (first.status) {
    case "live": {
      const name = typeof first.sharer_name === "string" ? first.sharer_name.trim() : "";
      return {
        kind: "arrival",
        arrival: { kind: "party", code: normalizeInviteCode(input.code), inviterName: name || "Someone" },
      };
    }
    case "full":
      return { kind: "refused", notice: notices.full };
    case "ended":
      return { kind: "refused", notice: notices.ended };
    default:
      return { kind: "not-party" };
  }
}

/** The sign-up screen's line once a party code resolved: a seat, and who it is with. */
export function partyConfirmation(sharerName: string): string {
  return `${sharerName}'s party has a seat for you. Finish signing up to join them.`;
}

/**
 * Said once (an info toast) when the Duo Call code a new player typed at the front door had
 * ended by the time their profile existed. ONE DUO PER QUEUE UP (0088) closes a call at its first
 * duo, which can be minutes after the code was typed and resolved, so this is a normal path now,
 * and settling with nothing said dropped them in the app wondering where their invite went.
 *
 * "ended", not "found its duo": call_code_ended is also true when the sender stopped queueing or
 * the hour ran out, and this sentence has to be true of all three.
 */
export const CALL_ENDED_BEFORE_SIGNUP = "That Duo Call ended before you finished. You can still find players here.";

/** Whether redemption's answer leaves the question "was that a Duo Call that ended?" worth one
 * more read (`call_code_ended`): only an empty answer, never a failed call (offline says nothing). */
export function needsCallEndedCheck(input: {
  errored: boolean;
  row: InviteRedemption | null | undefined;
  onboarded?: boolean;
}): boolean {
  return !input.errored && !input.row && input.onboarded !== true;
}

/**
 * What `redeem_invite_code`'s answer means for the arrival screen, and what to say when there is
 * none to show:
 *  - a row: arrive at the inviter, unless that redemption was already connected (most likely on a
 *    previous install), which keeps its attribution and does not celebrate twice;
 *  - no row: no arrival, and CALL_ENDED_BEFORE_SIGNUP only when `call_code_ended` said yes and the
 *    player is still signing up (an onboarded player got here by a deep link, and the link screen
 *    already says INVITE_LINK_UNUSABLE; "before you finished" would not be true of them);
 *  - an error: no arrival and nothing said (the window closed, a block, offline).
 */
export function duoRedemptionOutcome(input: {
  errored: boolean;
  row: InviteRedemption | null | undefined;
  callEnded?: boolean;
  onboarded?: boolean;
}): { arrival: DuoInviteArrival | null; notice: string | null } {
  if (input.errored) return { arrival: null, notice: null };
  if (input.row) {
    return {
      arrival: input.row.connected ? null : { inviterId: input.row.inviter_id, inviterName: input.row.display_name },
      notice: null,
    };
  }
  const say = input.callEnded === true && input.onboarded !== true;
  return { arrival: null, notice: say ? CALL_ENDED_BEFORE_SIGNUP : null };
}

/**
 * The one sentence the sign-up screen shows once a code has resolved.
 *
 * Separate from the JSX because it is the sentence that has to be true: the invited person
 * is being told that finishing sign-up puts a specific named person in front of them, and
 * that is a promise `redeem_invite_code` plus the arrival screen actually keep.
 */
export function inviterConfirmation(inviterName: string): string {
  return `${inviterName} invited you. Finish signing up and they are the first player you see.`;
}

/**
 * Said once (an info toast) when a player who is already set up taps an invite or Duo Call link
 * that their account cannot use. Redemption is for new players: accounts older than 14 days
 * (0066's window), one invite per player, and never a code that has ended or is their own. Since
 * 1.0.2 the Duo Call post invites strangers to "Answer on DuoQueue", and an existing player who
 * tapped it was dropped on the deck with nothing said at all.
 */
export const INVITE_LINK_UNUSABLE = "That invite link didn't change anything here. Invite links are for new players.";

/**
 * What to put in front of somebody whose "Duo with {Name}" tap came back an error.
 *
 * WHY THIS EXISTS. `accept_invite` signals failure the way the rest of this schema does,
 * with `raise exception 'inviter_unavailable'`, and `PostgrestError extends Error` with
 * that bare token as its `.message`. The arrival screen followed the house pattern of
 * `Alert.alert("Something went wrong", err.message)`, so the alert read:
 *
 *     Something went wrong
 *     inviter_unavailable
 *
 * on the one screen where the whole feature is being introduced. Confirmed by constructing
 * the exact object the client receives, not inferred.
 *
 * WHY A FIXED TABLE AND NOT `err.hint`. Two of the three raises carry a written hint, so
 * reading `.hint` looks like the elegant answer. It is not safe: Postgres and PostgREST put
 * their OWN hints on errors this function never anticipated, and one of them is literally
 * "Grant the required privileges to the current role with: GRANT SELECT ON
 * public.invite_codes TO anon" (observed, over the wire, in the anon grant check). A table
 * of tokens this code knows about, and one plain sentence for everything else, cannot leak
 * a schema name into an alert.
 *
 * The two known sentences are the hints from 0065 verbatim, so the copy still has one
 * author.
 */
const INVITE_ERROR_COPY: Readonly<Record<string, string>> = {
  inviter_unavailable: "That player is not available right now.",
  no_invite: "There is no invite on this account.",
  account_banned: "This account cannot do that right now.",
};

export function inviteErrorMessage(err: unknown): string {
  const token = err instanceof Error ? err.message.trim() : "";
  return INVITE_ERROR_COPY[token] ?? "Please try again.";
}
