import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { HAPTICS_STORAGE_KEY, parseHapticsPreference, serializeHapticsPreference } from "../lib/hapticsPreference";

/**
 * The Settings > Appearance > Haptics switch. Per device (AsyncStorage, never the profile): it is
 * about this phone in this hand, and a player with two phones may well want it on one and off on
 * the other. Default ON. iOS's own Settings > Sounds & Haptics > System Haptics still applies on
 * top: with that off, the phone plays nothing whatever this says.
 *
 * Every haptic in the app reads `enabled` through `src/lib/haptics.ts` with `getState()`, so the
 * switch takes effect on the very next tap without anything re-rendering.
 */

interface HapticsState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useHapticsStore = create<HapticsState>((set) => ({
  enabled: true,
  setEnabled: (enabled) => {
    set({ enabled });
    // A failed write only means the choice is not remembered past this launch; it must never
    // surface as an unhandled rejection from a switch.
    AsyncStorage.setItem(HAPTICS_STORAGE_KEY, serializeHapticsPreference(enabled)).catch(() => {});
  },
}));

/**
 * Loads the saved switch once at app startup (the root layout calls it beside
 * `loadThemePreference`). It only ever turns haptics OFF, when the stored value says so: the
 * default is already on, and a failed or garbled read must leave it that way.
 */
export async function loadHapticsPreference(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(HAPTICS_STORAGE_KEY);
    if (!parseHapticsPreference(saved)) useHapticsStore.setState({ enabled: false });
  } catch {
    // Storage unavailable: keep the default.
  }
}
