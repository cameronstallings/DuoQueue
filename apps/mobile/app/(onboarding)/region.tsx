import { useMemo, useState } from "react";
import Animated from "react-native-reanimated";
import * as Localization from "expo-localization";
import { router } from "expo-router";
import { REGIONS } from "@duoqueue/shared-types";

import { ChipSelect } from "@/components/ChipSelect";
import { REGION_COPY, regionTitle } from "@/features/auth/frontDoorCopy";
import { firstName } from "@/features/onboarding/commitDraft";
import { isOutsideNa, regionFromTimeZone } from "@/features/onboarding/localePrefill";
import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";
import { layoutTransition, quickEntering, quickExiting } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

/**
 * Step 2: where the player plays from, usually already chosen from the phone's time zone (the
 * intro's prefill, localePrefill.ts), and said so: the "we guessed" line shows only while the
 * answer is still the guess.
 *
 * THE HONEST LINE. Outside North America the deck is thin today, and a player in Europe deserves
 * to hear that before building a whole card, not after an empty deck. Said plainly, under the
 * chips, and only when it applies.
 */
export default function RegionStep() {
  const { colors, spacing, type } = useTheme();
  const region = useOnboardingStore((s) => s.region);
  const setRegion = useOnboardingStore((s) => s.setRegion);
  const displayName = useOnboardingStore((s) => s.displayName);
  const devicePrefilled = useOnboardingStore((s) => s.devicePrefilled);
  const [error, setError] = useState<string | null>(null);

  const guess = useMemo(() => regionFromTimeZone(Localization.getCalendars()[0]?.timeZone), []);
  const showGuessLine = devicePrefilled && region !== null && region === guess;

  function handleContinue() {
    if (!region) {
      setError("Select your region to continue.");
      return;
    }
    setError(null);
    router.push(nextStepPath("region"));
  }

  return (
    <WizardStep
      step="region"
      title={regionTitle(firstName(displayName))}
      subtitle={showGuessLine ? REGION_COPY.prefilledSubtitle : undefined}
      onContinue={handleContinue}
      error={error}
    >
      <Animated.View layout={layoutTransition()} style={{ gap: spacing.md }}>
        <ChipSelect
          options={REGIONS.map((value) => ({ value, label: REGION_LABELS[value] }))}
          selected={region ? [region] : []}
          onToggle={setRegion}
        />
        {isOutsideNa(region) ? (
          <Animated.Text
            entering={quickEntering()}
            exiting={quickExiting()}
            style={[type.caption, { color: colors.textMuted }]}
          >
            {REGION_COPY.outsideNa}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </WizardStep>
  );
}
