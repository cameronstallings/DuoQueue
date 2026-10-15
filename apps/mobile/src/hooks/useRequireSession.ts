import { useEffect } from "react";
import { router } from "expo-router";

import { useSessionRoute } from "@/features/auth/useSessionRoute";
import { useSessionStore } from "@/store/session-store";

/**
 * (auth), (onboarding), and (tabs) each guard their routes in their own layout (see
 * (tabs)/_layout.tsx). Root-level routes registered directly on the Stack in app/_layout.tsx —
 * chat/[matchId], profile/[profileId], party/*, paywall, filters, etc. — sit outside all three
 * groups and skip that check entirely, so a signed-out deep link straight into one hits
 * RLS-denied queries with no way out.
 *
 * These are leaf screens, not layouts, so there's no `<Redirect/>` to render — this asks the
 * same question through `router.replace` instead. Call it once near the top of the screen; the
 * returned status is available for optional render-gating.
 *
 * ============================================================================
 * IT ASKS THE ONE ROUTING QUESTION
 * ============================================================================
 *
 * A session used to imply a profile, so `status` alone was the whole question. Sign in with
 * Apple ended that (an account can authenticate before its age gate), and 1.0.2's signup draft
 * added more states with no business on a root screen: a signed-out card in progress, and a card
 * being committed to a brand new account. Every one of them belongs at "/", which renders or
 * redirects to the right screen for it, so this reads `useSessionRoute()` like every layout and
 * sends "start", "draft", "complete-signup" and "commit-draft" there.
 *
 * What it prevents concretely: `duoqueue://chat/<id>`, `duoqueue://paywall` or any other
 * root-level deep link tapped by somebody who has not yet given a date of birth, rendering a
 * screen whose every query names a profile that does not exist. On an 18+ app that is the age
 * gate being walked around rather than failed.
 *
 * NEVER ON "hold" OR "onboarding". "hold" is a read still in flight or one that failed, and
 * acting on it is how a dropped request on a subway platform ejects a long-standing user out of
 * the chat they were reading. The store retries a failed read on a timer, so waiting resolves
 * itself. "onboarding" keeps 1.0.1's behaviour: a root screen does not eject an unfinished card.
 */
export function useRequireSession() {
  const status = useSessionStore((s) => s.status);
  const route = useSessionRoute();

  useEffect(() => {
    if (route === "start" || route === "draft" || route === "complete-signup" || route === "commit-draft") {
      router.replace("/");
    }
  }, [route]);

  return status;
}
