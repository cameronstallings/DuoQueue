import { Pressable, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

import { usePartyInvites, usePartyMembers, useRespondPartyInvite } from "./useParty";

function PartyInviteCard({ inviteId, partyId }: { inviteId: string; partyId: string }) {
  const { colors, radius, spacing } = useTheme();
  const { data: members } = usePartyMembers(partyId);
  const respond = useRespondPartyInvite();

  const names = (members ?? []).map((m) => m.display_name).join(" & ");

  return (
    <View
      style={{
        backgroundColor: colors.brandSoft,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "700" }}>
        {names || "A duo"} want you to join their party
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        You all liked each other while swiping together — accept to unlock a group chat.
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Pressable onPress={() => respond.mutate({ inviteId, accept: true })} disabled={respond.isPending}>
          <Text style={{ color: colors.brand, fontWeight: "700" }}>Accept</Text>
        </Pressable>
        <Pressable onPress={() => respond.mutate({ inviteId, accept: false })} disabled={respond.isPending}>
          <Text style={{ color: colors.textMuted, fontWeight: "700" }}>Decline</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PartyInvitesBanner() {
  const { spacing } = useTheme();
  const { data: invites } = usePartyInvites();
  if (!invites || invites.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      {invites.map((invite) => (
        <PartyInviteCard key={invite.invite_id} inviteId={invite.invite_id} partyId={invite.party_id} />
      ))}
    </View>
  );
}
