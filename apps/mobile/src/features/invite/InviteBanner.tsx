import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";

import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import {
  INVITE_CODE_LENGTH,
  inviterConfirmation,
  isInviteCodeShape,
  normalizeInviteCode,
  parseInviteCode,
} from "@/lib/invite";
import { useInviteStore } from "@/store/invite-store";
import { useTheme } from "@/theme/useTheme";

import { useResolveInviteCode } from "./useInvite";

/**
 * "Cameron invited you", above the sign-up form.
 *
 * WHY IT IS HERE AND NOT LATER. iOS gives no install referrer, so the person who tapped a
 * friend's link, went to the App Store and came back is holding a code and nothing else
 * (see the header of `@/lib/invite`). The sign-up screen is where they are, it is where a
 * new account is created, and it is the only moment where naming their friend changes
 * whether they finish. Putting the field after onboarding would ask somebody to complete a
 * ten-step wizard first and then tell them who it was for.
 *
 * TWO STATES, AND THE COLLAPSED ONE IS ONE LINE. Somebody who was not invited should see a
 * row they can ignore, not a form field that looks required. Somebody who was sees the
 * inviter's name, resolved before they have an account at all.
 */
export function InviteBanner({ allowEntry = true }: { allowEntry?: boolean }) {
  const { colors, spacing, type } = useTheme();
  const pendingCode = useInviteStore((s) => s.pendingCode);
  const setPendingCode = useInviteStore((s) => s.setPendingCode);

  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState("");

  // The stored code (from a deep link, or from a previous launch) takes priority over
  // whatever is half-typed in the field.
  const active = pendingCode ?? (isInviteCodeShape(normalizeInviteCode(typed)) ? normalizeInviteCode(typed) : null);
  const { inviter, isPending, notFound } = useResolveInviteCode(active);

  async function handleExpand() {
    hapticSelection();
    setExpanded(true);
    // They tapped a row that says "invite code", so reading the clipboard is answering the
    // question they just asked. iOS may show its own paste prompt on top of this, which is
    // the right amount of friction. `hasStringAsync` first so a device with an empty
    // clipboard never raises it at all.
    try {
      if (!(await Clipboard.hasStringAsync())) return;
      const clip = await Clipboard.getStringAsync();
      const found = parseInviteCode(clip) ?? normalizeInviteCode(clip);
      if (isInviteCodeShape(found)) setTyped(found);
    } catch {
      // Clipboard access denied or unavailable. Typing still works.
    }
  }

  function handleChange(next: string) {
    const normalized = normalizeInviteCode(next).slice(0, INVITE_CODE_LENGTH);
    setTyped(normalized);
    if (isInviteCodeShape(normalized)) {
      hapticSuccess();
      setPendingCode(normalized);
    }
  }

  if (inviter) {
    return (
      <Card style={{ marginBottom: spacing.md }} luminous>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
          <Ionicons name="people" size={18} color={colors.volt} />
          <Text style={[type.caption, { color: colors.text, flex: 1 }]}>
            {inviterConfirmation(inviter.display_name)}
          </Text>
        </View>
      </Card>
    );
  }

  if (!allowEntry) return null;

  if (!expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => void handleExpand()}
        hitSlop={8}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          marginBottom: spacing.md,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="add-circle-outline" size={14} color={colors.voltDim} />
        <Text style={[type.caption, { color: colors.voltDim }]}>Have an invite code?</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ marginBottom: spacing.md, gap: spacing.xs }}>
      <TextField
        label="Invite code"
        value={typed}
        onChangeText={handleChange}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ABCDE12345"
        maxLength={INVITE_CODE_LENGTH}
      />
      {isPending ? (
        <Text style={[type.caption, { color: colors.textMuted }]}>Checking that code...</Text>
      ) : notFound ? (
        <Text style={[type.caption, { color: colors.danger }]}>
          That code did not work. Check it against the message you were sent.
        </Text>
      ) : (
        <Text style={[type.caption, { color: colors.textMuted }]}>
          {INVITE_CODE_LENGTH} characters, from the message a friend sent you. Optional.
        </Text>
      )}
    </View>
  );
}
