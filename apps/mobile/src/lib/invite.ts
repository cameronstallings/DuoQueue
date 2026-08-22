/**
 * Everything about invites that can be WRONG without a component being involved: the code
 * format, what a shared link looks like, what the share message says, and where a tapped
 * invite link should send somebody.
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

  // Signed in, but the profile row has not landed. We cannot tell whether they are
  // mid-wizard, and both guesses are a wrong screen.
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
