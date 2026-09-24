import { useEffect, useState } from "react";
import { Redirect } from "expo-router";

import { CompleteSignupScreen } from "@/features/auth/CompleteSignupScreen";
import { getPendingConfirmationEmail } from "@/features/auth/pendingConfirmation";
import { sessionRoute } from "@/features/auth/sessionRouting";
import { useSessionStore } from "@/store/session-store";

export default function Index() {
  const status = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);
  const profileStatus = useSessionStore((s) => s.profileStatus);
  // `undefined` = still reading storage; `null` = read, nothing pending.
  const [pendingEmail, setPendingEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (status !== "signed_out") {
      setPendingEmail(null);
      return;
    }
    let cancelled = false;
    void getPendingConfirmationEmail().then((email) => {
      if (!cancelled) setPendingEmail(email);
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const route = sessionRoute({ status, profileStatus, onboardingCompleted: profile?.onboarding_completed });

  if (route === "sign-in") {
    // Hold a frame rather than flashing sign-in before redirecting straight past it.
    if (pendingEmail === undefined) return null;
    // Someone who signed up, left to fetch the code, and came back belongs on the code
    // screen — not back at the front door, hunting for the way in again.
    if (pendingEmail) {
      return <Redirect href={{ pathname: "/(auth)/confirm-email", params: { email: pendingEmail } }} />;
    }
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Same hold as the line above, for the same reason: a profile read that has not landed (or
  // that failed) is not an answer, and every guess is somebody's wrong screen. The store retries
  // a failed read on a timer, so this resolves itself rather than waiting on a relaunch.
  if (route === "hold") return null;

  // RENDERED, not redirected. This is the one address every layout guard in the app agrees to
  // send a profile-less session to, so the screen has to live at the end of that arrow rather
  // than behind another one. See CompleteSignupScreen for why it cannot live in (auth).
  if (route === "complete-signup") return <CompleteSignupScreen />;

  if (route === "onboarding") return <Redirect href="/(onboarding)/display-name" />;
  return <Redirect href="/(tabs)" />;
}
