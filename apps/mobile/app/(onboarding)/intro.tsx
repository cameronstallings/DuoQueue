import { useEffect } from "react";
import { Pressable, Text, useWindowDimensions } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Localization from "expo-localization";
import { Redirect, router } from "expo-router";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { INTRO_COPY, WIZARD_COPY } from "@/features/auth/frontDoorCopy";
import { languagesFromLocales, regionFromTimeZone } from "@/features/onboarding/localePrefill";
import { previousStepPath } from "@/features/onboarding/steps";
import { LockedTourPage } from "@/features/tour/TourPictures";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { listItemEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

/** The picture's share of the screen, kept between a short phone's floor and a tall one's cap. */
function pictureHeight(windowHeight: number): number {
  return Math.min(380, Math.max(260, Math.round(windowHeight * 0.42)));
}

/**
 * The intro: one screen between the age gate and the card, selling the result before asking for
 * anything (Cameron's order, 15 Oct: age gate, the dream result, build your card, save it).
 *
 * The picture is the EXAMPLE DUO LOCKED from the welcome tour (LockedTourPage: the logo mark
 * locked and the short chat with Kai), not a real player: nobody real is shown before the card
 * exists. One screen rather than a pager, so its button stays in one place (Q5).
 *
 * "Build my card" is where the phone's guesses go in: the region from the time zone and the
 * languages from the locale, once per draft and never over an answer already chosen. Asking here
 * rather than on the steps means the steps open already filled.
 *
 * Signed out only. An Apple-first account (signed in with no draft) starts the wizard at step 1.
 */
export default function Intro() {
  const { colors, radius, spacing, type } = useTheme();
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const status = useSessionStore((s) => s.status);
  const setLastStep = useOnboardingStore((s) => s.setLastStep);
  const prefillFromDevice = useOnboardingStore((s) => s.prefillFromDevice);

  useEffect(() => {
    if (status !== "signed_in") setLastStep("intro");
  }, [status, setLastStep]);

  if (status === "signed_in") return <Redirect href="/(onboarding)/display-name" />;

  function goBack() {
    // A resumed draft opens here with nothing under it; Back still goes somewhere real.
    const path = previousStepPath("intro", { signedIn: false }) ?? "/";
    if (router.canGoBack()) router.back();
    else router.replace(path);
  }

  function buildCard() {
    prefillFromDevice({
      region: regionFromTimeZone(Localization.getCalendars()[0]?.timeZone),
      languages: languagesFromLocales(Localization.getLocales()),
    });
    router.push("/(onboarding)/display-name");
  }

  return (
    <ScreenContainer atmosphere="match">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={WIZARD_COPY.back}
        onPress={goBack}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 34,
          height: 34,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.round,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="chevron-back" size={19} color={colors.text} />
      </Pressable>

      <Animated.View entering={listItemEntering(0, reduced)}>
        <LockedTourPage height={pictureHeight(height)} />
      </Animated.View>

      <Animated.View entering={listItemEntering(1, reduced)} style={{ gap: spacing.sm }}>
        <Text style={[type.heroTitle, { color: colors.text }]}>{INTRO_COPY.title}</Text>
        <Text style={[type.body, { color: colors.textMuted }]}>{INTRO_COPY.body}</Text>
      </Animated.View>

      <Animated.View entering={listItemEntering(2, reduced)} style={{ gap: spacing.sm }}>
        <Button label={INTRO_COPY.build} onPress={buildCard} />
        <Button label={INTRO_COPY.haveAccount} variant="ghost" onPress={() => router.push("/(auth)/sign-in")} />
      </Animated.View>
    </ScreenContainer>
  );
}
