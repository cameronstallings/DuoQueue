import { Pressable, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

import { usePartyInvites, usePartyMembers, useRespondPartyInvite } from "./useParty";

function PartyInviteCard({ inviteId, partyId }: { inviteId: string; partyId: string }) {
  const { colors, radius, spacing, type } = useTheme();
  const { data: members } = usePartyMembers(partyId);
  const respond = useRespondPartyInvite();

  const names = (members ?? []).map((m) => m.display_name).join(" & ");

  return (
    <View
      style={{
        backgroundColor: colors.voltSoft,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={[type.bodyStrong, { color: colors.text }]}>
        {names || "A duo"} want you to join their party
      </Text>
      <Text style={[type.caption, { color: colors.textMuted }]}>
        You all liked each other while swiping together — accept to unlock a group chat.
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Pressable onPress={() => respond.mutate({ inviteId, accept: true })} disabled={respond.isPending}>
          <Text style={[type.bodyStrong, { color: colors.voltDim }]}>Accept</Text>
        </Pressable>
        <Pressable onPress={() => respond.mutate({ inviteId, accept: false })} disabled={respond.isPending}>
          <Text style={[type.bodyStrong, { color: colors.textMuted }]}>Decline</Text>
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
