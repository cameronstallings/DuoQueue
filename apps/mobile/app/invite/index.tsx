import { useEffect } from "react";
import { Pressable, Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { useInviteCode } from "@/features/invite/useInvite";
import { useRequireSession } from "@/hooks/useRequireSession";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { inviteShareMessage, isInviteCodeShape, normalizeInviteCode } from "@/lib/invite";
import { useInviteStore } from "@/store/invite-store";
import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

/**
 * "Invite your duo" — the share screen, reached from the empty deck.
 *
 * WHY A SCREEN AND NOT A BUTTON THAT OPENS THE SHARE SHEET DIRECTLY. Three reasons, and the
 * third is the one that decided it.
 *
 *  1. The code has to be fetched before there is anything to share, so a direct button is a
 *     spinner followed by an OS sheet appearing out of nowhere.
 *  2. The code needs to be visible on its own. It is the part that survives the App Store
 *     (see the header of `@/lib/invite`), and it is what somebody reads out over voice chat
 *     to the friend they are already in a party with, which is the single most likely way
 *     this feature actually gets used at four users.
 *  3. The 18+ and platonic line belongs in front of the SENDER, before they choose who to
 *     send it to, not only inside the message the recipient reads. This app was rejected
 *     once under guideline 2.3.6; an invite flow that never tells the inviter what they are
 *     inviting somebody into is exactly the wrong register.
 */
export default function InviteScreen() {
  useRequireSession();
  const { colors, spacing, type, radius } = useTheme();
  const { code, url, isPending, isError, refetch } = useInviteCode();
  const showToast = useToastStore((s) => s.showToast);

  // `duoqueue://invite?c=ABCDE12345` lands here rather than on the [code] route, because
  // there is no path segment for the router to match. Forward it so the query form of the
  // link is not silently a dead end.
  const { c } = useLocalSearchParams<{ c?: string }>();
  const setPendingCode = useInviteStore((s) => s.setPendingCode);
  useEffect(() => {
    const incoming = normalizeInviteCode(c);
    if (isInviteCodeShape(incoming)) {
      setPendingCode(incoming);
      router.replace({ pathname: "/invite/[code]", params: { code: incoming } });
    }
  }, [c, setPendingCode]);

  async function handleShare() {
    if (!code || !url) return;
    hapticLight();
    try {
      // `message` only, with the URL inside it rather than in the `url` field. On iOS the
      // two are offered to the target app separately and several of them (Messages, some
      // Discord builds) take the url and drop the message, which would send a bare
      // supabase.co link with no code and no explanation in it.
      await Share.share({ message: inviteShareMessage(code, url) });
    } catch {
      // The user dismissed the sheet, or the OS refused it. Neither is worth an alert.
    }
  }

  async function handleCopyCode() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    hapticSuccess();
    showToast("Code copied");
  }

  return (
    <ScreenContainer title="Invite your duo" showClose>
      <Text style={[type.body, { color: colors.textMuted }]}>
        The fastest way to fill your deck is to bring somebody you already play with. They
        join, and you are one duo in before you swipe on anybody.
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        <SectionLabel>YOUR INVITE CODE</SectionLabel>
        <Card>
          {isPending ? (
            <Skeleton height={38} borderRadius={radius.md} />
          ) : isError || !code ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[type.body, { color: colors.textMuted }]}>
                Could not load your invite code.
              </Text>
              <Button label="Try again" variant="ghost" size="sm" onPress={() => void refetch()} />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copy your invite code, ${code.split("").join(" ")}`}
              onPress={() => void handleCopyCode()}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.md,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {/* Mono and letter-spaced because this string gets read off a screen and
                  retyped, and because 0/O and 1/I are the two pairs that get read wrong.
                  The alphabet excludes O, I and L outright for the same reason. */}
              <Text
                selectable
                style={[type.tick, { color: colors.text, fontSize: 22, lineHeight: 30, letterSpacing: 3, flex: 1 }]}
              >
                {code}
              </Text>
              <Ionicons name="copy-outline" size={18} color={colors.voltDim} />
            </Pressable>
          )}
        </Card>
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button label="Share invite" onPress={() => void handleShare()} disabled={!code} />
        <Text style={[type.caption, { color: colors.textMuted }]}>
          The message carries your code and a link. Whoever you send it to types the code on
          the sign-up screen, and your profile is the first one they see.
        </Text>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Card>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.voltDim} />
            <Text style={[type.caption, { color: colors.textMuted, flex: 1 }]}>
              DuoQueue is 18+ and it is for finding teammates, not dates. Only send this to
              adults, and only to people you would actually queue with.
            </Text>
          </View>
        </Card>
      </View>
    </ScreenContainer>
  );
}
