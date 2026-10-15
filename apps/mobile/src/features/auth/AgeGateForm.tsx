import { useEffect, useState, type ReactNode } from "react";
import { Platform, Text } from "react-native";
import Animated from "react-native-reanimated";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MIN_AGE } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/ScreenContainer";
import { hapticError } from "@/lib/haptics";
import { layoutTransition, quickEntering, quickExiting } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { checkDob, dobProblemMessage, fromIsoDate, toIsoDate } from "./completeSignup";

/**
 * How far `latestAllowedDob` may walk. Three steps is the true maximum, and the third is only
 * reachable in a specific corner: a device east of UTC after local midnight (one day), landing
 * on a February that is 28 days long in the year picked but 29 in the year the birthdate falls
 * in (two more). Six is headroom, not a guess. Exhausting it cannot open the gate — every step
 * moves the cutoff OLDER, so a bound that ran out would be stricter than the validator, never
 * looser.
 */
const MAX_CUTOFF_STEPS = 6;

/**
 * The latest birthdate that still passes the gate — asked of `checkDob`, the validator this
 * form actually submits to, rather than worked out a third time.
 *
 * The picker needs this twice: as `maximumDate`, and as the value the wheel opens on. Both have
 * to agree with `checkDob` EXACTLY, because Continue hands the picked date straight to it. A
 * date the picker itself offered as its maximum coming back as "You must be 18 or older" is the
 * first tap of the first screen of the app looking broken.
 *
 * The obvious `setFullYear(getFullYear() - MIN_AGE)` disagrees with it two ways:
 *
 *   - `checkDob` reads today in UTC. Built from LOCAL fields, the cutoff sits one day past the
 *     UTC one on any device east of UTC after local midnight — and that day is also the wheel's
 *     default, so the rejection arrives without the user having moved anything.
 *   - February 29 has no counterpart eighteen years back, so `setFullYear` rolls forward to
 *     March 1, a day too generous. `checkDob` clamps the other way, as Postgres does.
 *
 * So no arithmetic is repeated here. A local-calendar guess, deliberately nudged a day late so
 * the search only ever walks backwards, seeds it; `checkDob` decides where the boundary is. It
 * is monotone in the date — every older date it accepts, it keeps accepting — so walking toward
 * older terminates on the first acceptance, and that first acceptance is the maximum.
 */
function latestAllowedDob(minAge: number, now: Date): Date {
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  candidate.setFullYear(candidate.getFullYear() - minAge);

  for (let step = 0; step < MAX_CUTOFF_STEPS; step += 1) {
    if (checkDob(toIsoDate(candidate), minAge, now) === null) break;
    candidate.setDate(candidate.getDate() - 1);
  }

  return candidate;
}

interface AgeGateFormProps {
  title: string;
  blurb: string;
  submitLabel: string;
  loading?: boolean;
  /** A failure from the caller's own submit (the RPC, mostly). Local date problems are ours. */
  error?: string | null;
  onSubmit: (dobIso: string) => void;
  /**
   * Anything that has to be READ BEFORE the button is pressed, rendered directly above it.
   * The post-auth gate puts the Terms and Privacy Policy line here, because on that screen
   * Continue is the tap that creates the account -- the same position sign-up.tsx uses for the
   * same sentence. The pre-auth gate has nothing to put here: it only navigates, and the terms
   * are shown on the sign-up screen it navigates to.
   */
  consent?: ReactNode;
  /** Anything the screen wants under the button: another way in, or a way out. */
  children?: ReactNode;
  /** A back chevron (the pre-auth gate, pushed from the front door). */
  showBack?: boolean;
  /**
   * A date the player already confirmed (YYYY-MM-DD), put back on the wheel. Only ever passed for
   * a draft started in THIS launch (`canShowDraftDob`); never shown back from an earlier one.
   * Clamped to the latest allowed date.
   */
  initialDob?: string | null;
}

/**
 * The age gate itself, shared by the two screens that ask the question.
 *
 * There are two now, because there are two ways in. The email path asks BEFORE the account
 * exists and carries the answer into sign-up as metadata. The Apple path cannot: an identity
 * token has no birthdate, so the account authenticates first and the same question is asked
 * after, by `complete_signup`. Same wheel, same copy, same floor; only what happens on Continue
 * differs, which is the one thing each screen supplies.
 *
 * It is shared rather than duplicated because of the picker configuration below, which was
 * arrived at the hard way and should not be re-derived by whoever writes the second screen.
 */
export function AgeGateForm({
  title,
  blurb,
  submitLabel,
  loading,
  error,
  onSubmit,
  consent,
  children,
  showBack,
  initialDob,
}: AgeGateFormProps) {
  const { colors, scheme, spacing, type } = useTheme();
  // Recomputed on render, not once at import. An app left open past midnight kept yesterday's
  // cutoff, which refuses somebody who turned 18 overnight the moment they reach for the wheel.
  // The cost is a handful of date comparisons on a screen that re-renders only when the wheel
  // moves. The default the wheel opens on is a copy, so the picker owns its own Date from here.
  const maxDob = latestAllowedDob(MIN_AGE, new Date());
  const [dob, setDob] = useState<Date>(() => {
    const confirmed = fromIsoDate(initialDob);
    return confirmed && confirmed.getTime() <= maxDob.getTime() ? confirmed : new Date(maxDob.getTime());
  });
  const [localError, setLocalError] = useState<string | null>(null);

  // The caller's own failure (the RPC, mostly) buzzes when it arrives. A local problem buzzes in
  // handleContinue instead, so the same refusal twice is felt twice.
  useEffect(() => {
    if (error) hapticError();
  }, [error]);

  function handleContinue() {
    const iso = toIsoDate(dob);
    const problem = checkDob(iso, MIN_AGE);
    if (problem) {
      hapticError();
      setLocalError(dobProblemMessage(problem, MIN_AGE));
      return;
    }
    setLocalError(null);
    onSubmit(iso);
  }

  // Mutually exclusive in practice: a local problem means we never called onSubmit, and calling
  // onSubmit clears it. Local first anyway, since it is the newer of the two.
  const shownError = localError ?? error ?? null;

  return (
    <ScreenContainer showBack={showBack}>
      <Logo width={56} />
      <Text style={[type.screenTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing.md }]}>{blurb}</Text>

      {/* This is a NATIVE view, so it does not inherit the app's theme — left alone it
          follows the DEVICE's appearance. A phone in dark mode rendered near-white
          wheel text onto Paper's light background, which is how the birthdate ended up
          practically invisible. themeVariant pins the picker to the app's scheme, and
          textColor pins the iOS spinner's wheel text to our own ink. Both are iOS-only;
          Android's `default` display opens a system dialog that themes itself. */}
      <DateTimePicker
        value={dob}
        mode="date"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        themeVariant={scheme === "dark" ? "dark" : "light"}
        textColor={colors.text}
        maximumDate={maxDob}
        onChange={(_event, selected) => selected && setDob(selected)}
      />

      {shownError ? (
        <Animated.Text
          key={shownError}
          entering={quickEntering()}
          exiting={quickExiting()}
          layout={layoutTransition()}
          style={[type.caption, { color: colors.danger }]}
        >
          {shownError}
        </Animated.Text>
      ) : null}

      {/* On a layout transition, so the line above arriving or leaving moves the button instead
          of making it jump. */}
      <Animated.View layout={layoutTransition()} style={{ gap: spacing.md }}>
        {consent}

        <Button label={submitLabel} onPress={handleContinue} loading={loading} />

        {children}
      </Animated.View>
    </ScreenContainer>
  );
}
