/**
 * The sender's DUO LOCKED plays at most once per lock per phone. Pure and tested
 * (duoLockedOnce.test.ts); openDuoLocked.ts keeps the list in memory and AsyncStorage.
 *
 * Three things can bring the same lock to the sender: the enriched new_match push landing while
 * the app is open, a tap on that push, and the one status read on resume (for a sender who has no
 * notification permission). Whichever comes first plays the moment and records the pop here;
 * the others then open the chat (a tap) or do nothing (the listener and the resume check).
 */

export const DUO_LOCKED_SEEN_KEY = "duoqueue.duo-locked-seen.v1";
/** A sender cannot make more than a few locks an hour; 20 is many days of them. */
export const CELEBRATED_MAX = 20;
/** How old a lock the resume check still celebrates (Q11): long enough for "I put the phone
 * down while I waited", short enough that a stale moment never takes over the screen. */
export const RESUME_WINDOW_MS = 15 * 60_000;

function norm(id: string): string {
  return id.trim().toLowerCase();
}

/** The list with this pop first, once, newest 20 kept. Returns a new array. */
export function rememberCelebrated(list: readonly string[], popId: string): string[] {
  const id = norm(popId);
  if (id === "") return [...list];
  return [id, ...list.filter((p) => p !== id)].slice(0, CELEBRATED_MAX);
}

export function wasCelebrated(list: readonly string[], popId: string): boolean {
  const id = norm(popId);
  return id !== "" && list.some((p) => norm(p) === id);
}

/** The stored list, tolerant of anything: junk reads as nothing celebrated yet. */
export function parseCelebrated(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .map(norm)
    .slice(0, CELEBRATED_MAX);
}

/**
 * On resume: the sender's newest queue-up was grabbed (locked, with its match), within the last
 * 15 minutes, and this phone has not played that moment yet. A lock stamped slightly after this
 * phone's "now" (its clock runs behind the server's) still counts as recent.
 *
 * Never for a duo that came from the LFG post. 0088 leaves popped_in_seconds null for those
 * (locked_via 'call'), and DUO LOCKED without a popped-in time says "You and {name} both queued
 * up", which is not what happened: somebody answered the post. The Queue Up sheet ("{name}
 * answered your LFG post.") and the push already say so; the resume check only refreshes.
 */
export function celebrateOnResume(
  row:
    | { queue_id: string; locked_at: string | null; match_id: string | null; popped_in_seconds: number | null }
    | null
    | undefined,
  nowMs: number,
  list: readonly string[],
): boolean {
  if (!row || row.locked_at === null || row.match_id === null) return false;
  if (row.popped_in_seconds === null) return false;
  const lockedMs = Date.parse(row.locked_at);
  if (!Number.isFinite(lockedMs)) return false;
  if (nowMs - lockedMs > RESUME_WINDOW_MS) return false;
  return !wasCelebrated(list, row.queue_id);
}
