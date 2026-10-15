import { PASSWORD_MIN_LENGTH } from "./passwordPolicy";

/**
 * Every sentence an auth call's failure can put on screen, and the rules for which one.
 *
 * WHY THE MESSAGE IS NEVER READ. GoTrue's messages are written for developers ("User already
 * registered", "Database error saving new user", "Token has expired or is invalid") and some of
 * them say more than a screen should: a 500 on sign-up is how a banned email surfaces, and a
 * distinguishable sign-in failure is an account oracle. So `authFailureOf` reads only the three
 * fields auth-js gives every error (code, status, name), and every screen picks its line from
 * AUTH_COPY through one of the functions below. A raw message can never reach the screen, because
 * nothing here ever holds one.
 *
 * Pure (one relative import), so every code is pinned in authErrors.test.ts.
 */

export interface AuthFailure {
  code?: string;
  status?: number;
  name?: string;
}

export const AUTH_COPY = {
  enterEmail: "Enter the email you signed up with.",
  enterCode: "Enter the 6-digit code from your email.",
  codeFailed: "That code didn't work. Check the newest email, or send a new code.",
  samePassword: "That's already your password. Pick a different one, or keep your old one.",
  rateLimited: "Too many tries. Wait a minute, then try again.",
  network: "Can't reach DuoQueue. Check your connection and try again.",
  invalidEmail: "Enter a valid email address.",
  captcha: "Please complete the verification check again.",
  signUpFailed: "We couldn't create that account. Please try again.",
  generic: "Something went wrong. Please try again.",
  signInFailed: "That email and password didn't work.",
  existingAccount: "You already have an account with this email.",
  // The server's own policy refused a password the client let through. Both policy rules in one
  // line, since a refusal here cannot say which one it was.
  weakPassword: `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include a lowercase letter, an uppercase letter, and a number.`,
} as const;

/** Code, status and name of whatever an auth call threw. Never the message. */
export function authFailureOf(err: unknown): AuthFailure {
  if (typeof err !== "object" || err === null) return {};
  const raw = err as { code?: unknown; status?: unknown; name?: unknown };
  const out: AuthFailure = {};
  if (typeof raw.code === "string") out.code = raw.code;
  if (typeof raw.status === "number") out.status = raw.status;
  if (typeof raw.name === "string") out.name = raw.name;
  return out;
}

/** auth-js throws AuthRetryableFetchError (status 0) when the request never got an answer. */
export function isNetworkFailure(f: AuthFailure): boolean {
  return f.name === "AuthRetryableFetchError" || f.status === 0;
}

function isRateLimited(f: AuthFailure): boolean {
  return f.code === "over_email_send_rate_limit" || f.code === "over_request_rate_limit" || f.status === 429;
}

function isInvalidEmail(f: AuthFailure): boolean {
  return f.code === "email_address_invalid" || f.code === "validation_failed";
}

export type SignUpOutcome = { kind: "existing-account" } | { kind: "message"; message: string };

/**
 * `signUp` on "Save your card". An existing email is its own outcome (the screen offers "Sign in
 * instead" with the draft kept); with `mailer_autoconfirm` on, GoTrue answers it with 422
 * `user_already_exists`. Everything unrecognised, a 500 included, is the one "couldn't create"
 * line: a ban surfaces as a 500 and must read like any other failure.
 */
export function signUpOutcome(err: unknown): SignUpOutcome {
  const f = authFailureOf(err);
  if (f.code === "user_already_exists" || f.code === "email_exists") return { kind: "existing-account" };
  if (isNetworkFailure(f)) return { kind: "message", message: AUTH_COPY.network };
  if (f.code === "weak_password") return { kind: "message", message: AUTH_COPY.weakPassword };
  if (isInvalidEmail(f)) return { kind: "message", message: AUTH_COPY.invalidEmail };
  if (isRateLimited(f)) return { kind: "message", message: AUTH_COPY.rateLimited };
  if (f.code === "captcha_failed") return { kind: "message", message: AUTH_COPY.captcha };
  return { kind: "message", message: AUTH_COPY.signUpFailed };
}

/**
 * `resetPasswordForEmail`. Null means "show the neutral sent copy", which is also what hides
 * whether an account uses that email: only failures that say nothing about any account (a rate
 * limit, the network, a malformed address, a failed bot check) get a line of their own.
 */
export function resetRequestOutcome(err: unknown): string | null {
  if (err === null || err === undefined) return null;
  const f = authFailureOf(err);
  if (isNetworkFailure(f)) return AUTH_COPY.network;
  if (isRateLimited(f)) return AUTH_COPY.rateLimited;
  if (isInvalidEmail(f)) return AUTH_COPY.invalidEmail;
  if (f.code === "captcha_failed") return AUTH_COPY.captcha;
  return null;
}

/** `verifyOtp({ type: "recovery" })`. GoTrue answers a wrong or expired code with 403 `otp_expired`. */
export function verifyRecoveryMessage(err: unknown): string {
  const f = authFailureOf(err);
  if (isNetworkFailure(f)) return AUTH_COPY.network;
  if (isRateLimited(f)) return AUTH_COPY.rateLimited;
  if (f.code === "otp_expired" || f.status === 403) return AUTH_COPY.codeFailed;
  return AUTH_COPY.generic;
}

export type UpdatePasswordOutcome = { kind: "same-password" } | { kind: "message"; message: string };

/** `updateUser({ password })` after a recovery code worked. */
export function updatePasswordOutcome(err: unknown): UpdatePasswordOutcome {
  const f = authFailureOf(err);
  if (f.code === "same_password") return { kind: "same-password" };
  if (isNetworkFailure(f)) return { kind: "message", message: AUTH_COPY.network };
  if (f.code === "weak_password") return { kind: "message", message: AUTH_COPY.weakPassword };
  if (isRateLimited(f)) return { kind: "message", message: AUTH_COPY.rateLimited };
  return { kind: "message", message: AUTH_COPY.generic };
}

/**
 * `signInWithPassword`. One line for every credential failure, whichever it was (a wrong
 * password, an unknown email, an unconfirmed or banned account), so the form can never be used
 * to learn whether an account exists. Only an unreachable server says so, which is about the
 * phone, not about anybody's account.
 */
export function signInMessage(err: unknown): string {
  const f = authFailureOf(err);
  if (isNetworkFailure(f)) return AUTH_COPY.network;
  return AUTH_COPY.signInFailed;
}
