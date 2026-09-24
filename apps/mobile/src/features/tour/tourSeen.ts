/**
 * The tour's once-per-account flag. A local flag keyed by the user id, no migration (spec §2).
 * The store is passed in (AsyncStorage in app/welcome.tsx) so this stays pure and tested.
 */
export interface FlagStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function tourSeenKey(userId: string): string {
  return `duoqueue.tour-seen.v1.${userId}`;
}

/** A store that cannot be read counts as seen: skipping the tour is harmless, showing it twice
 * is not. */
export async function hasSeenTour(store: FlagStore, userId: string): Promise<boolean> {
  try {
    return (await store.getItem(tourSeenKey(userId))) === "1";
  } catch {
    return true;
  }
}

export async function markTourSeen(store: FlagStore, userId: string): Promise<void> {
  try {
    await store.setItem(tourSeenKey(userId), "1");
  } catch {
    // Nothing to do: a flag that did not stick can only mean the tour shows once more, and the
    // route is reached only from the end of profile setup anyway.
  }
}
