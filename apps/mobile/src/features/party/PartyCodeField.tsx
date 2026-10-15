import { useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";

import { TextField } from "@/components/TextField";
import { useResolvePartyCode } from "@/features/invite/useInvite";
import { hapticError, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { INVITE_CODE_LENGTH, isInviteCodeShape, normalizeInviteCode, parseInviteCode } from "@/lib/invite";
import { useInviteStore } from "@/store/invite-store";
import { quickEntering, quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { PARTY_CODE_FIELD_COPY } from "./partyCopy";
import { usePartyLfgAvailable } from "./usePartyCall";

/**
 * Matches > "Have a party code?": how a player who already has an account answers a party LFG
 * post. The post's link opens the App Store, not the app, and DuoQueue's own players are the most
 * likely to answer a DuoQueue post, so without this they could not use one at all.
 *
 * The code is only READ here (resolve_party_code). A live one becomes the party arrival and opens
 * /invited, the same screen a new player lands on, where the party and its members are shown and
 * the seat is taken only on Join. Full, ended or unknown codes say so under the field. The row
 * is there only once the server has 0089 (usePartyLfgAvailable), so before that Matches is build
 * 19's.
 */
export function PartyCodeField() {
  const available = usePartyLfgAvailable();
  if (!available) return null;
  return <PartyCodeFieldBody />;
}

function PartyCodeFieldBody() {
  const { colors, spacing, type } = useTheme();
  const settleRedemption = useInviteStore((s) => s.settleRedemption);
  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState("");

  const code = isInviteCodeShape(typed) ? typed : null;
  const resolved = useResolvePartyCode(code, code !== null);
  const checking = code !== null && resolved === undefined;
  const status = code !== null && resolved ? resolved.status : null;
  const notFound = code !== null && resolved === null;

  // A live code opens the party once per code (the field keeps it, so coming back from the
  // arrival screen does not open it again).
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!code || status !== "live" || openedFor.current === code) return;
    openedFor.current = code;
    hapticSuccess();
    settleRedemption({ kind: "party", code, inviterName: resolved?.sharer_name?.trim() || "Someone" });
    router.push("/invited");
  }, [code, status, resolved, settleRedemption]);

  // The haptic map's inline form error, once, as the "did not work" or no-seat line appears.
  const refused = notFound || status === "full" || status === "ended";
  useEffect(() => {
    if (refused) hapticError();
  }, [refused]);

  async function handleExpand() {
    hapticSelection();
    setExpanded(true);
    // They tapped a row that asks for a code, so reading the clipboard answers it (the post's
    // link line or its last line). iOS may show its own paste prompt; an empty clipboard none.
    try {
      if (!(await Clipboard.hasStringAsync())) return;
      const clip = await Clipboard.getStringAsync();
      const found = parseInviteCode(clip) ?? normalizeInviteCode(clip);
      if (isInviteCodeShape(found)) setTyped(found);
    } catch {
      // Clipboard access denied or unavailable. Typing still works.
    }
  }

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
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="add-circle-outline" size={14} color={colors.voltDim} />
        <Text style={[type.caption, { color: colors.voltDim }]}>{PARTY_CODE_FIELD_COPY.open}</Text>
      </Pressable>
    );
  }

  const caption = checking
    ? { key: "checking", color: colors.textMuted, text: PARTY_CODE_FIELD_COPY.checking }
    : status === "full"
      ? { key: "full", color: colors.textMuted, text: PARTY_CODE_FIELD_COPY.full }
      : status === "ended"
        ? { key: "ended", color: colors.textMuted, text: PARTY_CODE_FIELD_COPY.ended }
        : notFound
          ? { key: "not-found", color: colors.danger, text: PARTY_CODE_FIELD_COPY.notFound }
          : { key: "hint", color: colors.textMuted, text: PARTY_CODE_FIELD_COPY.hint };

  return (
    <Animated.View
      key="field"
      entering={revealEntering()}
      exiting={quickExiting()}
      style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs }}
    >
      <TextField
        label={PARTY_CODE_FIELD_COPY.label}
        value={typed}
        onChangeText={(next) => setTyped(normalizeInviteCode(next).slice(0, INVITE_CODE_LENGTH))}
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
