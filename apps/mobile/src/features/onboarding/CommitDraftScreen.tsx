import { useEffect } from "react";
import { Alert, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { COMMIT_COPY, commitWelcome } from "@/features/auth/frontDoorCopy";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useCommitStore } from "@/store/commit-store";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { CardPreview } from "./CardPreview";

/**
 * "Saving your card": the commit (store/commit-store.ts), drawn.
 *
 * RENDERED BY app/index.tsx, NEVER PUSHED, like CompleteSignupScreen and for the same reason:
 * every guard sends a session whose draft is being committed to "/", so the screen has to live
 * at the end of that arrow. The store owns the work; this only starts it (once, when idle) and
 * draws its phase. No spinner: the card's own shape pulses while it saves.
 *
 * Haptics: one success when the card is saved, one error when it is not (the map in
 * lib/haptics.ts). Each fires on entering its phase, so a re-render never repeats it.
 */
export function CommitDraftScreen() {
  const { colors, spacing, type } = useTheme();
  const phase = useCommitStore((s) => s.phase);
  const error = useCommitStore((s) => s.error);
  const welcomeName = useCommitStore((s) => s.welcomeName);
  const run = useCommitStore((s) => s.run);
  const retry = useCommitStore((s) => s.retry);

  // Once, on mount. A run that already finished (idle again after the returning path, say) is
  // not restarted by a re-render; the route moves on instead.
  useEffect(() => {
    if (useCommitStore.getState().phase === "idle") void run();
  }, [run]);

  useEffect(() => {
    if (phase === "welcome") hapticSuccess();
    if (phase === "error") hapticError();
  }, [phase]);

  // The draft goes FIRST, while the "error" phase still holds this screen up. Sign-out flips the
  // route to signed-out before it resets the draft itself (after the purchases log-out), and in
  // that gap a draft with a DOB answers "draft": "/" would send the player through Save on the
  // way to the front door. The phase is dropped by the commit store once the session has gone.
  function signOutAndClear() {
    useOnboardingStore.getState().discardDraft();
    void useSessionStore.getState().signOut();
  }

  function confirmSignOut() {
    Alert.alert(COMMIT_COPY.signOutTitle, COMMIT_COPY.signOutMessage, [
      { text: COMMIT_COPY.cancel, style: "cancel" },
      { text: COMMIT_COPY.signOut, style: "destructive", onPress: signOutAndClear },
    ]);
  }

  return (
    <ScreenContainer atmosphere="match">
      {phase === "welcome" || phase === "done" ? (
        <Animated.View key="welcome" entering={revealEntering()} style={{ gap: spacing.sm, paddingTop: spacing.xl }}>
          <Text style={[type.heroTitle, { color: colors.text }]}>{commitWelcome(welcomeName)}</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>{COMMIT_COPY.saved}</Text>
        </Animated.View>
      ) : phase === "error" ? (
        <Animated.View key="error" entering={revealEntering()} style={{ gap: spacing.md, paddingTop: spacing.xl }}>
          <Text style={[type.heroTitle, { color: colors.text }]}>{COMMIT_COPY.errorTitle}</Text>
          {error ? <Text style={[type.body, { color: colors.textMuted }]}>{error}</Text> : null}
          <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
            <Button label={COMMIT_COPY.retry} onPress={retry} />
            <Button label={COMMIT_COPY.signOut} variant="ghost" onPress={confirmSignOut} />
          </View>
        </Animated.View>
      ) : (
        <Animated.View key="running" entering={revealEntering()} style={{ gap: spacing.md, paddingTop: spacing.xl }}>
          <View style={{ gap: spacing.sm }}>
            <Text style={[type.heroTitle, { color: colors.text }]}>{COMMIT_COPY.runningTitle}</Text>
            <Text style={[type.body, { color: colors.textMuted }]}>{COMMIT_COPY.runningBody}</Text>
          </View>
          <CardPreview loading />
        </Animated.View>
      )}
    </ScreenContainer>
  );
}
