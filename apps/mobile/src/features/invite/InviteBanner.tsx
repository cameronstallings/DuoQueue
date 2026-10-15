import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";

import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { FRONT_DOOR_COPY } from "@/features/auth/frontDoorCopy";
import { PARTY_INVITE_FIELD_LINES } from "@/features/party/partyCopy";
import { CALL_ENDED_COPY } from "@/features/queue/queueCopy";
import { useCallCodeEnded } from "@/features/queue/useQueueUp";
import { hapticError, hapticSelection, hapticSuccess } from "@/lib/haptics";
import {
  INVITE_CODE_LENGTH,
  inviterConfirmation,
  isInviteCodeShape,
  normalizeInviteCode,
  parseInviteCode,
  partyConfirmation,
} from "@/lib/invite";
import { useInviteStore } from "@/store/invite-store";
import { quickEntering, quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { useResolveInviteCode, useResolvePartyCode } from "./useInvite";

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
 *
 * A PARTY POST'S CODE (build 20, 0089) goes in the same field: the post's link line pastes in
 * the same way. resolve_invite_code knows nothing of it, so it is asked of resolve_party_code
 * too. Live, it reads "Invite code saved." at the front door and "{name}'s party has a seat for
 * you" from Save on; full or ended, the field says so. 1.0.1 and build 19 say "did not work".
 */
export function InviteBanner({
  allowEntry = true,
  revealInviter = true,
}: {
  allowEntry?: boolean;
  /**
   * False on the front door (1.0.2): the code is entered and kept there, but no real player is
   * shown before the age gate, so the card only says it was saved. The inviter is named from the
   * intro on.
   */
  revealInviter?: boolean;
}) {
  const { colors, spacing, type } = useTheme();
  const pendingCode = useInviteStore((s) => s.pendingCode);
  const setPendingCode = useInviteStore((s) => s.setPendingCode);

  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState("");

  // The stored code (from a deep link, or from a previous launch) takes priority over
  // whatever is half-typed in the field.
  const active = pendingCode ?? (isInviteCodeShape(normalizeInviteCode(typed)) ? normalizeInviteCode(typed) : null);
  const { inviter, isPending, notFound } = useResolveInviteCode(active);
  // A Duo Call code whose queue-up is over resolves to nobody, like a typo; asked only then, and
  // the field keeps saying it is checking until that answers (undefined), so "did not work" never
  // flashes up before "That Duo Call has ended".
  const callEnded = useCallCodeEnded(active, notFound);
  // A party LFG post's code (0089) is nobody's invite either, so it is asked about alongside,
  // and the field keeps checking until both have answered. Null whenever it is not a party code
  // (including before 0089 exists), which leaves every line below exactly as it was.
  const party = useResolvePartyCode(active, notFound);
  const checking = isPending || (notFound && (callEnded === undefined || party === undefined));
  const partyLive = notFound && party?.status === "live";
  const partyClosed = notFound && (party?.status === "full" || party?.status === "ended") ? party.status : null;
  const rejected = notFound && callEnded === false && party === null;

  // The haptic map's inline form error: once, as the "did not work" line appears in the open
  // field (a stored code that did not resolve, with the field closed, says nothing yet).
  useEffect(() => {
    if (expanded && rejected) hapticError();
  }, [expanded, rejected]);

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

  // MOTION. Each state fades in where the last one was and fades out as it goes (keyed), and the
  // field's caption line cross-fades between its four sentences, so nothing on the first screen of
  // a fresh install pops or swaps in one frame. The screens around it glide their own blocks
  // (start.tsx's layout transitions).
  if ((inviter || partyLive) && !revealInviter) {
    return (
      <Animated.View key="saved" entering={revealEntering()} exiting={quickExiting()}>
        <Card style={{ marginBottom: spacing.md }} luminous>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.volt} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={[type.caption, { color: colors.text }]}>{FRONT_DOOR_COPY.inviteSaved}</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>{FRONT_DOOR_COPY.inviteSavedCaption}</Text>
            </View>
          </View>
        </Card>
      </Animated.View>
    );
  }

  if (inviter) {
    return (
      <Animated.View key="inviter" entering={revealEntering()} exiting={quickExiting()}>
        <Card style={{ marginBottom: spacing.md }} luminous>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
            <Ionicons name="people" size={18} color={colors.volt} />
            <Text style={[type.caption, { color: colors.text, flex: 1 }]}>
              {inviterConfirmation(inviter.display_name)}
            </Text>
          </View>
        </Card>
      </Animated.View>
    );
  }

  // A party post's code, from Save your card on: a seat in a named player's party. (Nothing is
  // held for them yet: the seat is taken only when they tap Join on the arrival screen.)
  if (partyLive && party) {
    return (
      <Animated.View key="party" entering={revealEntering()} exiting={quickExiting()}>
        <Card style={{ marginBottom: spacing.md }} luminous>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
            <Ionicons name="people" size={18} color={colors.volt} />
            <Text style={[type.caption, { color: colors.text, flex: 1 }]}>
              {partyConfirmation(party.sharer_name?.trim() || "Someone")}
            </Text>
          </View>
        </Card>
      </Animated.View>
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

  const caption = checking
    ? { key: "checking", color: colors.textMuted, text: "Checking that code..." }
    : partyClosed
      ? { key: `party-${partyClosed}`, color: colors.textMuted, text: PARTY_INVITE_FIELD_LINES[partyClosed] }
      : rejected
        ? {
            key: "rejected",
            color: colors.danger,
            text: "That code did not work. Check it against the message you were sent.",
          }
        : notFound
          ? { key: "ended", color: colors.textMuted, text: CALL_ENDED_COPY }
          : {
              key: "hint",
              color: colors.textMuted,
              text: `${INVITE_CODE_LENGTH} characters, from the message a friend sent you. Optional.`,
            };

  return (
    <Animated.View
      key="field"
      entering={revealEntering()}
      exiting={quickExiting()}
      style={{ marginBottom: spacing.md, gap: spacing.xs }}
    >
      <TextField
        label="Invite code"
        value={typed}
        onChangeText={handleChange}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ABCDE12345"
        maxLength={INVITE_CODE_LENGTH}
      />
      <Animated.Text
        key={caption.key}
        entering={quickEntering()}
        exiting={quickExiting()}
        accessibilityLiveRegion="polite"
        style={[type.caption, { color: caption.color }]}
      >
        {caption.text}
      </Animated.Text>
    </Animated.View>
  );
}
