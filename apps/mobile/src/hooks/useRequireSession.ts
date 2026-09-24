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
 *
 * ============================================================================
 * IT ALSO HAS TO ASK ABOUT THE PROFILE NOW
 * ============================================================================
 *
 * A session used to imply a profile, so `status` alone was the whole question. Sign in with
 * Apple ended that: the account authenticates first and the age gate runs after, so there is a
 * real window in which a valid `authenticated` JWT exists with no profiles row behind it. The
 * three layouts learned that state; these twenty screens are the ones that belong to none of
 * them, and one edit here closes all of them at once.
 *
 * What it prevents concretely: `duoqueue://chat/<id>`, `duoqueue://paywall` or any other
 * root-level deep link tapped by somebody who has not yet given a date of birth, rendering a
 * screen whose every query names a profile that does not exist. On an 18+ app that is the age
 * gate being walked around rather than failed.
 *
 * ONLY "missing" REDIRECTS. "unknown" and "error" say nothing about whether a row exists — one
 * is a read still in flight, the other is a read that failed — and acting on either is how a
 * dropped request on a subway platform ejects a long-standing user out of the chat they were
 * reading and onto "Confirm your age". The store retries a failed read on a timer, so waiting
 * resolves itself.
 *
 * "/" rather than a named screen, because that is the one address every layout guard in this
 * app already agrees to send a profile-less session to, and app/index.tsx renders the age gate
 * there. See CompleteSignupScreen for why it cannot be a route of its own.
 */
export function useRequireSession() {
  const status = useSessionStore((s) => s.status);
  const profileStatus = useSessionStore((s) => s.profileStatus);

  useEffect(() => {
    if (status === "signed_out") {
      router.replace("/(auth)/sign-in");
      return;
    }
    if (status === "signed_in" && profileStatus === "missing") {
      router.replace("/");
    }
  }, [status, profileStatus]);

  return status;
}
