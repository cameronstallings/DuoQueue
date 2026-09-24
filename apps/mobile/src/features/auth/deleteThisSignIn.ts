/**
 * What "Delete this sign-in" says, on the two screens that offer it.
 *
 * ============================================================================
 * WHY THIS EXISTS BEFORE A PROFILE DOES
 * ============================================================================
 *
 * Settings > Account is the app's deletion door, and it sits behind the tabs layout, which sits
 * behind a finished profile. An Apple signup creates the account BEFORE the age gate, so a
 * reviewer who signs in with Apple to test deletion used to have to enter a date of birth and
 * walk ten wizard steps, two photos included, before the door appeared. Guideline 5.1.1(v)
 * expects deletion to be reachable without that, and everybody who abandons signup was otherwise
 * left with an auth user holding their Apple email, kept forever. So the post-auth age gate and
 * the wizard's exit sheet both offer it, and both call the same delete-account function Settings
 * uses; it already handles an account with no profile row.
 *
 * Pure copy, so the wording (no em dashes, the Apple heads-up only for Apple accounts) is tested
 * rather than trusted.
 */

export const DELETE_THIS_SIGN_IN_LABEL = "Delete this sign-in";

/**
 * Said before any deletion of an Apple account, here and in Settings > Account alike: the next
 * thing that account sees is Apple's own confirmation sheet (the fresh authorization code the
 * revocation needs), and a system sheet appearing out of nowhere in the middle of a deletion
 * reads like something went wrong. Saying so first is what keeps somebody from dismissing it by
 * reflex.
 */
export const APPLE_DELETION_HEADS_UP = "Apple will ask you to confirm, so DuoQueue can also be removed from your Apple ID.";

export interface DeleteThisSignInPrompt {
  title: string;
  message: string;
  cancel: string;
  confirm: string;
}

/** The confirmation shown before anything is deleted. The Apple sentence only for Apple accounts. */
export function deleteThisSignInPrompt(isAppleAccount: boolean): DeleteThisSignInPrompt {
  const base =
    "This permanently deletes the account you just signed in with, along with anything you have entered so far. It cannot be undone. You can sign up again anytime.";
  return {
    title: "Delete this sign-in?",
    message: isAppleAccount ? `${base} ${APPLE_DELETION_HEADS_UP}` : base,
    cancel: "Keep going",
    confirm: "Delete",
  };
}

/** Settings > Account's final confirmation, with the same Apple heads-up for Apple accounts. */
export function accountDeletionFinalMessage(isAppleAccount: boolean): string {
  const base = "Your account will be deleted immediately.";
  return isAppleAccount ? `${base} ${APPLE_DELETION_HEADS_UP}` : base;
}

/**
 * The sentence shown when the deletion itself fails.
 *
 * delete-account's own refusals (a banned account, a legal hold) are written for the person
 * holding the phone and arrive as a plain Error carrying the server's sentence (see
 * `deleteAccountRequest`), so they are shown as they are. supabase-js's own function errors
 * (`FunctionsFetchError`, `FunctionsRelayError`, an unparsed `FunctionsHttpError`) say things
 * like "Edge Function returned a non-2xx status code", which is a log line, so they and anything
 * that is not an Error at all get one plain sentence instead.
 */
export function deleteThisSignInFailure(err: unknown): string {
  if (err instanceof Error && !err.name.startsWith("Functions") && err.message.trim().length > 0) {
    return err.message;
  }
  return "We could not delete this sign-in. Please try again.";
}
