import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "duoqueue.pending-confirmation-email";

/**
 * The email of a signup that hasn't been confirmed yet.
 *
 * Confirmation is the one point in the flow where the user has to leave the app — the
 * code is in their inbox. `signUp()` returns no session when email confirmation is on,
 * so as far as the session store is concerned they are signed out, and a cold start
 * lands them back on sign-in with no memory of the account they just created. That reads
 * as "the app forgot me", and asking them to hunt for a "confirmation code" button is a
 * drop-off point at the worst possible moment.
 *
 * Persisting the address lets the app reopen straight onto the code screen. Plain
 * AsyncStorage rather than SecureStore: it is an unverified email address the user typed
 * moments ago and can already see in their own inbox, not a credential.
 */
export async function setPendingConfirmationEmail(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, email);
  } catch {
    // Non-fatal: losing this only costs the old behavior of landing on sign-in.
  }
}

export async function getPendingConfirmationEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Call on successful confirmation, and whenever the user deliberately backs out —
 * otherwise the redirect below would trap them on the code screen. */
export async function clearPendingConfirmationEmail(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Non-fatal.
  }
}
