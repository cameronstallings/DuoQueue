export const ONBOARDING_STEPS = [
  "display-name",
  "gender",
  "region",
  "languages",
  "platforms",
  "games",
  "shows",
  "playstyles",
  "prompts",
  "discord",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function nextStepPath(current: OnboardingStep): string {
  const index = ONBOARDING_STEPS.indexOf(current);
  const next = ONBOARDING_STEPS[index + 1];
  return next ? `/(onboarding)/${next}` : "/(tabs)";
}
