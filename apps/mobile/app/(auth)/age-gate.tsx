import { router } from "expo-router";

import { AgeGateForm } from "@/features/auth/AgeGateForm";
import { CompleteSignupScreen } from "@/features/auth/CompleteSignupScreen";
import { AGE_GATE_COPY } from "@/features/auth/frontDoorCopy";
import { useSessionRoute } from "@/features/auth/useSessionRoute";
import { canShowDraftDob } from "@/features/onboarding/commitDraft";
import { LAUNCH_STARTED_AT, useOnboardingStore } from "@/store/onboarding-store";

/**
 * The age gate, FIRST (Cameron's order, 15 Oct: age gate, intro, build your card, Save your card,
 * the deck). "Get started" on the front door comes straight here, before anything else is asked
 * or shown, and before any real player is visible.
 *
 * No account exists yet (1.0.2 builds the card signed out, D1), so the answer goes into the
 * signup draft, persisted on the phone, and the 18+ rule is still enforced on the server when the
 * account is made at "Save your card": as signUp metadata for `handle_new_user` on the email path,
 * and as `complete_signup(p_dob)` for Apple. Under 18 is refused here, locally, by the same
 * `checkDob` the server mirrors.
 *
 * Apple is no longer offered on this screen (D2): Continue with Apple is the first button on Save
 * your card and on "I already have an account".
 *
 * The date goes back on the wheel only for a draft started in THIS launch: a draft resumed from
 * an earlier launch (a lent phone) never shows its date of birth.
 */
export default function AgeGate() {
  const route = useSessionRoute();
  const ageConfirmedDob = useOnboardingStore((s) => s.ageConfirmedDob);
  const draftStartedAt = useOnboardingStore((s) => s.draftStartedAt);
  const setAgeConfirmedDob = useOnboardingStore((s) => s.setAgeConfirmedDob);

  // Belt and braces. (auth)/_layout.tsx redirects a signed-in session to "/" before this
  // renders, so this branch is normally unreachable, but the mode is decided by the account's
  // actual state rather than by which file the user happens to be in: if that guard ever
  // changes, an authenticated visitor with no profile gets the gate that can finish their
  // account instead of a draft for an account that already exists.
  if (route === "complete-signup") return <CompleteSignupScreen />;

  const initialDob = canShowDraftDob({ draftStartedAt, launchStartedAt: LAUNCH_STARTED_AT }) ? ageConfirmedDob : null;

  return (
    <AgeGateForm
      title={AGE_GATE_COPY.title}
      blurb={AGE_GATE_COPY.blurb}
      submitLabel={AGE_GATE_COPY.submit}
      showBack
      initialDob={initialDob}
      onSubmit={(dobIso) => {
        setAgeConfirmedDob(dobIso);
        router.push("/(onboarding)/intro");
      }}
    />
  );
}
