import { Alert, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { FRONT_DOOR_COPY, START_OVER_SHEET } from "@/features/auth/frontDoorCopy";
import { InviteBanner } from "@/features/invite/InviteBanner";
import { useOnboardingStore } from "@/store/onboarding-store";
import { listItemEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

/**
 * THE FRONT DOOR (1.0.2): the first screen of a fresh install, and where a signed-out visitor
 * with no card in progress lands.
 *
 * It states the result instead of asking for an email: "Find a duo who actually shows up." Then
 * one way in for new players, "Get started" (the age gate, first), and one for everyone else, "I
 * already have an account" (where Continue with Apple is the first button). Apple is deliberately
 * not here (D2): a new Apple player who tapped it would skip building their card.
 *
 * The invite code entry moved here from sign-up, because the card is now built before sign-up
 * exists. The inviter is NOT named here (`revealInviter={false}`): no real player is shown before
 * the age gate. The intro, Save and the arrival screen name them.
 *
 * A card in progress normally never sees this screen (the route is "draft" and "/" resumes it),
 * but Back from the age gate reaches it, so it offers "Continue my card" and "Start over" then.
 */
export default function Start() {
  const { colors, spacing, type } = useTheme();
  const reduced = useReducedMotion();
  const hasDraft = useOnboardingStore((s) => s.ageConfirmedDob !== null);
  const discardDraft = useOnboardingStore((s) => s.discardDraft);

  function confirmStartOver() {
    Alert.alert(START_OVER_SHEET.title, START_OVER_SHEET.message, [
      { text: START_OVER_SHEET.keep, style: "cancel" },
      { text: START_OVER_SHEET.confirm, style: "destructive", onPress: discardDraft },
    ]);
  }

  // Each block cascades in once, on mount; their contents can change later without replaying it.
  return (
    <ScreenContainer>
      <Animated.View entering={listItemEntering(0, reduced)} style={{ gap: spacing.md, paddingTop: spacing.xl }}>
        <Logo width={56} />
        <Text style={[type.heroTitle, { color: colors.text }]}>{FRONT_DOOR_COPY.title}</Text>
        <Text style={[type.body, { color: colors.textMuted }]}>{FRONT_DOOR_COPY.body}</Text>
      </Animated.View>

      <Animated.View entering={listItemEntering(1, reduced)}>
        <InviteBanner revealInviter={false} />
      </Animated.View>

      <Animated.View entering={listItemEntering(2, reduced)} style={{ gap: spacing.sm }}>
        {hasDraft ? (
          <>
            <Button label={FRONT_DOOR_COPY.continueCard} onPress={() => router.replace("/")} />
            <Button label={FRONT_DOOR_COPY.startOver} variant="ghost" onPress={confirmStartOver} />
          </>
        ) : (
          <>
            <Button label={FRONT_DOOR_COPY.getStarted} onPress={() => router.push("/(auth)/age-gate")} />
            <Button label={FRONT_DOOR_COPY.haveAccount} variant="ghost" onPress={() => router.push("/(auth)/sign-in")} />
          </>
        )}
      </Animated.View>

      <Animated.View entering={listItemEntering(3, reduced)}>
        <View style={{ alignItems: "center" }}>
          <Text style={[type.caption, { color: colors.textMuted }]}>{FRONT_DOOR_COPY.caption}</Text>
        </View>
      </Animated.View>
    </ScreenContainer>
  );
}
