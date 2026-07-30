import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { supabase } from "@/lib/supabase";

const HEARTBEAT_INTERVAL_MS = 60_000;

/** Keeps last_active_at fresh while the app is foregrounded, instead of only touching
 * it at sign-in — needed so Online Now's "currently active" signal reflects the
 * ongoing session, not just when it started. Mounted once at the authenticated shell. */
export function useHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function beat() {
      void supabase.rpc("heartbeat");
    }
    function start() {
      beat();
      if (!intervalRef.current) {
        intervalRef.current = setInterval(beat, HEARTBEAT_INTERVAL_MS);
      }
    }
    function stop() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    if (AppState.currentState === "active") start();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else stop();
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, []);
}
