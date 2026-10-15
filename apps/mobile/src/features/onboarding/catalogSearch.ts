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

interface SearchFacts {
  trimmed: string;
  debounced: string;
  isFetching: boolean;
  minQuery: number;
}

/** The search has SETTLED on what is typed: long enough, debounced to it, nothing in flight. Before
 * that, the rows on screen may be the previous query's (the hook keeps them while it fetches). */
function searchSettled({ trimmed, debounced, isFetching, minQuery }: SearchFacts): boolean {
  return trimmed.length >= minQuery && debounced === trimmed && !isFetching;
}

/** Case and runs of spaces aside, as normalizeCustomName stores a custom name. */
function sameName(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * "No matches yet." only for a search that has SETTLED on zero rows. Shown while the query is still
 * debouncing or fetching, it flashed on every keystroke.
 */
export function showNoMatches(facts: SearchFacts & { resultCount: number }): boolean {
  return searchSettled(facts) && facts.resultCount === 0;
}

/**
 * "Not listed? Add" once the search has SETTLED and no result IS the name typed: 1.0.1's rule,
 * with the settling added. Settled, so it never flashes per keystroke or offers a duplicate of a
 * game whose row is still on its way. Not "zero rows": search_games matches substrings and alias
 * prefixes, so typing "Apex Legends" when only "Apex Legends Mobile" exists returns one row, and
 * the player could never add the game they actually play (Edit details and Filters use this
 * picker too, and could in 1.0.1).
 */
export function showAddCustom(facts: SearchFacts & { resultNames: readonly string[] }): boolean {
  return searchSettled(facts) && !facts.resultNames.some((name) => sameName(name, facts.trimmed));
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
