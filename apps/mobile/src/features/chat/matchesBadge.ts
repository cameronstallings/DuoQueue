import type { FlagStore } from "../tour/tourSeen";

/**
 * The Matches tab badge, as pure maths (matchesBadge.test.ts). `useMatchesBadge` wires it.
 *
 * What it counts:
 * - every conversation with an unread message (conversations, not messages: three texts from one
 *   person are one person waiting). Locked chats count too, because someone really is waiting
 *   and opening the chat clears it (Q20);
 * - every match with nothing unread that has not been SEEN on the Matches tab yet, i.e. a new
 *   match you have not looked at. "Seen" is a local set of match ids per account, stored on the
 *   phone, because a match's creation time is not in the summary and nothing server-side needs
 *   to know which rows you have looked at;
 * - every pending party invite (somebody waiting on you, and it expires).
 */

export interface BadgeMatch {
  match_id: string;
  unread_count: number;
}

export function matchesSeenKey(profileId: string): string {
  return `duoqueue.matches-seen.v1.${profileId}`;
}

/** A stored JSON array of ids, or null for anything else (nothing stored, or junk). */
export function parseSeen(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    return value.filter((id): id is string => typeof id === "string");
  } catch {
    return null;
  }
}

/** Null when the store cannot be read. Null seeds (see `nextSeen`), so a broken store means no
 * "new" part in the badge at all, never one stuck on forever. */
export async function readSeen(store: FlagStore, profileId: string): Promise<string[] | null> {
  try {
    return parseSeen(await store.getItem(matchesSeenKey(profileId)));
  } catch {
    return null;
  }
}

export async function writeSeen(store: FlagStore, profileId: string, seen: readonly string[]): Promise<void> {
  try {
    await store.setItem(matchesSeenKey(profileId), JSON.stringify(seen));
  } catch {
    // A write that did not stick only means the same matches count as new once more.
  }
}

/**
 * The seen set after the player has looked at the current matches.
 *
 * Null (never stored, or unreadable) SEEDS with the current ids: a player updating to 1.0.2 has
 * looked at their matches many times already, and a badge counting all of them as new would be
 * a lie. Otherwise the union of both, pruned to matches that still exist, so an unmatch never
 * leaves an id behind and the stored list never grows past the match list.
 */
export function nextSeen(seen: readonly string[] | null, currentIds: readonly string[]): string[] {
  const current = new Set(currentIds);
  const merged = seen === null ? [...currentIds] : [...seen, ...currentIds];
  return Array.from(new Set(merged)).filter((id) => current.has(id));
}

/**
 * Unread conversations, plus unseen unread-free matches while the seen set is known (`undefined`
 * while loading and `null` before it seeds add nothing), plus pending party invites.
 */
export function matchesBadgeCount({
  matches,
  pendingPartyInvites,
  seen,
}: {
  matches: readonly BadgeMatch[] | undefined;
  pendingPartyInvites: number;
  seen: readonly string[] | null | undefined;
}): number {
  let count = Math.max(0, Math.floor(pendingPartyInvites) || 0);
  const seenSet = Array.isArray(seen) ? new Set(seen) : null;
  for (const m of matches ?? []) {
    if (m.unread_count > 0) count += 1;
    else if (seenSet && !seenSet.has(m.match_id)) count += 1;
  }
  return count;
}

/** What the tab shows: nothing at 0, the number up to 9, "9+" above. */
export function badgeLabel(count: number): string | undefined {
  if (!Number.isFinite(count) || count <= 0) return undefined;
  return count > 9 ? "9+" : String(Math.floor(count));
}
