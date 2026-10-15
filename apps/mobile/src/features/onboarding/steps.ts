/**
 * The wizard's order, and the three routing answers that hang off it: forward, back, and where a
 * draft resumes.
 *
 * 1.0.2 builds the card BEFORE the account exists (see sessionRouting.ts), so the wizard now has
 * a screen in front of it (the intro, after the age gate) and one after it (Save your card), and
 * both directions depend on whether the player is signed in. Signed out, the wizard runs from
 * the intro to Save. Signed in (an Apple-first account, made on the sign-in screen with a new
 * Apple ID), it keeps 1.0.1's shape: step 1 has no Back, and Discord submits directly.
 *
 * Shows left the wizard in 1.0.2 (Profile still asks for them): 8 steps.
 */
export const ONBOARDING_STEPS = [
  "display-name",
  "region",
  "languages",
  "platforms",
  "games",
  "playstyles",
  "prompts",
  "discord",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Every screen of the signed-out draft, in order: the intro, the 8 steps, then Save. */
export type DraftStep = "intro" | OnboardingStep | "save";

export function isDraftStep(value: unknown): value is DraftStep {
  return (
    value === "intro" ||
    value === "save" ||
    (typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value))
  );
}

export function stepPath(step: DraftStep): string {
  return `/(onboarding)/${step}`;
}

export function nextStepPath(current: OnboardingStep): string {
  const index = ONBOARDING_STEPS.indexOf(current);
  const next = ONBOARDING_STEPS[index + 1];
  return next ? stepPath(next) : stepPath("save");
}

/**
 * Where Back goes when there is no history to pop (a resumed draft opens on its step with
 * nothing under it). Null means "no Back here": step 1 for a signed-in player, whose account
 * already exists and who has nowhere earlier to go.
 */
export function previousStepPath(step: DraftStep, { signedIn }: { signedIn: boolean }): string | null {
  if (step === "intro") return "/(auth)/age-gate";
  if (step === "save") return stepPath("discord");
  if (step === "display-name") return signedIn ? null : stepPath("intro");
  const index = ONBOARDING_STEPS.indexOf(step);
  const previous = ONBOARDING_STEPS[index - 1];
  return previous ? stepPath(previous) : null;
}

/**
 * Where a draft picks up: its last step. Signed out, nothing yet means the intro. Signed in,
 * the intro and Save are not part of the path (the account exists), so both mean step 1.
 */
export function wizardResumePath(lastStep: DraftStep | null, signedIn: boolean): string {
  if (signedIn) {
    if (lastStep === null || lastStep === "intro" || lastStep === "save") return stepPath("display-name");
    return stepPath(lastStep);
  }
  return stepPath(lastStep ?? "intro");
}
