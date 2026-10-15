import { useEffect, useMemo } from "react";
import { Text } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { Redirect, router } from "expo-router";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppleSignInButton } from "@/features/auth/AppleSignInButton";
import { SAVE_COPY } from "@/features/auth/frontDoorCopy";
import { LegalConsentNotice } from "@/features/auth/LegalConsentNotice";
import { useSessionRoute } from "@/features/auth/useSessionRoute";
import { InviteBanner } from "@/features/invite/InviteBanner";
import { CardPreview } from "@/features/onboarding/CardPreview";
import { cardPreviewLines, firstIncompleteStep } from "@/features/onboarding/commitDraft";
import { ONBOARDING_STEPS, previousStepPath, stepPath } from "@/features/onboarding/steps";
import { WizardHeader } from "@/features/onboarding/WizardStep";
import { abortAccountEntry, beginAccountEntry } from "@/store/commit-store";
import { useOnboardingStore } from "@/store/onboarding-store";
import { listItemEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

/**
 * SAVE YOUR CARD (1.0.2): the end of the signed-out wizard, and the first moment an account is
 * asked for. Everything before this lives only on the phone (onboarding-store.ts); a tap here
 * makes the account, and the commit (commit-store.ts, rendered at "/") writes the card onto it.
 *
 * ORDER, top to bottom: the card as other players will see it (age kept), the invite (its inviter
 * named now that the age gate is behind us), then the Terms line ABOVE every button that creates
 * an account, then Continue with Apple first, email second, and "I already have an account" last.
 *
 * `beginAccountEntry` runs before Apple's sheet opens: the session `signInWithIdToken` creates
 * fires the auth listener inside the call, and the guards must already know this account is for
 * the draft, or they would route it to the post-auth age gate and ask for a birthday the draft
 * already holds (sessionRouting.ts). A cancel or a failure takes the mark back off.
 *
 * Nothing on this screen asks for a permission.
 */
export default function SaveCard() {
  const { colors, spacing, type } = useTheme();
  const reduced = useReducedMotion();
  const route = useSessionRoute();
  const draft = useOnboardingStore();
  const setLastStep = draft.setLastStep;

  const missing = firstIncompleteStep(draft);
  // Signed in (an Apple-first account) there is nothing to save to: its Discord step finishes the
  // card itself. Signed out, only a finished card that the player sent here can be saved.
  const showing = route !== "onboarding" && missing === null && draft.readyToSave;

  useEffect(() => {
    if (showing) setLastStep("save");
  }, [showing, setLastStep]);

  const preview = useMemo(() => cardPreviewLines(draft, new Date()), [draft]);

  if (route === "onboarding") return <Redirect href={stepPath("discord")} />;
  if (missing !== null) return <Redirect href={stepPath(missing)} />;
  if (!draft.readyToSave) return <Redirect href={stepPath("discord")} />;

  const footer = (
    <Animated.View entering={listItemEntering(3, reduced)} style={{ gap: spacing.sm }}>
      {/* Above the buttons, because each of the first two is the tap that creates the account. */}
      <LegalConsentNotice />
      <AppleSignInButton
        intent="continue"
        onStart={beginAccountEntry}
        onSettled={(ok) => {
          if (!ok) abortAccountEntry();
        }}
      />
      <Button label={SAVE_COPY.email} variant="secondary" onPress={() => router.push("/(auth)/sign-up")} />
      <Button label={SAVE_COPY.haveAccount} variant="ghost" onPress={() => router.push("/(auth)/sign-in")} />
    </Animated.View>
  );

  return (
    <ScreenContainer footer={footer}>
      <WizardHeader
        current={ONBOARDING_STEPS.length}
        total={ONBOARDING_STEPS.length}
        backPath={previousStepPath("save", { signedIn: false })}
        label={SAVE_COPY.header}
      />

      <Animated.View entering={listItemEntering(0, reduced)} style={{ gap: spacing.md }}>
        <Text style={[type.screenTitle, { color: colors.text }]}>{SAVE_COPY.title}</Text>
        <Text style={[type.body, { color: colors.textMuted }]}>{SAVE_COPY.body}</Text>
      </Animated.View>

      <Animated.View entering={listItemEntering(1, reduced)}>
        <CardPreview name={preview.name} details={preview.details} games={preview.games} />
      </Animated.View>

      <Animated.View entering={listItemEntering(2, reduced)}>
        <InviteBanner />
      </Animated.View>
    </ScreenContainer>
  );
}
