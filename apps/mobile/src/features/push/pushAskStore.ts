import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  canHoldDeckSlot,
  mergePushAskRecord,
  parsePushAskRecord,
  serializePushAskRecord,
  type DeckAskHolder,
  type PushAskRecord,
} from "./pushAsk";

/**
 * The notification asks' shared memory: when any surface last offered (one ask a week across all
 * of them), when this phone first liked someone, the one slot over the bottom of the deck, and the
 * deck's "a like just happened" moment.
 *
 * Per DEVICE, not per account, because notification permission is per device. Persisted by hand
 * (two numbers under one key), read once per launch by `load()`; the rules themselves are pure in
 * pushAsk.ts.
 *
 * CONTRACT FOR GROUP Q (the Duo Pops opt-in card), which shares the deck slot:
 * - call `claimDeck("duo-pops")` before rendering on the deck, and render only when it returns
 *   true;
 * - call `markOffered(Date.now())` when the card actually shows (it is an ask, and counts toward
 *   the weekly cap like any other);
 * - turn notifications on through `askForPush` (askForPush.ts), never by calling the OS directly;
 * - `releaseDeck("duo-pops")` on dismiss and on unmount;
 * - keep `setDuoPopsWanted(...)` current from its eligibility. While it is true, the push card
 *   lets a deck like moment go by so Duo Pops can take it. The moment is dropped, not queued: a
 *   card that turns up three swipes later has lost the reason it was asked.
 */

export const PUSH_ASK_STORAGE_KEY = "duoqueue.push-ask.v1";

/** When this JS runtime started. Duo Pops' "focus" trigger asks only after a like from an EARLIER
 * launch (`firstLikeAt < LAUNCH_STARTED_AT`). */
export const LAUNCH_STARTED_AT = Date.now();

interface PushAskState extends PushAskRecord {
  /** The persisted record has been read. Every ask waits for it. */
  loaded: boolean;
  /** Bumped by `offerPushAsk()` after a like without a match. The deck's cards react to it. */
  deckMomentAt: number | null;
  /** Which ask holds the slot over the bottom of the deck, if any. */
  deckHolder: DeckAskHolder | null;
  /** Group Q's eligibility for the Duo Pops card; while true the push card yields the deck. */
  duoPopsWanted: boolean;
  load: () => Promise<void>;
  markOffered: (now: number) => void;
  claimDeck: (who: DeckAskHolder) => boolean;
  releaseDeck: (who: DeckAskHolder) => void;
  setDuoPopsWanted: (wanted: boolean) => void;
}

function persist(record: PushAskRecord): void {
  try {
    AsyncStorage.setItem(PUSH_ASK_STORAGE_KEY, serializePushAskRecord(record)).catch(() => {});
  } catch {
    // Storage is a convenience here: losing it means at most one extra ask.
  }
}

function recordOf(state: PushAskRecord): PushAskRecord {
  return { lastOfferedAt: state.lastOfferedAt, firstLikeAt: state.firstLikeAt };
}

let loading: Promise<void> | null = null;

export const usePushAskStore = create<PushAskState>((set, get) => ({
  loaded: false,
  lastOfferedAt: null,
  firstLikeAt: null,
  deckMomentAt: null,
  deckHolder: null,
  duoPopsWanted: false,

  load: () => {
    if (!loading) {
      loading = (async () => {
        let stored: PushAskRecord;
        try {
          stored = parsePushAskRecord(await AsyncStorage.getItem(PUSH_ASK_STORAGE_KEY));
        } catch {
          stored = parsePushAskRecord(null);
        }
        // Anything that happened before the read finished (an offer, a first like) is merged in
        // rather than overwritten, then written back if it changed the record.
        const merged = mergePushAskRecord(stored, recordOf(get()));
        set({ ...merged, loaded: true });
        if (merged.lastOfferedAt !== stored.lastOfferedAt || merged.firstLikeAt !== stored.firstLikeAt) {
          persist(merged);
        }
      })();
    }
    return loading;
  },

  markOffered: (now) => {
    set({ lastOfferedAt: now });
    // Before the load, `load()` merges and writes it; writing now would clobber the stored like.
    if (get().loaded) persist(recordOf(get()));
  },

  claimDeck: (who) => {
    if (!canHoldDeckSlot(get().deckHolder, who)) return false;
    set({ deckHolder: who });
    return true;
  },

  releaseDeck: (who) => {
    if (get().deckHolder === who) set({ deckHolder: null });
  },

  setDuoPopsWanted: (wanted) => {
    if (get().duoPopsWanted !== wanted) set({ duoPopsWanted: wanted });
  },
}));

/**
 * The deck's moment: a Duo that did not match. Wired as `useDeckSwipeFlow({ onLiked })` on the
 * deck. Records the first like on this phone (persisted) and bumps `deckMomentAt`, which the deck's
 * push card and Duo Pops card each decide on.
 */
export function offerPushAsk(): void {
  const now = Date.now();
  const state = usePushAskStore.getState();
  const firstLike = state.firstLikeAt === null;
  usePushAskStore.setState({ deckMomentAt: now, ...(firstLike ? { firstLikeAt: now } : null) });
  if (firstLike && state.loaded) persist(recordOf(usePushAskStore.getState()));
}
