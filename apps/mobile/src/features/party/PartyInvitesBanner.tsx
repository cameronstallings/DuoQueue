import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { useTheme } from "@/theme/useTheme";

import { joinNames, partyInviteErrorMessage } from "./partyCopy";
import { usePartyInvites, usePartyMembers, useRespondPartyInvite } from "./useParty";

function PartyInviteCard({ inviteId, partyId }: { inviteId: string; partyId: string }) {
  const { colors, radius, spacing, type } = useTheme();
  const { data: members } = usePartyMembers(partyId);
  const respond = useRespondPartyInvite();

  const names = joinNames((members?.profiles ?? []).map((m) => m.display_name));

  // respond_party_invite returns void, but the invite row this card is built from
  // already carries party_id, so there is no need to round-trip it back from the RPC.
  // Accepting opens the party chat: the party is full the moment this person joins, so the
  // deck has nobody left to swipe for, and the chat is where the three of them meet.
  function handleRespond(accept: boolean) {
    respond.mutate(
      { inviteId, partyId, accept },
      {
        onSuccess: () => {
          if (accept) router.push({ pathname: "/party/[partyId]/chat", params: { partyId } });
        },
        // An Alert, not a toast: "it expired" or "it's full" is the end of this invite, and a
        // two-second toast over a card that then vanishes reads as the app eating the tap.
        onError: (err) =>
          Alert.alert(accept ? "Couldn't join the party" : "Couldn't decline the invite", partyInviteErrorMessage(err)),
      },
    );
  }

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
      <Text style={[type.body, { color: colors.text }]}>
        <Text style={type.bodyStrong}>{names || "A duo"}</Text> swiped together and all said yes to you. Accept to
        join their party chat.
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => handleRespond(true)}
          disabled={respond.isPending}
          hitSlop={8}
        >
          <Text style={[type.bodyStrong, { color: colors.voltDim }]}>Accept</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => handleRespond(false)}
          disabled={respond.isPending}
          hitSlop={8}
        >
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
