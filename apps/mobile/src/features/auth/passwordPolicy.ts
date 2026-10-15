/**
 * The password rules, shared by "Save your card" (sign-up) and the reset-by-code screen, so the
 * two can never ask for different things. Moved verbatim from app/(auth)/sign-up.tsx in 1.0.2.
 */

// Mirrors the Supabase Auth password policy for this project (minimum length 10, plus
// lowercase + uppercase + digit). Keeping them in sync matters: if the client is more
// permissive, the user gets a generic API error instead of a message telling them what
// to fix. Change both together.
export const PASSWORD_MIN_LENGTH = 10;

export function describePasswordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include a lowercase letter, an uppercase letter, and a number.";
  }
  return null;
}

/** The confirm field's one line. */
export function passwordsMatchProblem(password: string, confirm: string): string | null {
  return password === confirm ? null : "Passwords don't match.";
}
