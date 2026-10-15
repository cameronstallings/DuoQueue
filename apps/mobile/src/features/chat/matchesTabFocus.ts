import { create } from "zustand";

/**
 * Whether the Matches tab is the screen in front right now. Set from the tab's own
 * useFocusEffect (and cleared by its cleanup, which also runs when a chat is pushed over it), and
 * read by `useMatchesBadge` in the tab layout: while the tab is in front, every match on it counts
 * as seen.
 */
export const useMatchesTabFocus = create<{ focused: boolean; setFocused: (focused: boolean) => void }>((set) => ({
  focused: false,
  setFocused: (focused) => set({ focused }),
}));
