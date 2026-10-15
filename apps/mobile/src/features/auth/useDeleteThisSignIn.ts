import { useRef, useState } from "react";
import { Alert } from "react-native";

import { useDeleteAccount } from "@/features/settings/useDeleteAccount";
import { hapticError } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";

import { hasAppleIdentity } from "./appleIdentity";
import { deleteThisSignInFailure, deleteThisSignInPrompt } from "./deleteThisSignIn";
import { clearPendingDisplayName } from "./pendingDisplayName";

/**
 * "Delete this sign-in", for the two screens a signed-in account can be stuck on before it ever
 * reaches Settings: the post-auth age gate (no profile yet) and the onboarding wizard (a profile
 * nobody can see yet). See deleteThisSignIn.ts for why both need it.
 *
 * It is the Settings deletion, not a second one: the same `useDeleteAccount` mutation, so the
 * same delete-account function, the same fresh Apple code for an Apple account, and the same
 * server-side refusals. What differs is only what happens around it. One confirmation rather
 * than Settings' two, because there is far less to lose (no matches, no messages, nothing
 * anybody else has seen); and the pending Apple display name is dropped on the way out, since
 * it outlives the JS runtime on purpose and must not be prefilled onto whoever signs up next on
 * this phone.
 *
 * Signing out afterwards is what moves the screen: the session goes, routing sends the app to
 * sign-in, and the component that called this unmounts.
 */
export function useDeleteThisSignIn(): { confirmDeleteThisSignIn: () => void; deleting: boolean } {
  const deleteAccount = useDeleteAccount();
  const signOut = useSessionStore((s) => s.signOut);
  const session = useSessionStore((s) => s.session);
  const [deleting, setDeleting] = useState(false);
  // A ref as well as the state, because two taps inside one frame both read the state before
  // either re-render lands. A second delete-account call for an account the first one is
  // already deleting would only produce a confusing error, but it would produce one.
  const inFlight = useRef(false);

  async function runDeletion() {
    if (inFlight.current) return;
    inFlight.current = true;
    setDeleting(true);
    try {
      await deleteAccount.mutateAsync();
      await clearPendingDisplayName();
      await signOut();
    } catch (err) {
      console.error("delete this sign-in failed", err);
      hapticError();
      Alert.alert("Could not delete", deleteThisSignInFailure(err));
    } finally {
      inFlight.current = false;
      setDeleting(false);
    }
  }

  function confirmDeleteThisSignIn() {
    if (inFlight.current) return;
    const prompt = deleteThisSignInPrompt(hasAppleIdentity(session?.user));
    Alert.alert(prompt.title, prompt.message, [
      { text: prompt.cancel, style: "cancel" },
      { text: prompt.confirm, style: "destructive", onPress: () => void runDeletion() },
    ]);
  }

  return { confirmDeleteThisSignIn, deleting };
}
