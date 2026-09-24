import { Text } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { LEGAL_URLS } from "@/lib/legal";
import { useTheme } from "@/theme/useTheme";

/**
 * The Terms and Privacy Policy line, shown on every screen that creates an account.
 *
 * WHY IT IS A COMPONENT NOW. It was written once, inline, at the bottom of
 * app/(auth)/sign-up.tsx, which was the only way to create an account. Sign in with Apple
 * added a second one and it does not pass through that screen at all: the Apple sheet returns
 * a session, every layout guard sends a profile-less session to "/", and app/index.tsx renders
 * CompleteSignupScreen there. So an Apple account was being created, given a profile, and
 * walked into the onboarding wizard without the user ever having been shown the terms they
 * were agreeing to. For a user-generated-content app that agreement is not decoration -- it
 * carries the no-tolerance-for-objectionable-content clause Guideline 1.2 expects users to
 * accept, and it is the document that says what "18+" and "not a dating app" mean here.
 *
 * Shared rather than copied so the two paths cannot drift into agreeing to different things.
 *
 * THE PUSH SENTENCE IS OPTIONAL because only one of the two callers earns it. Sign-up asks for
 * an email and a password and then goes quiet until a confirmation mail arrives, so telling
 * somebody there that notifications are coming is the honest moment. The age gate is followed
 * immediately by the wizard, and the OS permission prompt now fires when the profile row
 * lands, which is close enough to the ask that a paragraph about it here would be noise on a
 * screen whose whole job is one question.
 */
export function LegalConsentNotice({ mentionNotifications = false }: { mentionNotifications?: boolean }) {
  const { colors, type } = useTheme();

  return (
    <Text style={[type.caption, { color: colors.textMuted }]}>
      By creating an account, you agree to our{" "}
      <Text
        style={{ color: colors.voltDim }}
        onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.termsOfService)}
      >
        Terms of Service
      </Text>{" "}
      and{" "}
      <Text
        style={{ color: colors.voltDim }}
        onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.privacyPolicy)}
      >
        Privacy Policy
      </Text>
      .
      {mentionNotifications
        ? " We'll also notify you about new matches, messages, and reminders when a duo's waiting on you. Fine-tune or turn any of these off anytime in Settings."
        : ""}
    </Text>
  );
}
