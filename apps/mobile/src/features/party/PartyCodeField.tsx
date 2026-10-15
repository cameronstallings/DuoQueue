import { useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";

import { TextField } from "@/components/TextField";
import { hapticError, hapticSelection, hapticSuccess } from "@/lib/haptics";
import {
  INVITE_CODE_LENGTH,
  invitedPartyParams,
  isInviteCodeShape,
  normalizeInviteCode,
  parseInviteCode,
} from "@/lib/invite";
import { quickEntering, quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { PARTY_CODE_FIELD_COPY } from "./partyCopy";
import { usePartyCodeLookup, usePartyLfgAvailable } from "./usePartyCall";

/**
 * Matches > "Have a party code?": how a player who already has an account answers a party LFG
 * post. The post's link opens the App Store, not the app, and DuoQueue's own players are the most
 * likely to answer a DuoQueue post, so without this they could not use one at all.
 *
 * The code is only READ here (resolve_party_code). A live one opens /invited with the arrival in
 * its route params (invitedPartyParams), the same screen a new player lands on, where the party
 * and its members are shown and the seat is taken only on Join. Full, ended or unknown codes say
 * so under the field; a code that could not be checked (offline) says only that. The row is there
 * only once the server has 0089 (usePartyLfgAvailable), so before that Matches is build 19's.
 */
export function PartyCodeField() {
  const available = usePartyLfgAvailable();
  if (!available) return null;
  return <PartyCodeFieldBody />;
}

function PartyCodeFieldBody() {
  const { colors, spacing, type } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState("");

  const code = isInviteCodeShape(typed) ? typed : null;
  // An error is its own state (partyCodeLookupState): offline says nothing about the code, so it
  // never reads "did not work" and never buzzes.
  const lookup = usePartyCodeLookup(code);
  const { state } = lookup;
  const checking = state.kind === "checking";
  const status = state.kind === "found" ? state.row.status : null;
  const notFound = state.kind === "not-found";
  const failed = state.kind === "error";
  const sharerName = state.kind === "found" ? state.row.sharer_name?.trim() || "Someone" : "Someone";

  // A live code opens the party once per code (the field keeps it, so coming back from the
  // arrival screen does not open it again). The arrival goes in the route, NOT the invite store:
  // nothing is persisted, so leaving /invited by the back swipe leaves nothing behind for a later
  // invite link to land on, and "Not right now" goes back here (PartyArrival via InvitedScreen).
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!code || status !== "live" || openedFor.current === code) return;
    openedFor.current = code;
    hapticSuccess();
    router.push({ pathname: "/invited", params: invitedPartyParams({ code, inviterName: sharerName }) });
  }, [code, status, sharerName]);

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
    : failed
      ? { key: "failed", color: colors.textMuted, text: PARTY_CODE_FIELD_COPY.checkFailed }
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
        // "Couldn't check that code. Tap to try again." asks the same code again.
        accessibilityRole={failed ? "button" : undefined}
        onPress={failed ? lookup.retry : undefined}
        style={[type.caption, { color: caption.color }]}
      >
        {caption.text}
      </Animated.Text>
    </Animated.View>
  );
}
