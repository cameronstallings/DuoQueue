/**
 * The games step's decisions, pure so they are pinned in catalogSearch.test.ts: which games are
 * offered as one-tap quick picks, when "Not listed? Add" may appear, and how a custom game picked
 * before the account exists is held until Save.
 */

/** One tap each, above the search. League first: it is the launch game (and the rank picker). */
export const QUICK_PICK_GAMES = [
  "League of Legends",
  "Fortnite",
  "Valorant",
  "Rainbow Six Siege",
  "Rocket League",
  "Call of Duty: Warzone",
] as const;

/** The catalog rows for the quick picks, in QUICK_PICK_GAMES order, one per name; anything else dropped. */
export function orderQuickPicks<T extends { name: string }>(rows: readonly T[]): T[] {
  const out: T[] = [];
  for (const pick of QUICK_PICK_GAMES) {
    const row = rows.find((r) => r.name.toLowerCase() === pick.toLowerCase());
    if (row) out.push(row);
  }
  return out;
}

/**
 * "No matches yet." and the add button only for a search that has SETTLED on zero rows. Shown
 * while the query is still debouncing or fetching, it flashes on every keystroke and invites a
 * duplicate of a game the catalog already has.
 */
export function showAddCustom({
  trimmed,
  debounced,
  isFetching,
  resultCount,
  minQuery,
}: {
  trimmed: string;
  debounced: string;
  isFetching: boolean;
  resultCount: number;
  minQuery: number;
}): boolean {
  return trimmed.length >= minQuery && debounced === trimmed && !isFetching && resultCount === 0;
}

/**
 * A custom game picked signed out cannot be inserted yet (`games_insert_custom` needs a
 * `created_by`), so it is held in the draft under a pending id and created inside `submit()`.
 */
export const PENDING_CUSTOM_PREFIX = "pending:";

const CUSTOM_NAME_MAX = 60;

export function normalizeCustomName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, CUSTOM_NAME_MAX);
}

export function pendingCustomGameId(name: string): string {
  return `${PENDING_CUSTOM_PREFIX}${normalizeCustomName(name)}`;
}

export function isPendingCustomGame(id: string): boolean {
  return id.startsWith(PENDING_CUSTOM_PREFIX);
}
