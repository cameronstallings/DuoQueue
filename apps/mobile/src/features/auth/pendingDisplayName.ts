import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "duoqueue.pending-display-name";

/**
 * The name Apple gave us at sign-in, held until the age gate can spend it.
 *
 * ============================================================================
 * WHY IT HAS TO SURVIVE A COLD START
 * ============================================================================
 *
 * Apple returns `credential.fullName` on the FIRST authorization for a given Apple ID and
 * NEVER AGAIN. Every later sign-in with the same Apple ID returns null there, permanently, on
 * that device and every other one. So the value has exactly one moment of existence.
 *
 * That moment is at sign-in, and the call that can use it is `complete_signup`, which does not
 * run until the user has finished the post-authentication age gate on a different screen. In
 * between there is a session with no profile row, a date picker, and every ordinary reason a
 * phone has to take the app away: a call, a low-memory kill, a force-quit, or somebody who puts
 * the phone down and comes back tomorrow. Holding the name in module state would lose it to any
 * of those, and there is no second chance to ask Apple for it.
 *
 * This is the same problem `pendingConfirmation.ts` solves for the unconfirmed signup email,
 * and it is deliberately solved the same way, down to the swallow-and-carry-on error handling:
 * nothing here is worth failing a sign-in over.
 *
 * ============================================================================
 * WHY ASYNCSTORAGE AND NOT SECURESTORE
 * ============================================================================
 *
 * This is personal data and it is treated as such: it is never logged, it goes to exactly one
 * place (`complete_signup`'s `p_display_name`), and it is cleared the moment it is used or the
 * signup is abandoned.
 *
 * SecureStore would nonetheless be the wrong home for it. It is a keychain item, and keychain
 * items outlive the app that wrote them: they survive a delete-and-reinstall on iOS. A value
 * whose whole design goal is to be short-lived should not be put somewhere that makes it harder
 * to get rid of than the app itself. It also stops being private about a minute later by the
 * user's own choice, since its only purpose is to prefill a display name other players see.
 * Sandboxed app storage that goes away with the app is the honest fit.
 *
 * ============================================================================
 * HOW A STALE VALUE IS PREVENTED FROM REACHING THE WRONG ACCOUNT
 * ============================================================================
 *
 * Nothing here is scoped to a user id, because at the moment it is written there is no session
 * yet to scope it to. Three rules cover that instead, and all three live at the call sites:
 *
 *   - `signInWithApple` writes on EVERY Apple sign-in, and writes a clear when Apple gave no
 *     usable name. So a returning user, or a second account on the same phone, wipes whatever
 *     the last attempt left rather than inheriting it.
 *   - `CompleteSignupScreen` clears it on the way through each of its exits: the profile it
 *     just created, the sign-out it offers instead, and "Delete this sign-in".
 *   - The session store clears it in `onProfileReady`, the first time a profile is confirmed for
 *     a user. That covers the path the age gate never sees: an Apple sign-in into an account
 *     that already has a profile, which writes the value like every Apple sign-in does and
 *     otherwise never had anything to spend or clear it.
 *
 * The window where a value can exist at all is therefore one signup, and the only thing that
 * can read it is the one screen a profile-less session is allowed to be on.
 */
export async function setPendingDisplayName(displayName: string | null): Promise<void> {
  // A null is a real instruction, not a no-op: it is how a returning Apple sign-in says "there
  // is no name this time", and leaving the previous one in place is the one outcome that could
  // put somebody else's name on a profile.
  if (displayName === null) {
    await clearPendingDisplayName();
    return;
  }

  try {
    await AsyncStorage.setItem(KEY, displayName);
  } catch {
    // Non-fatal: the cost is a display-name field the wizard asks for anyway, which is not
    // worth failing an otherwise successful sign-in over.
  }
}

export async function getPendingDisplayName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Call once the name has been spent, and whenever the signup it belonged to ends. */
export async function clearPendingDisplayName(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Non-fatal, and the only swallowed failure here with a real cost: a value that should
    // have gone is still on disk. It is bounded — the next Apple sign-in overwrites or clears
    // it before any screen can read it — and a throw would take down a completed signup or a
    // sign-out, neither of which the user could act on.
  }
}
