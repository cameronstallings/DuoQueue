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
      // A Supabase query only goes out when something awaits it or calls .then(). The bare
      // `void supabase.rpc("heartbeat")` this used to be built the request and dropped it, so
      // no heartbeat was ever sent and last_active_at stopped moving after 2 Oct 2026.
      supabase.rpc("heartbeat").then(({ error }) => {
        if (error) console.warn("Heartbeat failed:", error.message);
      });
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
