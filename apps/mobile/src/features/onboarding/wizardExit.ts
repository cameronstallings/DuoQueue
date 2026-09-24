/**
 * The wording of the onboarding wizard's way out, kept apart from WizardStep.tsx so the copy is
 * testable without a renderer.
 *
 * The link used to say "Sign out" and lead to a sheet that could only sign out. It now also
 * offers "Delete this sign-in" (see features/auth/deleteThisSignIn.ts), and the link says so:
 * a reviewer looking for account deletion on an unfinished profile should not have to guess
 * that it hides behind a button labelled for something else.
 */
export const WIZARD_EXIT_LINK_LABEL = "Sign out or delete";

export const WIZARD_EXIT_SHEET = {
  title: "Leave setup?",
  message:
    "Your profile is not finished yet. Sign out to pick up where you left off later, or delete this sign-in to remove the account.",
  keepGoing: "Keep going",
  signOut: "Sign out",
} as const;
