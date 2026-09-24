/**
 * Turns a thrown save error into a sentence a person can read. Shared by the onboarding wizard's
 * final write and the Edit details save, which write the same tables and can hit the same RAISEs
 * (0069's `lol_rank_not_league`, for one).
 *
 * PostgREST returns `JSON.parse(body)`, a plain object, not an Error, so a rethrown `{ error }`
 * fails every `err instanceof Error` check downstream and the user gets the generic fallback
 * instead of the real reason.
 *
 * P0001 is a plpgsql RAISE, i.e. a message this codebase authored deliberately, and the
 * human-readable sentence lives in `hint` (`message` is a machine token like
 * `email_not_verified`). Every other code is Postgres or RLS internals, and those stay behind the
 * generic string rather than leaking schema details into the UI.
 */
export function toUserMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "code" in err) {
    const e = err as { code?: string; hint?: string | null };
    if (e.code === "P0001" && e.hint) return e.hint;
    return fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
