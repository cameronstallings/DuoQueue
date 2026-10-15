import { create } from "zustand";

interface MatchesTabFocusState {
  /** The Matches tab is the screen in front right now. */
  focused: boolean;
  setFocused: (focused: boolean) => void;
  /** Matches whose chat has been opened since launch, from anywhere (DUO LOCKED's Send a message,
   * a push, the tab itself). In memory only: the badge's seen set, which is stored, takes them in
   * as soon as each one is in the match list (`withOpened` in matchesBadge.ts). */
  opened: readonly string[];
  markOpened: (matchId: string) => void;
}

/**
 * What `useMatchesBadge` (in the tab layout) needs to know about where the player is looking.
 *
 * `focused` is set from the Matches tab's own useFocusEffect (and cleared by its cleanup, which
 * also runs when a chat is pushed over it): while the tab is in front, every match on it counts
 * as seen. `opened` is added to by ChatScreen when it mounts, because the usual first match never
 * passes through the tab: DUO LOCKED, Send a message, the chat, back to the deck. Without it that
 * conversation showed as "new" on the tab after the two of them had already talked.
 */
export const useMatchesTabFocus = create<MatchesTabFocusState>((set, get) => ({
  focused: false,
  setFocused: (focused) => set({ focused }),
  opened: [],
  markOpened: (matchId) => {
    if (!matchId || get().opened.includes(matchId)) return;
    set({ opened: [...get().opened, matchId] });
  },
}));
