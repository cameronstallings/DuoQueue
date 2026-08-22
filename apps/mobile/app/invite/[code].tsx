import { useEffect } from "react";
import { View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";

import { Logo } from "@/components/Logo";
import { inviteRouteAction, isInviteCodeShape, normalizeInviteCode } from "@/lib/invite";
import { useInviteStore } from "@/store/invite-store";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

/**
 * Where `duoqueue://invite/<code>` lands.
 *
 * A route rather than a `Linking` listener because expo-router already owns incoming URLs:
 * it maps the path onto the file tree, and without a file here `duoqueue://invite/ABCDE12345`
 * would render the unmatched-route screen. Having the route IS the deep-link handler.
 *
 * This screen never stays on screen. It stores the code and then redirects, and every
 * branch of that decision lives in `inviteRouteAction` with tests, because a deep link can
 * be what LAUNCHES the app: it arrives before there is a session, sometimes before there is
 * a profile, and the wrong redirect at that moment either strands the user on a screen they
 * cannot use or throws the invite away.
 */
export default function InviteDeepLink() {
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();

  const status = useSessionStore((s) => s.status);
  const onboardingCompleted = useSessionStore((s) => s.profile?.onboarding_completed);
  const pendingCode = useInviteStore((s) => s.pendingCode);
  const redemption = useInviteStore((s) => s.redemption);
  const arrival = useInviteStore((s) => s.arrival);
  const setPendingCode = useInviteStore((s) => s.setPendingCode);

  const normalized = normalizeInviteCode(code);
  const codeValid = isInviteCodeShape(normalized);

  useEffect(() => {
    // Only if it is actually new: re-storing the same code would reset `redemption` to
    // "idle" on every render of this screen and put the redemption hook in a loop.
    if (codeValid && normalized !== pendingCode) setPendingCode(normalized);
  }, [codeValid, normalized, pendingCode, setPendingCode]);

  const action = inviteRouteAction({
    codeValid,
    sessionStatus: status,
    onboardingCompleted,
    // An arrival already in the store (from this session, or restored from storage after a
    // relaunch) is a redemption that has answered, whatever the status field says.
    redemption: arrival ? "done" : redemption,
  });

  switch (action) {
    case "sign-in":
      return <Redirect href="/(auth)/sign-in" />;
    case "onboarding":
      return <Redirect href="/(onboarding)/display-name" />;
    case "arrival":
      return <Redirect href="/invited" />;
    case "home":
      return <Redirect href="/" />;
    case "wait":
      // The same held-frame the root layout uses, so a cold start opened by an invite link
      // does not flash a blank screen between the splash and wherever it is going.
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <Logo width={100} />
        </View>
      );
  }
}
