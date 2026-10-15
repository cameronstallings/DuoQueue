import { useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import * as Localization from "expo-localization";
import { MIN_AGE } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { canShowDraftDob } from "@/features/onboarding/commitDraft";
import { LAUNCH_STARTED_AT, useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

import { AgeGateForm } from "./AgeGateForm";
import { completeSignupOutcome } from "./completeSignup";
import { DELETE_THIS_SIGN_IN_LABEL } from "./deleteThisSignIn";
import { LegalConsentNotice } from "./LegalConsentNotice";
import { clearPendingDisplayName, getPendingDisplayName } from "./pendingDisplayName";
import { useDeleteThisSignIn } from "./useDeleteThisSignIn";

/**
 * The age gate for an account that already exists.
 *
 * Sign in with Apple hands back an identity token and no birthdate, so the account is created
 * by GoTrue with no profile row behind it: `handle_new_user` will not invent a date of birth,
 * and nothing else may write one. This screen is the only thing that can finish such an
 * account, and `complete_signup` is the only gate the 18+ rule now runs through on that path.
 *
 * IT IS RENDERED BY app/index.tsx, not pushed as a route of its own. That is deliberate and
 * load-bearing: every layout guard in the app redirects to "/" for a session with no profile
 * — (auth) already bounced signed-in users there, and (tabs) and (onboarding) now do too — so
 * "/" is the one address all of them agree on. A screen inside (auth) would be redirected away
 * the instant a session existed, and index would send it straight back: a closed loop with no
 * frame in between.
 */
export function CompleteSignupScreen() {
  const completeSignup = useSessionStore((s) => s.completeSignup);
  const refreshProfile = useSessionStore((s) => s.refreshProfile);
  const signOut = useSessionStore((s) => s.signOut);
  const { colors, type } = useTheme();
  const { confirmDeleteThisSignIn, deleting } = useDeleteThisSignIn();
  const draftDob = useOnboardingStore((s) => s.ageConfirmedDob);
  const draftStartedAt = useOnboardingStore((s) => s.draftStartedAt);

  // 1.0.2: somebody who passed the pre-auth age gate and then tapped Continue with Apple on "I
  // already have an account" with a NEW Apple ID lands here minutes later. Their date is put back
  // on the wheel rather than asked from scratch, but only for a draft started in this launch: a
  // draft from an earlier launch (a lent phone) never shows its date of birth back.
  const initialDob = canShowDraftDob({ draftStartedAt, launchStartedAt: LAUNCH_STARTED_AT }) ? draftDob : null;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(dobIso: string) {
    setError(null);
    setLoading(true);
    // Same source the email path uses at sign-up, so both write the same kind of value into
    // profiles.timezone. The function launders it through is_valid_timezone() either way.
    const timezone = Localization.getCalendars()[0]?.timeZone ?? "UTC";

    try {
      // The name Apple handed back at sign-in, if this was the first authorization for that
      // Apple ID and the user shared it. Null is the ordinary case and costs nothing but a
      // prefill: `complete_signup` takes `p_display_name` as nullable, and the wizard's first
      // step asks for a display name either way. Read here rather than held in state because
      // nothing on this screen displays it — it is only ever in memory for the length of the
      // call that spends it, and it is inside the try so that no read can strand the button
      // in its loading state.
      const displayName = await getPendingDisplayName();

      await completeSignup({ dob: dobIso, timezone, displayName });
      // Spent. Clearing on the way out is what keeps the window it exists in equal to one
      // signup, and it has to happen here rather than on unmount: this screen unmounts on
      // every outcome, including the ones where a retry still needs the name.
      await clearPendingDisplayName();
      // No navigation: profileStatus flips to "loaded", index.tsx re-routes, and the wizard
      // (whose first step, now prefilled, asks for a display name) takes over.
    } catch (err) {
      const outcome = completeSignupOutcome(err, MIN_AGE);

      if (outcome.kind === "already-complete") {
        // A retry after a timeout where the first call actually committed, or a double tap.
        // The state is already correct; refreshing is the whole fix. The profile exists, so
        // the name is either already on it or can never be — nothing left to hold.
        await clearPendingDisplayName();
        await refreshProfile();
        return;
      }

      if (outcome.kind === "banned") {
        // The one outcome with nowhere to go: the session is real, and it can never have a
        // profile. Read it, then out, rather than leaving them authenticated on a dead screen.
        await clearPendingDisplayName();
        Alert.alert("Account unavailable", outcome.message, [{ text: "OK", onPress: () => void signOut() }]);
        return;
      }

      // Deliberately NOT cleared on "rejected" or "unknown". Both leave the user on this
      // screen with a live session and a button to press again, and Apple will not hand the
      // name over a second time.
      setError(outcome.message);
    } finally {
      setLoading(false);
    }
  }

  // Without this there is no way off this screen. The account exists, so signing in again with
  // the same Apple ID lands right back here, and every other route redirects to it. Somebody
  // who changes their mind, or who meant to use the account they already have, needs a door.
  function handleLeave() {
    Alert.alert(
      "Leave signup?",
      "Your profile has not been created yet. You can sign back in and finish it anytime. If you already have a DuoQueue account, sign out and sign in with your email instead.",
      [
        { text: "Keep going", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => void abandonSignup() },
      ],
    );
  }

  /**
   * The other exit, and the one that has to drop the pending display name.
   *
   * `signOut` in the session store resets everything it owns, but this value is not one of
   * those: it outlives the JS runtime on purpose, which is exactly what makes leaving it behind
   * a problem. Somebody who backs out here and hands the phone to a friend must not have their
   * name prefilled onto the friend's profile. The next Apple sign-in would overwrite or clear
   * it anyway, but "would be corrected later" is not the same as gone.
   */
  async function abandonSignup() {
    await clearPendingDisplayName();
    await signOut();
  }

  return (
    <AgeGateForm
      title="Confirm your age"
      blurb={`One last check before your profile. DuoQueue is for players ${MIN_AGE} and older. Your date of birth is kept private. Only your age is ever shown on your profile.`}
      submitLabel="Continue"
      // Held in its loading state while a deletion runs, so Continue cannot race a profile into
      // existence underneath an account that is being deleted.
      loading={loading || deleting}
      error={error}
      onSubmit={(dobIso) => void handleSubmit(dobIso)}
      initialDob={initialDob}
      // Above Continue, because Continue is the tap that creates the account. This is the ONLY
      // place an Apple signup is ever shown the terms: it never passes through sign-up.tsx,
      // where the same sentence, from the same component, has always lived.
      consent={<LegalConsentNotice />}
    >
      <Button label="Not now" variant="ghost" onPress={handleLeave} disabled={deleting} />
      {/* The account already exists at this point, so "Not now" is not the only honest exit:
          somebody who changed their mind, or a reviewer checking Guideline 5.1.1(v), can remove
          it from here without first inventing a birthday and building a profile to reach
          Settings. Muted and last, the same weight the wizard gives its own way out. */}
      <Pressable
        onPress={confirmDeleteThisSignIn}
        disabled={deleting || loading}
        hitSlop={12}
        accessibilityRole="button"
        style={{ alignSelf: "center" }}
      >
        <Text style={[type.caption, { color: colors.textMuted }]}>
          {deleting ? "Deleting..." : DELETE_THIS_SIGN_IN_LABEL}
        </Text>
      </Pressable>
    </AgeGateForm>
  );
}
