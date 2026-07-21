import { useEffect, useState } from "react";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

/** Requires EXPO_PUBLIC_GOOGLE_*_CLIENT_ID to be set — see .env.example. */
export function useGoogleSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.params.id_token;

    let cancelled = false;

    async function completeSignIn() {
      if (!idToken) {
        if (!cancelled) setError("Google sign-in did not return an ID token.");
        return;
      }
      if (!cancelled) setSigningIn(true);
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (cancelled) return;
      if (signInError) setError(signInError.message);
      setSigningIn(false);
    }

    void completeSignIn();
    return () => {
      cancelled = true;
    };
  }, [response]);

  return { request, promptAsync, signingIn, error };
}
