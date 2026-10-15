/**
 * Whether the player reported, blocked or unmatched someone in this JS runtime ("this session").
 * Set by the three hooks in `src/features/chat/useMatchActions.ts` (onMutate, so a report that
 * then fails still counts: the bad moment happened either way). While it is set, the rating
 * prompt never asks. Per runtime on purpose: a cold start is a fresh session.
 */

let safetyAction = false;

export function noteSafetyAction(): void {
  safetyAction = true;
}

export function hadSafetyActionThisSession(): boolean {
  return safetyAction;
}

export function resetReviewSessionForTests(): void {
  safetyAction = false;
}
