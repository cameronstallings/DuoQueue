// The two decisions the invite link endpoint makes, pulled out of the handler so they can be
// tested without Deno and without deploying anything. Same shape `new-player-alert.ts`
// established; nothing here imports Deno or npm, which is what lets apps/mobile's vitest run
// the tests next to this file (see apps/mobile/vitest.config.mts).
//
// ============================================================================
// WHY THIS IS A REDIRECT AND NOT A PAGE. MEASURED, NOT ASSUMED.
// ============================================================================
//
// The first build of this served a real landing page: who invited you, the code in large
// selectable type, an "Open in DuoQueue" button and a get-the-app button. It was deployed and
// fetched, and the Supabase Functions gateway came back with:
//
//   Content-Type: text/plain
//   Content-Security-Policy: default-src 'none'; sandbox
//
// on a response that had explicitly set `text/html; charset=utf-8`. That is the platform's
// anti-phishing control on the shared `*.supabase.co` functions origin, and it means a
// browser renders the page as source. It is not a bug to work around: an endpoint that
// finds a content type slipping past it would be circumventing a safety mechanism, and the
// next platform update would break the feature anyway. So the page is gone and this
// endpoint does the one thing the gateway is happy to do -- redirect.
//
// duoqueue.io could not host the page either, and for an unrelated structural reason worth
// writing down: it is GitHub Pages serving static files, so there is no server-side routing
// to map /i/<code> onto one file, and its published privacy policy says in those words that
// there is no JavaScript on the site at all -- so the client-side workaround would make a
// live legal document false. Between the two hosts there is nowhere to put an invite page,
// which is why the CODE and not the URL is this feature's primitive: it travels in the
// share message, where a human can read it, and it is typed into the app.
//
// ============================================================================
// WHAT THE LINK IS STILL FOR
// ============================================================================
//
//   1. It is per-user, so a share message has something to point at.
//   2. Its destination flips at launch with one UPDATE to app_config and no redeploy of
//      anything, so an invite sent this week -- while DuoQueue is approved and deliberately
//      unreleased -- lands on the waitlist today and on the App Store the moment Cameron
//      releases. That is the "must work before and after launch" requirement, and it is the
//      whole reason the link is not just a hardcoded duoqueue.io in the share message.
//   3. A dead or revoked code degrades to the same get-the-app destination rather than to an
//      error, so the worst case for a stale invite is an ordinary install.

/** Crockford base32: the 32 symbols an invite code can contain (no I, L, O or U). */
const CODE_ALPHABET = /^[0-9A-HJKMNP-TV-Z]{10}$/;

/** Where somebody who does not have the app goes before there is an App Store listing. */
export const WAITLIST_URL = "https://duoqueue.io";

/**
 * The same normalisation `public.normalize_invite_code(text)` performs, and the same one
 * `apps/mobile/src/lib/invite.ts` performs.
 *
 * THREE COPIES, ON PURPOSE, AND CROSS-CHECKED. The rule has to exist in Postgres (it is what
 * the code column is matched against), in the app (so a typed code can be validated before a
 * round trip and so a deep link can be parsed) and here. There is no runtime all three
 * share. `apps/mobile/src/lib/invite.test.ts` imports this module and the app's and asserts
 * they agree on a shared table of inputs; step 05 of the live SQL check asserts Postgres
 * agrees too. If you change one, change all three.
 *
 * I, L and O are not in the alphabet, so a code can never legitimately contain them, which
 * means mapping them onto 1, 1 and 0 can only ever fix somebody's typing and never corrupt a
 * real code. U is excluded from the alphabet as well and is deliberately NOT mapped: there
 * is no digit it obviously means, so a code containing one is simply wrong.
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
 * Pulls the code out of a request URL, accepting both shapes this endpoint publishes: the
 * path form `/functions/v1/invite/ABCDE12345` (what every share message uses) and the query
 * form `/functions/v1/invite?c=ABCDE12345` (what survives a client that mangles a path, and
 * what is easiest to type).
 *
 * Returns null for anything that is not code-shaped, so the handler has two cases and not
 * three. `invite`, `functions` and `v1` are path segments too; none of them are ten Crockford
 * symbols, so the shape check is the whole filter.
 */
export function parseInviteCodeFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const fromQuery = normalizeInviteCode(parsed.searchParams.get("c"));
  if (isInviteCodeShape(fromQuery)) return fromQuery;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const fromPath = normalizeInviteCode(segments[segments.length - 1]);
  return isInviteCodeShape(fromPath) ? fromPath : null;
}

/**
 * Where to send the browser.
 *
 * `appStoreUrl` is `app_config.app_store_url`: since 0082 the App Store campaign link
 * (`https://apps.apple.com/app/apple-store/id6798837181?pt=129274943&ct=invite&mt=8`), so an
 * invite goes straight to the store and the install is credited to the "invite" campaign. It
 * is redirected to exactly as stored (URL.toString() leaves that string as it is), and it is the
 * one place the destination is decided: a per-code campaign token, if one is ever wanted, is
 * built from it, never from a second hard-coded store URL. Empty means the waitlist site. Only an
 * https URL is accepted from it: that row is operator-editable at 11pm on launch night, and
 * a typo that produced `javascript:` or a scheme URL would turn a link thousands of people
 * were sent into something else entirely. A malformed value falls back to the waitlist,
 * which is wrong but harmless.
 */
export function inviteRedirectTarget(appStoreUrl: string | null | undefined): string {
  const candidate = (appStoreUrl ?? "").trim();
  if (!candidate) return WAITLIST_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return WAITLIST_URL;
    return url.toString();
  } catch {
    return WAITLIST_URL;
  }
}

/** Whether the code in the link is a live invite. Reported, never acted on: see inviteResponse. */
export type InviteCodeState = "live" | "unknown";

export interface InviteResponse {
  status: 302;
  headers: Record<string, string>;
}

/**
 * The whole answer: ALWAYS a 302 to the destination, whatever the code.
 *
 * Until 15 Oct 2026 a code that did not resolve (revoked, mistyped, a link from before a code
 * was replaced, or no code at all) was answered 404 with the same Location, on the belief that a
 * browser follows it either way. It does not: a browser follows Location only on a 3xx, so an
 * old or broken invite link opened a blank page instead of the App Store. Every invite link
 * ever sent now lands on the store, which is the point of it (and of item 3 at the top of this
 * file).
 *
 * "Is this invite still live" stays answerable with curl and visible in the function logs, as
 * the X-Invite-Code header: "live" or "unknown". It says no more than the 404 used to.
 */
export function inviteResponse(appStoreUrl: string | null | undefined, codeState: InviteCodeState): InviteResponse {
  return {
    status: 302,
    headers: {
      Location: inviteRedirectTarget(appStoreUrl),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Invite-Code": codeState,
    },
  };
}
