import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";

import { type SessionRoute, sessionRoute } from "./sessionRouting";

/**
 * THE way a guard asks where this session belongs. It reads the session store and the draft in
 * one place and hands both to `sessionRoute`, so no guard can forget the draft (the input's
 * `draft` is required for exactly that reason) and every guard gets the same answer in the same
 * render. Call it unconditionally, with the other hooks.
 */
export function useSessionRoute(): SessionRoute {
  const status = useSessionStore((s) => s.status);
  const profileStatus = useSessionStore((s) => s.profileStatus);
  const onboardingCompleted = useSessionStore((s) => s.profile?.onboarding_completed);
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const ageConfirmed = useOnboardingStore((s) => s.ageConfirmedDob !== null);
  const commitPending = useOnboardingStore((s) => s.commitPending);

  return sessionRoute({
    status,
    profileStatus,
    onboardingCompleted,
    draft: { hydrated, ageConfirmed, commitPending },
  });
}
