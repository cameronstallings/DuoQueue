import { type PropsWithChildren, useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DELETE_THIS_SIGN_IN_LABEL } from "@/features/auth/deleteThisSignIn";
import { stepLabel, WIZARD_COPY } from "@/features/auth/frontDoorCopy";
import { useDeleteThisSignIn } from "@/features/auth/useDeleteThisSignIn";
import { hapticError } from "@/lib/haptics";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { layoutTransition, quickEntering, quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { ONBOARDING_STEPS, type OnboardingStep, previousStepPath } from "./steps";
import {
  WIZARD_EXIT_LINK_LABEL,
  WIZARD_EXIT_SHEET,
  WIZARD_START_OVER_LINK_LABEL,
  WIZARD_START_OVER_SHEET,
} from "./wizardExit";

/** The Back slot's size: the chevron when there is somewhere to go, the same empty box when not. */
const NAV_SLOT = 34;

/**
 * The step whose screen was last in front, for this JS runtime. The wizard's Stack fades between
 * steps (onboarding/_layout.tsx), so each step mounts its own copy of the bar; this is how a new
 * copy knows whether its newest segment is NEW (grow it) or was already on screen a moment ago (a
 * Back that replaced the screen, Save's 8 of 8 after Discord's), where growing it again would look
 * like the bar emptying and refilling.
 */
let lastShownStep = 0;

function GrowingSegment({ grow }: { grow: boolean }) {
  const { colors, motion } = useTheme();
  const progress = useSharedValue(grow ? 0 : 1);

  useEffect(() => {
    if (!grow) return;
    progress.value = withTiming(1, { duration: motion.deliberate, easing: Easing.out(Easing.cubic) });
  }, [grow, progress, motion.deliberate]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return <Animated.View style={[{ flex: 1, backgroundColor: colors.volt, transformOrigin: "left" }, style]} />;
}

/**
 * Older segments are drawn filled and still; only the newest one grows, from the left, on the
 * step's first mount. Under Reduce Motion it is simply filled.
 */
function ProgressBar({ current, total }: { current: number; total: number }) {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  // Decided once, on mount: a re-render (typing, an error) must never replay it.
  const [grow] = useState(() => !reduced && current > lastShownStep);

  useFocusEffect(
    useCallback(() => {
      lastShownStep = current;
    }, [current]),
  );

  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 4, borderRadius: radius.chip, backgroundColor: colors.border, overflow: "hidden" }}
        >
          {i < current - 1 && <View style={{ flex: 1, backgroundColor: colors.volt }} />}
          {i === current - 1 && <GrowingSegment grow={grow} />}
        </View>
      ))}
    </View>
  );
}

interface WizardHeaderProps {
  /** 1-based. */
  current: number;
  total: number;
  /** Where Back goes when there is no history to pop. Null draws an empty slot of the same size. */
  backPath: string | null;
  /** Replaces "Step {n} of {total}" (Save says "Ready to save"). */
  label?: string;
}

/**
 * The header every card-building screen shares: Back, the progress bar and the step label. It is
 * identical from step to step on purpose: the Stack fades between screens, so an identical header
 * looks stationary and only the newest segment of the bar moves. The Back slot is always 34pt,
 * with or without the chevron, so the bar never shifts.
 */
export function WizardHeader({ current, total, backPath, label }: WizardHeaderProps) {
  const { colors, radius, spacing, type } = useTheme();

  function goBack() {
    if (backPath === null) return;
    // A resumed draft opens on its step with nothing under it; Back still goes somewhere real.
    if (router.canGoBack()) router.back();
    else router.replace(backPath);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        {backPath !== null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={WIZARD_COPY.back}
            onPress={goBack}
            hitSlop={8}
            style={({ pressed }) => ({
              width: NAV_SLOT,
              height: NAV_SLOT,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.round,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={19} color={colors.text} />
          </Pressable>
        ) : (
          <View style={{ width: NAV_SLOT, height: NAV_SLOT }} />
        )}
        <ProgressBar current={current} total={total} />
      </View>
      <Text style={[type.tick, { color: colors.textMuted }]}>{label ?? stepLabel(current, total)}</Text>
    </View>
  );
}

interface WizardStepProps extends PropsWithChildren {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  onContinue: () => void;
  /** Defaults to "Continue". Discord's signed-in step says "Finish". */
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  error?: string | null;
  /** An optional step's way past it, drawn as a quiet button UNDER Continue (never in its place). */
  onSkip?: () => void;
  /** Defaults to "Skip". */
  skipLabel?: string;
}

/**
 * One step of the card wizard (1.0.2).
 *
 * THE BUTTON NEVER MOVES. Continue is always the volt button, always in the same place: the
 * ScreenContainer footer, inside the scroll view (so the keyboard never hides it), at the bottom
 * of a short screen. An optional step adds Skip UNDER it rather than relabelling it, so "the
 * button that moves me on" reads the same on every step. It fires the light haptic itself
 * (`haptic="light"`); a step never adds a second one.
 *
 * Signed out (the draft) and signed in (an Apple-first account) share every step. They differ in
 * two places: Back on step 1 (the intro, or nothing, since the account already exists) and the
 * way out (Start over, or Sign out or delete).
 */
export function WizardStep({
  step,
  title,
  subtitle,
  onContinue,
  continueLabel,
  continueDisabled,
  loading,
  error,
  onSkip,
  skipLabel,
  children,
}: WizardStepProps) {
  const { colors, spacing, type } = useTheme();
  const stepNumber = ONBOARDING_STEPS.indexOf(step) + 1;
  const signedIn = useSessionStore((s) => s.status === "signed_in");
  const signOut = useSessionStore((s) => s.signOut);
  const setLastStep = useOnboardingStore((s) => s.setLastStep);
  const discardDraft = useOnboardingStore((s) => s.discardDraft);
  const { confirmDeleteThisSignIn, deleting } = useDeleteThisSignIn();

  // Where the draft resumes after a relaunch (ignored until the stored draft has been read back).
  // On FOCUS, not on mount: Back pops to a step that is still mounted underneath, and a relaunch
  // must resume where the player actually was, not on the furthest step they had opened.
  useFocusEffect(
    useCallback(() => {
      setLastStep(step);
    }, [step, setLastStep]),
  );

  // An inline error is felt as well as seen, once each time a new one appears.
  useEffect(() => {
    if (error) hapticError();
  }, [error]);

  // The signed-in way out. (onboarding)/_layout.tsx sends anyone with a session and an unfinished
  // profile straight back here from every route, so without this a half-finished signup is a
  // closed loop: no welcome screen, no sign-in, no way to reach another account. Someone who
  // abandons onboarding on a borrowed phone, or a reviewer who makes a test account and then
  // wants the demo account back, is otherwise stuck reinstalling the app.
  //
  // It is also the only way to DELETE the account from here. Settings > Account is behind
  // the tabs layout, which is behind a finished profile, so without the third button an
  // account (an Apple one especially, since it exists before any of this was filled in) could
  // not be removed until every step had been completed. The delete goes through its own
  // confirmation before anything happens.
  function handleSignedInExit() {
    Alert.alert(WIZARD_EXIT_SHEET.title, WIZARD_EXIT_SHEET.message, [
      { text: WIZARD_EXIT_SHEET.keepGoing, style: "cancel" },
      { text: WIZARD_EXIT_SHEET.signOut, onPress: () => void signOut() },
      { text: DELETE_THIS_SIGN_IN_LABEL, style: "destructive", onPress: confirmDeleteThisSignIn },
    ]);
  }

  // The signed-out way out. There is no account yet, only the draft on this phone: clearing it
  // empties `ageConfirmedDob`, the route becomes "start", and the guards take the player to the
  // front door. Nothing here navigates.
  function handleStartOver() {
    Alert.alert(WIZARD_START_OVER_SHEET.title, WIZARD_START_OVER_SHEET.message, [
      { text: WIZARD_START_OVER_SHEET.keep, style: "cancel" },
      { text: WIZARD_START_OVER_SHEET.confirm, style: "destructive", onPress: discardDraft },
    ]);
  }

  const footer = (
    <>
      <Button
        label={continueLabel ?? WIZARD_COPY.continue}
        haptic="light"
        onPress={onContinue}
        disabled={continueDisabled || deleting}
        loading={loading}
      />
      {onSkip ? (
        <Button
          label={skipLabel ?? WIZARD_COPY.skip}
          variant="ghost"
          size="sm"
          onPress={onSkip}
          disabled={deleting || loading}
        />
      ) : null}
      <Pressable
        onPress={signedIn ? handleSignedInExit : handleStartOver}
        disabled={deleting || loading}
        hitSlop={12}
        accessibilityRole="button"
        style={({ pressed }) => ({ alignSelf: "center", paddingVertical: spacing.xs, opacity: pressed ? 0.7 : 1 })}
      >
        <Text style={[type.caption, { color: colors.textMuted }]}>
          {deleting ? "Deleting..." : signedIn ? WIZARD_EXIT_LINK_LABEL : WIZARD_START_OVER_LINK_LABEL}
        </Text>
      </Pressable>
    </>
  );

  return (
    <ScreenContainer footer={footer}>
      <WizardHeader
        current={stepNumber}
        total={ONBOARDING_STEPS.length}
        backPath={previousStepPath(step, { signedIn })}
      />

      <Animated.View entering={revealEntering()} layout={layoutTransition()} style={{ gap: spacing.md }}>
        <Text style={[type.screenTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[type.body, { color: colors.textMuted }]}>{subtitle}</Text> : null}

        <View style={{ gap: spacing.md }}>{children}</View>

        {error ? (
          <Animated.Text
            key={error}
            entering={quickEntering()}
            exiting={quickExiting()}
            layout={layoutTransition()}
            style={[type.caption, { color: colors.danger }]}
          >
            {error}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </ScreenContainer>
  );
}
