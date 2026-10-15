import { useCallback, useEffect } from "react";

import { useOnAppResume } from "@/hooks/useOnAppResume";

import { checkAppStatus, type GateReason, useUpdateGateStore } from "./updateGateStore";

/**
 * Whether the "Update DuoQueue" screen is up, for the root layout.
 *
 * Checks the status file once at mount (in parallel with the session restore; it never holds the
 * launch intro) and again on every resume. The store's throttle turns that into at most once an
 * hour while the app is open, and every resume while blocked, so a phone freed by lowering
 * minVersion is freed the next time it comes back to the foreground.
 */
export function useUpdateGate(): { blocked: boolean; reason: GateReason | null } {
  const blocked = useUpdateGateStore((s) => s.blocked);
  const reason = useUpdateGateStore((s) => s.reason);

  useEffect(() => {
    void checkAppStatus();
  }, []);

  const onResume = useCallback(() => {
    void checkAppStatus();
  }, []);
  useOnAppResume(onResume);

  return { blocked, reason };
}
