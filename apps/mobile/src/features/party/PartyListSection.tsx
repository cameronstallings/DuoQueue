import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

import { useMyParties, usePartyMembers } from "./useParty";

function PartyRow({ partyId }: { partyId: string }) {
  const { colors, radius, spacing, type } = useTheme();
  const myId = useSessionStore((s) => s.profile?.id);
  const { data: members } = usePartyMembers(partyId);

  const names = (members ?? [])
    .filter((m) => m.profile_id !== myId)
    .map((m) => m.display_name)
    .join(" & ");
  const memberCount = members?.length ?? 0;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/party/[partyId]", params: { partyId } })}
      accessibilityRole="button"
      accessibilityLabel={`Open party${names ? ` with ${names}` : ""}`}
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
          {memberCount > 0 ? `${memberCount} member${memberCount === 1 ? "" : "s"}` : "Loading…"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function PartyRowSkeleton() {
  const { spacing, radius } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}>
      <Skeleton width={44} height={44} borderRadius={radius.round} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="30%" height={12} />
      </View>
    </View>
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

  if (isLoading) {
    return (
      <View style={{ paddingTop: spacing.sm }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xs }}>
          <SectionLabel>Your parties</SectionLabel>
        </View>
        <PartyRowSkeleton />
      </View>
    );
  }

  if (isError || !parties || parties.length === 0) return null;

  return (
    <View style={{ paddingTop: spacing.sm }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xs }}>
        <SectionLabel>{`Your parties (${parties.length})`}</SectionLabel>
      </View>
      {parties.map((party) => (
        <PartyRow key={party.party_id} partyId={party.party_id} />
      ))}
    </View>
  );
}
