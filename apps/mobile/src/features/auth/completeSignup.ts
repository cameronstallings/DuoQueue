/**
 * The two things the post-authentication age gate can get wrong on its own: the date it sends,
 * and the sentence it shows when the server sends one back.
 *
 * Both are pure and live here rather than in the screen, because both are decisions an 18+ gate
 * cannot afford to be casually wrong about, and neither needs a component, a session or a
 * network to be exercised.
 *
 * THE CONTRACT, restated so it can be diffed against the migration:
 *
 *     public.complete_signup(p_dob text, p_timezone text, p_display_name text default null)
 *     returns void
 *
 * and it raises exactly these four sentences, which is why they are pinned as constants below
 * rather than matched loosely. If the migration's wording changes, this file has to change with
 * it, and the tests are the thing that will say so.
 */

/**
 * ONE DATE CONVENTION, stated because three were in play.
 *
 * The picker hands back a Date at LOCAL midnight. `toISOString().slice(0, 10)` — what the age
 * gate used to do — converts that to UTC first, so east of UTC a birthday of the 3rd was
 * transmitted as the 2nd and the user read as a day older. Harmless for an 18+ floor, since it
 * only ever ages somebody up, but it means the date the app shows and the date the database
 * stores can disagree at the boundary.
 *
 * The convention from here on: the calendar date the user actually picked, read in their own
 * local time, with no timezone conversion anywhere. `checkDob` then interprets that string as
 * UTC midnight, the same way `dobSchema` and Postgres's `date` do.
 */
export function toIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The other direction, for putting a date the player already confirmed back on the wheel (a draft
 * resumed in the same launch, 1.0.2). The same convention as `toIsoDate`: the calendar date in the
 * player's LOCAL time, at local midnight, which is what the picker hands back itself. Null for
 * anything that is not a real calendar date (2001-02-29 included), so a bad value is never shown.
 */
export function fromIsoDate(iso: string | null | undefined): Date | null {
  if (!iso || !ISO_DATE_SHAPE.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(year, month - 1, day);
  // JS rolls 2001-02-29 forward to March 1; a date that does not come back unchanged was never real.
  return toIsoDate(date) === iso ? date : null;
}

export type DobProblem =
  /** Not a date at all, or not a real one (2025-02-31). */
  | "invalid"
  /** A real date, and it is under the floor. */
  | "under-age";

/**
 * The same check `complete_signup` runs, run first so the common case never needs the round
 * trip. `minAge` is a parameter rather than a constant so there is exactly one source of truth
 * for it: callers pass `MIN_AGE` from @duoqueue/shared-types, and this file stays importable by
 * a test runner that does not resolve workspace packages.
 *
 * BOTH DATES ARE READ AS CALENDAR DATES IN UTC, and compared field by field, which is what
 * Postgres does on the other side: `v_parsed_dob > (current_date - interval '18 years')::date`
 * has no time of day in it at all. Somebody whose birthday is today is exactly the cutoff and
 * passes.
 *
 * DELIBERATELY IDENTICAL to `meetsMinAge` in packages/shared-types/src/profile.ts, which backs
 * `dobSchema` on the email path. THE TWO MUST CHANGE TOGETHER: somebody refused by one and
 * accepted by the other is a bug report nobody can reproduce, because whether it happens
 * depends on which button they tapped. Both are covered by tests, in this file and in
 * `packages/shared-types/src/profile.test.ts`, which is what will say so if they drift.
 *
 * The obvious shorter version — copy `now`, `setUTCFullYear(year - minAge)`, compare
 * timestamps, which is what both of these used to do — is wrong one day every four
 * years. February 29 has no counterpart to land on, so JS rolls the cutoff forward to March 1
 * and somebody a day short of eighteen passes. Postgres clamps the other way (`date
 * '2028-02-29' - interval '18 years'` is 2010-02-28) and refuses them, so the gate itself never
 * opened, but the screen said yes and the server said no.
 */
export function checkDob(iso: string, minAge: number, now: Date = new Date()): DobProblem | null {
  if (!ISO_DATE_SHAPE.test(iso)) return "invalid";

  const birth = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return "invalid";
  // JS rolls 2025-02-31 forward to March 3 rather than rejecting it. Round-tripping catches
  // that: a date that does not serialize back to what was handed in was never a real date.
  if (birth.toISOString().slice(0, 10) !== iso) return "invalid";

  // Packed as YYYYMMDD so one comparison orders them the way a calendar does. Month and day
  // are each bounded well below their place value, so the ordering is exact rather than close.
  const born = birth.getUTCFullYear() * 10000 + (birth.getUTCMonth() + 1) * 100 + birth.getUTCDate();
  const cutoff = (now.getUTCFullYear() - minAge) * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();

  return born <= cutoff ? null : "under-age";
}

/** Matches the wording `dobSchema` already shows on the pre-auth path, so both gates say the same thing. */
export function dobProblemMessage(problem: DobProblem, minAge: number): string {
  return problem === "invalid" ? "Enter a valid date." : `You must be ${minAge} or older to use DuoQueue.`;
}

/**
 * The exact sentences `public.complete_signup` raises. Pinned, because a `raise exception` in
 * plpgsql arrives at the client as nothing but its message text, so the message IS the
 * protocol. Compared with `includes` rather than equality only because a future PostgREST could
 * decorate it; the sentences are distinctive enough that no two can collide.
 */
export const COMPLETE_SIGNUP_RAISES = {
  invalidDob: "A valid date of birth is required to create an account",
  underAge: "You must be at least 18 to create an account",
  banned: "This account has been banned and cannot be re-created.",
  alreadyComplete: "This account already has a profile",
} as const;

export type CompleteSignupOutcome =
  /**
   * The account already has a profile. Not a failure: the realistic cause is a retry after a
   * timeout where the first call actually committed, or a second tap. Refresh and carry on.
   * (The migration may make this a quiet no-op instead, in which case there is no error to map
   * and the refresh happens anyway. Both land in the same place.)
   */
  | { kind: "already-complete" }
  /** The date was refused. Stay on the screen; the user can fix it. */
  | { kind: "rejected"; message: string }
  /** The account cannot have a profile at all. Show it, then sign out — there is nowhere else to go. */
  | { kind: "banned"; message: string }
  /** Anything else: network, a rate limit, a bug. Worth another try. */
  | { kind: "unknown"; message: string };

/**
 * Turns whatever `supabase.rpc("complete_signup", ...)` threw into one sentence and one
 * decision.
 *
 * Unlike `inviteErrorMessage`, this accepts a bare `{ message }` object as well as an Error.
 * PostgrestError extends Error in the version this app pins, but the mapping here is
 * allow-list-only — an unrecognised message is never echoed to the user — so reading a wider
 * range of shapes cannot leak a hint, a GRANT statement or a schema name the way blind
 * pass-through once did on the invite screen.
 */
export function completeSignupOutcome(err: unknown, minAge: number): CompleteSignupOutcome {
  const raised = rawMessage(err);

  if (raised.includes(COMPLETE_SIGNUP_RAISES.alreadyComplete)) return { kind: "already-complete" };
  if (raised.includes(COMPLETE_SIGNUP_RAISES.banned)) {
    return { kind: "banned", message: "This account cannot be used to create a profile." };
  }
  if (raised.includes(COMPLETE_SIGNUP_RAISES.underAge)) {
    return { kind: "rejected", message: dobProblemMessage("under-age", minAge) };
  }
  if (raised.includes(COMPLETE_SIGNUP_RAISES.invalidDob)) {
    return { kind: "rejected", message: dobProblemMessage("invalid", minAge) };
  }
  return { kind: "unknown", message: "Something went wrong. Please try again." };
}

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}
