import { useEffect, useState } from "react";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IS_CONFIGURED = Boolean(IOS_CLIENT_ID && ANDROID_CLIENT_ID && WEB_CLIENT_ID);

if (!IS_CONFIGURED) {
  console.warn("Google sign-in isn't configured (EXPO_PUBLIC_GOOGLE_*_CLIENT_ID) — the Google button will stay disabled.");
}

/** Requires EXPO_PUBLIC_GOOGLE_*_CLIENT_ID to be set — see .env.example. */
export function useGoogleSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // expo-auth-session throws if its platform client id is undefined, so unconfigured
  // platforms get a placeholder here — `request` is nulled out below instead, which the
  // sign-in screen already uses to keep the "Continue with Google" button disabled.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: IOS_CLIENT_ID ?? "unconfigured",
    androidClientId: ANDROID_CLIENT_ID ?? "unconfigured",
    webClientId: WEB_CLIENT_ID ?? "unconfigured",
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

  return { request: IS_CONFIGURED ? request : null, promptAsync, signingIn, error };
}
