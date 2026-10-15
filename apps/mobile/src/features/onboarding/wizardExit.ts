// Relative, so wizardExit.test.ts runs it as itself.
import { START_OVER_SHEET, WIZARD_COPY } from "../auth/frontDoorCopy";

/**
 * The wording of the onboarding wizard's way out, kept apart from WizardStep.tsx so the copy is
 * testable without a renderer.
 *
 * SIGNED IN (an Apple-first account with an unfinished card). The link used to say "Sign out" and
 * lead to a sheet that could only sign out. It now also offers "Delete this sign-in" (see
 * features/auth/deleteThisSignIn.ts), and the link says so: a reviewer looking for account
 * deletion on an unfinished profile should not have to guess that it hides behind a button
 * labelled for something else.
 *
 * SIGNED OUT (1.0.2: the card is built before the account exists). There is no account to sign
 * out of or delete, only a draft on the phone, so the way out is "Start over": it clears the draft
 * (every answer, the DOB and the kept picture) after a confirm, and the guards then route to the
 * front door. The same sentences as the front door's own "Start over" (START_OVER_SHEET).
 */
export const WIZARD_EXIT_LINK_LABEL = "Sign out or delete";

export const WIZARD_EXIT_SHEET = {
  title: "Leave setup?",
  message:
    "Your profile is not finished yet. Sign out to pick up where you left off later, or delete this sign-in to remove the account.",
  keepGoing: "Keep going",
  signOut: "Sign out",
} as const;

export const WIZARD_START_OVER_LINK_LABEL = WIZARD_COPY.startOver;

export const WIZARD_START_OVER_SHEET = START_OVER_SHEET;
