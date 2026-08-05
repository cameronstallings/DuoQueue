import { useEffect, useState } from "react";
import { Redirect } from "expo-router";

import { getPendingConfirmationEmail } from "@/features/auth/pendingConfirmation";
import { useSessionStore } from "@/store/session-store";

export default function Index() {
  const status = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);
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

  if (status === "signed_out") {
    // Hold a frame rather than flashing sign-in before redirecting straight past it.
    if (pendingEmail === undefined) return null;
    // Someone who signed up, left to fetch the code, and came back belongs on the code
    // screen — not back at the front door, hunting for the way in again.
    if (pendingEmail) {
      return <Redirect href={{ pathname: "/(auth)/confirm-email", params: { email: pendingEmail } }} />;
    }
    return <Redirect href="/(auth)/sign-in" />;
  }
  if (status === "signed_in" && !profile?.onboarding_completed) {
    return <Redirect href="/(onboarding)/display-name" />;
  }
  return <Redirect href="/(tabs)" />;
}
