/**
 * Words the party screens show, decided without React or Supabase so they can be tested: how a
 * list of names reads, and what a refused invite says.
 */

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
