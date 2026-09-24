import { displayNameSchema } from "@duoqueue/shared-types";

/**
 * Filling the wizard's display-name field from the profile, once, and only into an empty field.
 *
 * ============================================================================
 * WHY THE WIZARD ASKED AGAIN
 * ============================================================================
 *
 * A Sign in with Apple user who shared their name has it stored on the profile by
 * `complete_signup` before the wizard ever opens. The onboarding store, though, started every
 * pass with `displayName: ""` and never looked at the profile, so the first step showed an empty
 * field, and the wizard's last step then wrote that field over `profiles.display_name`. The user
 * was asked for the name Apple had just handed over, and the name was thrown away if they typed
 * a different one or none. Asking for information Sign in with Apple already provided is a
 * named Guideline 4.0 rejection pattern.
 *
 * ============================================================================
 * THE RULES
 * ============================================================================
 *
 *   - Only an EMPTY field is filled. Anything the user has typed wins, always.
 *   - Only ONCE per onboarding pass. Somebody who deliberately clears the prefill and walks on
 *     must not find it back the next time the screen renders. `reset()` (sign-out) starts a new
 *     pass.
 *   - No suggestion is not the same as an empty one: while the profile has no name, nothing is
 *     marked as seeded, so a name that arrives on a later render can still land.
 *   - Only a name the wizard itself would accept. The same `displayNameSchema` Continue checks
 *     against, so the prefill can never be a value the next tap refuses.
 *
 * Email signups carry no display name at signup, so for them this is a no-op.
 */
export interface DisplayNameSeedState {
  displayName: string;
  displayNameSeeded: boolean;
}

export function displayNameSeed(
  state: DisplayNameSeedState,
  suggestion: string | null | undefined,
): Partial<DisplayNameSeedState> | null {
  if (state.displayNameSeeded) return null;
  if (typeof suggestion !== "string" || suggestion.trim().length === 0) return null;

  if (state.displayName.trim().length > 0) return { displayNameSeeded: true };

  const parsed = displayNameSchema.safeParse(suggestion);
  if (!parsed.success) return { displayNameSeeded: true };
  return { displayName: parsed.data, displayNameSeeded: true };
}
