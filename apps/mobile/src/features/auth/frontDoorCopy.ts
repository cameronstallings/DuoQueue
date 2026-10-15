import { MIN_AGE } from "@duoqueue/shared-types";

/**
 * Every sentence of 1.0.2's front door, late signup and password reset, in one pure module so
 * frontDoorCopy.test.ts can sweep all of it (no em or en dashes, never the banned word, no dating
 * framing, no "confirmation code"). Error lines live in authErrors.ts (AUTH_COPY) and the password
 * rules in passwordPolicy.ts; everything else a Group A screen says is here.
 *
 * Sentence case throughout: uppercase only ever comes from the type styles (type.label, type.tick,
 * type.chipText, type.cardMeta).
 */

export const FRONT_DOOR_COPY = {
  title: "Find a duo who actually shows up.",
  body: "Someone who plays your game, can queue at your rank, and talks. Teammates, not dates.",
  getStarted: "Get started",
  haveAccount: "I already have an account",
  continueCard: "Continue my card",
  startOver: "Start over",
  caption: `For players ${MIN_AGE} and older.`,
  inviteSaved: "Invite code saved.",
  inviteSavedCaption: "You'll see who sent it once you confirm your age.",
} as const;

/** The confirm Alert behind every "Start over" (front door, wizard). */
export const START_OVER_SHEET = {
  title: "Start over?",
  message: "This clears the card you've built on this phone.",
  keep: "Keep my card",
  confirm: "Start over",
} as const;

/** Unchanged from 1.0.1, ages line included (AGES STAY). */
export const AGE_GATE_COPY = {
  title: "Confirm your age",
  blurb: `DuoQueue is for players ${MIN_AGE} and older. Your date of birth is kept private. Only your age is ever shown on your profile.`,
  submit: "Continue",
} as const;

export const INTRO_COPY = {
  title: "Pick each other. Then play.",
  body: "When a player you picked picks you back, chat opens and you set up the game. Your card takes about two minutes, and nobody sees it until you save it.",
  build: "Build my card",
  haveAccount: "I already have an account",
} as const;

export const WIZARD_COPY = {
  back: "Go back",
  continue: "Continue",
  skip: "Skip",
  startOver: "Start over",
  signOutOrDelete: "Sign out or delete",
} as const;

export function stepLabel(n: number, total: number): string {
  return `Step ${n} of ${total}`;
}

export const NAME_COPY = {
  title: "Pick your player name",
  subtitle: "This is the name on your card and in chats. A picture is optional.",
  field: "Player name",
  previewLabel: "Your card",
  previewPlaceholder: "Your name",
} as const;

/** The name step's title for an Apple-first player, from the name Apple shared (D3). */
export function welcomeTitle(name: string): string {
  return `Welcome, ${name}`;
}

export const REGION_COPY = {
  title: "Where do you play from?",
  prefilledSubtitle: "We guessed from your phone's time zone. Change it if it's wrong.",
  outsideNa: "Most players are in NA right now.",
} as const;

export function regionTitle(name: string): string {
  return name ? `Nice to meet you, ${name}. Where do you play from?` : REGION_COPY.title;
}

export const LANGUAGES_COPY = {
  prefilledSubtitle: "We added your phone's language. Select all that apply.",
  subtitle: "Select all that apply.",
} as const;

export const GAMES_COPY = {
  title: "What do you play?",
  subtitle: "Tap your games, or search for more.",
  quickPicks: "Quick picks",
  searchLabel: "Search games",
  searchHint: "Type at least 2 letters. Try lol, val or r6.",
  noMatches: "No matches yet.",
  needOne: "Add at least one game.",
} as const;

export function addCustomLabel(name: string): string {
  return `Not listed? Add "${name}"`;
}

export const DISCORD_COPY = {
  title: "Add your Discord",
  subtitle: "Kept private. You choose per-match whether to share it in chat.",
  continue: "Continue",
  finish: "Finish",
  finishToast: "One more step to finish your card.",
} as const;

export const SAVE_COPY = {
  header: "Ready to save",
  title: "Save your card",
  body: "Your card is ready. Save it to start finding players. Nobody sees it until you do.",
  email: "Create an account with email",
  haveAccount: "I already have an account",
} as const;

export const SIGN_UP_COPY = {
  title: "Save your card",
  body: "Use an email and a password you'll remember. You can sign in with them on any phone.",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  submit: "Save my card",
  existingAccount: "You already have an account with this email.",
  signInInstead: "Sign in instead",
} as const;

export const SIGN_IN_COPY = {
  title: "Welcome back",
  body: "Sign in to pick up where you left off.",
  or: "or",
  email: "Email",
  password: "Password",
  forgot: "Forgot password?",
  submit: "Sign in",
  newHere: "New here? Get started",
  backToCard: "Back to my card",
} as const;

export const RESET_COPY = {
  title: "Reset your password",
  body: "Enter the email you signed up with and we'll send you a 6-digit code.",
  email: "Email",
  send: "Send code",
  codeTitle: "Check your email",
  appleLine: "Signed up with Apple? Go back and tap Continue with Apple instead.",
  code: "6-digit code",
  newPassword: "New password",
  confirmPassword: "Confirm new password",
  save: "Save new password",
  differentEmail: "Use a different email",
  setTitle: "Choose a new password",
  setBody: "Your code worked. Pick a new password to finish.",
  keepOld: "Keep my old password",
  successToast: "Password updated. You're signed in.",
} as const;

export function resetSentBody(email: string): string {
  return `If an account uses ${email}, we sent it a 6-digit code. It works for one hour.`;
}

export function resendLabel(seconds: number): string {
  return seconds > 0 ? `Send a new code in ${seconds}s` : "Send a new code";
}

export const COMMIT_COPY = {
  runningTitle: "Saving your card",
  runningBody: "This takes a few seconds.",
  saved: "Your card is saved.",
  errorTitle: "Your card isn't saved yet",
  retry: "Try again",
  signOut: "Sign out",
  signOutTitle: "Sign out?",
  signOutMessage: "The card you built on this phone will be cleared.",
  cancel: "Cancel",
  bannedTitle: "Account unavailable",
  welcomeBack: "Welcome back. This account already has a card, so we kept it as it was.",
  pictureFailed: "Your picture didn't upload. You can add it from Profile > Edit.",
} as const;

export function commitWelcome(name: string): string {
  return name ? `Welcome, ${name}.` : "Welcome.";
}

/** The dormant code screen's way out. */
export const CONFIRM_EMAIL_COPY = {
  backToStart: "Back to start",
} as const;

/** For Group R's App Review notes. */
export const REVIEW_NOTES_SENTENCE =
  'The demo account signs in from the first screen: tap "I already have an account", then enter the email and password below.';
