import { useEffect, useState } from "react";

import { useSessionStore } from "@/store/session-store";

import { msUntilLabelChange, queueStateOf, type QueueState } from "./queueState";

/**
 * Whether the signed-in player is queued, and for how many more minutes, from the session
 * profile's `is_looking_now` and `looking_now_expires_at` (start_queue_up and stop_queue_up write
 * both, and `refreshProfile()` brings them in). No request of its own, so the deck header costs
 * nothing per visit.
 *
 * Re-renders only when the label would change: one timeout to the next whole minute of the time
 * left while queued, none at all while idle. Never a poll. The time is read fresh on every render,
 * so a profile that flips to queued while this was idle is right at once.
 */
export function useQueueState(): QueueState {
  const isLookingNow = useSessionStore((s) => s.profile?.is_looking_now);
  const expiresAt = useSessionStore((s) => s.profile?.looking_now_expires_at);
  const [tick, setTick] = useState(0);

  const state = queueStateOf({ isLookingNow, expiresAt, nowMs: Date.now() });
  const minutesLeft = state.kind === "queued" ? state.minutesLeft : null;
  const untilMs = state.kind === "queued" ? state.untilMs : null;

  useEffect(() => {
    if (minutesLeft === null || untilMs === null) return;
    const now = Date.now();
    const delay = msUntilLabelChange({ kind: "queued", minutesLeft, untilMs }, now);
    if (delay === null) return;
    const timer = setTimeout(() => setTick((n) => n + 1), delay);
    return () => clearTimeout(timer);
    // `tick` re-arms the timer when it fired a hair early and the label did not change.
  }, [minutesLeft, untilMs, tick]);

  return state;
}
