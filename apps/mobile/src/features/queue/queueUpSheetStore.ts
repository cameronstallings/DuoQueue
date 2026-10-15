import { create } from "zustand";

/**
 * Whether the deck's Queue Up sheet is open. A store rather than state in the deck screen,
 * because three things open it (the header pill, the empty deck's Queue up, nothing else needs
 * to know which) and two things read it (the sheet itself, and the Duo Pops card, which never
 * shows over it). The Pop card and Online Now open their own local sheet instead.
 */
interface QueueUpSheetState {
  visible: boolean;
  open: () => void;
  close: () => void;
}

export const useQueueUpSheetStore = create<QueueUpSheetState>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));
