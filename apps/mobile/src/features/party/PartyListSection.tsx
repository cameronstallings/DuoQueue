import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Animated from "react-native-reanimated";

import { SectionLabel } from "@/components/SectionLabel";
import { useSessionStore } from "@/store/session-store";
import { layoutTransition, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { joinNames } from "./partyCopy";
import { PARTY_CAP, useMyParties, usePartyMembers } from "./useParty";

function PartyRow({ partyId }: { partyId: string }) {
  const { colors, radius, spacing, type } = useTheme();
  const myId = useSessionStore((s) => s.profile?.id);
  const { data: members } = usePartyMembers(partyId);

  const names = joinNames(
    (members?.profiles ?? []).filter((m) => m.profile_id !== myId).map((m) => m.display_name),
  );
  const memberCount = members?.ids.length ?? 0;
  // A full party has nobody left to swipe for, so it opens on its chat. A duo still looking
  // opens on the deck, which has the chat one tap away. Before the count loads it is the deck,
  // which shows its own "Your party is full" state if that guess was wrong.
  const full = memberCount >= PARTY_CAP;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: full ? "/party/[partyId]/chat" : "/party/[partyId]", params: { partyId } })
      }
      accessibilityRole="button"
      accessibilityLabel={`Open party${full ? " chat" : ""}${names ? ` with ${names}` : ""}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.surfaceAlt : "transparent",
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.round,
          backgroundColor: colors.voltSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="people" size={18} color={colors.voltDim} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
          {names || "Your party"}
        </Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>
          {memberCount === 0
            ? "Loading…"
            : full
              ? `${memberCount} members, party chat`
              : `${memberCount} member${memberCount === 1 ? "" : "s"}, finding a third`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** "Your parties" — the only entry point back into a party once you've navigated away
 * from it. `get_my_parties()` has existed in the DB since 0026_parties.sql but nothing
 * in the app called it, so a party you'd already created became unreachable the moment
 * you left /party/[partyId]; live production data shows that's almost certainly what
 * drove the same creator to spin up 3 duplicate empty parties in a row (see
 * t-party-verify.md #1/#2). Mirrors PartyInvitesBanner's placement/idiom: sits above the
 * matches list, renders nothing when there's nothing to show. */
export function PartyListSection() {
  const { spacing } = useTheme();
  const { data: parties, isLoading, isError } = useMyParties();

  // Nothing while loading. Most players have no party, and a "Your parties" label with a skeleton
  // row that then vanished was the jump at the top of every cold open of Matches: the list under
  // it slid up a row a moment after it appeared. A party that does exist fades in instead, and
  // the list below glides down to make room (the Matches list's layout transition).
  if (isLoading || isError || !parties || parties.length === 0) return null;

  return (
    <Animated.View entering={revealEntering()} layout={layoutTransition()} style={{ paddingTop: spacing.sm }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xs }}>
        <SectionLabel>{`Your parties (${parties.length})`}</SectionLabel>
      </View>
      {parties.map((party) => (
        <PartyRow key={party.party_id} partyId={party.party_id} />
      ))}
    </Animated.View>
  );
}
