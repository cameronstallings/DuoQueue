import { useEffect } from "react";
import { AppState } from "react-native";

/**
 * Runs `onResume` each time the app comes back to the foreground, never on mount. Pass a
 * stable callback (useCallback): the listener is re-attached whenever it changes.
 */
export function useOnAppResume(onResume: () => void): void {
  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && previous !== "active") onResume();
      previous = next;
    });
    return () => subscription.remove();
  }, [onResume]);
}
