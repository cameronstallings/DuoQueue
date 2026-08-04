import { useEffect } from "react";
import { router } from "expo-router";

import { useSessionStore } from "@/store/session-store";

/**
 * (auth), (onboarding), and (tabs) each redirect on `status === "signed_out"` in their
 * own layout (see (tabs)/_layout.tsx). Root-level routes registered directly on the
 * Stack in app/_layout.tsx — chat/[matchId], profile/[profileId], party/*, paywall,
 * filters, etc. — sit outside all three groups and skip that check entirely, so a
 * signed-out deep link straight into one hits RLS-denied queries with no way out.
 *
 * These are leaf screens, not layouts, so there's no `<Redirect/>` to render — this
 * mirrors the same status check via `router.replace` instead. Call it once near the
 * top of the screen; the returned status is available for optional render-gating.
 */
export function useRequireSession() {
  const status = useSessionStore((s) => s.status);

  useEffect(() => {
    if (status === "signed_out") {
      router.replace("/(auth)/sign-in");
    }
  }, [status]);

  return status;
}
