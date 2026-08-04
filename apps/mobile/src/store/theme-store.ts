import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "duoqueue.theme-preference";

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: "dark",
  setPreference: (preference) => {
    set({ preference });
    void AsyncStorage.setItem(STORAGE_KEY, preference);
  },
}));

/** Loads the saved preference once at app startup — call from the root layout. Dark is Volt's default; "system"/"light" remain user choices via Settings → Appearance. */
export async function loadThemePreference(): Promise<void> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") {
    useThemeStore.setState({ preference: saved });
  }
}
