import type { ReactNode } from "react";
import { Alert, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp, ReduceMotion, useReducedMotion, ZoomIn } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Name } from "@/components/Name";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { partyJoinOutcome, partyPreviewOf } from "@/features/party/partyCall";
import {
  PARTY_ARRIVAL_COPY,
  PARTY_JOIN_RESULT_COPY,
  partyJoinErrorOutcome,
  partyMemberLine,
} from "@/features/party/partyCopy";
import { useJoinPartyByCode, usePreviewPartyCode } from "@/features/party/usePartyCall";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import type { PartyInviteArrival } from "@/lib/invite";
import { revealEntering, stackSpringEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

/** A member row's height, for the skeleton rows while the preview loads. */
const MEMBER_ROW_H = 21;

/**
 * The arrival for a party LFG post's code (/invited, kind "party"): who is in the party, with
 * their ages, and one tap to take the last seat.
 *
 * WHY THE SEAT IS TAKEN HERE AND NOT AT SIGN-UP. The code was typed at the front door and only
 * READ since (resolve_party_code). Nothing is written until this "Join the party"
 * (join_party_by_code), one atomic step under the party's lock that adds the member, fills the
 * post and tells the two members. So an abandoned sign-up never holds the seat, Stop post stops
 * it for everyone who has not joined yet, and "Not right now" needs no server call at all.
 *
 * Same layout and motion as the duo arrival, so both read as one screen: the tick, the title and
 * the line fade in, the card springs in, the buttons rise.
 *
 * WHERE IT GOES is the parent's (InvitedScreen): `onJoined` opens the party chat and `onLeave` is
 * "Not right now". Arrived from sign-up or a link, both replace /invited and clear the stored
 * arrival only after navigating; arrived from Matches, the arrival was never stored and "Not right
 * now" goes back to Matches.
 */
export function PartyArrival({
  arrival,
  onLeave,
  onJoined,
}: {
  arrival: PartyInviteArrival;
  onLeave: () => void | Promise<void>;
  onJoined: (partyId: string) => void | Promise<void>;
}) {
  const { colors, spacing, type } = useTheme();
  const reduced = useReducedMotion();
  const preview = usePreviewPartyCode(arrival.code);
  const join = useJoinPartyByCode();

  const state = preview.data ? partyPreviewOf(preview.data) : null;
  const name = (state?.kind === "live" ? state.sharerName : null) ?? arrival.inviterName;

  async function handleJoin() {
    try {
      const outcome = partyJoinOutcome(await join.mutateAsync(arrival.code));
      if (outcome.kind === "open-chat") {
        hapticSuccess();
        await onJoined(outcome.partyId);
        return;
      }
      // Somebody else got there first, a member stopped the post, or this player may not join
      // (the reason is never named: a refusal must not reveal a block or a report).
      hapticError();
      Alert.alert(PARTY_ARRIVAL_COPY.joinFailedTitle, PARTY_JOIN_RESULT_COPY[outcome.status]);
      void onLeave();
    } catch (err) {
      hapticError();
      // A refusal that will not change (the kill switch, a ban, a profile not set up) leaves. A
      // dropped connection or the rate limit stays, so Join can be tapped again.
      const failure = partyJoinErrorOutcome(err);
      Alert.alert(PARTY_ARRIVAL_COPY.joinFailedTitle, failure.message);
      if (failure.leave) void onLeave();
    }
  }

  const fade = (delay: number) => FadeIn.duration(400).delay(delay).reduceMotion(ReduceMotion.Never);

  let card: ReactNode;
  let buttons: ReactNode;
  let title: string | null = PARTY_ARRIVAL_COPY.title(name);
  let body: string = PARTY_ARRIVAL_COPY.body;

  if (preview.isPending) {
    card = (
      <View style={{ gap: spacing.sm }}>
        <Skeleton width="60%" height={MEMBER_ROW_H} />
        <Skeleton width="50%" height={MEMBER_ROW_H} />
      </View>
    );
    buttons = (
      <>
        <Button label={PARTY_ARRIVAL_COPY.join} disabled onPress={() => undefined} />
        <Button label={PARTY_ARRIVAL_COPY.notNow} variant="ghost" haptic="light" onPress={() => void onLeave()} />
      </>
    );
  } else if (preview.isError || !state) {
    card = <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{PARTY_ARRIVAL_COPY.loadFailed}</Text>;
    buttons = (
      <>
        <Button label={PARTY_ARRIVAL_COPY.tryAgain} onPress={() => void preview.refetch()} />
        <Button label={PARTY_ARRIVAL_COPY.notNow} variant="ghost" haptic="light" onPress={() => void onLeave()} />
      </>
    );
  } else if (state.kind === "closed") {
    title = null;
    body = PARTY_JOIN_RESULT_COPY[state.status];
    card = null;
    buttons = <Button label={PARTY_ARRIVAL_COPY.findPlayers} onPress={() => void onLeave()} />;
  } else if (state.kind === "member") {
    // Their own party's code. join_party_by_code answers "member" with the party's id, which is
    // how this opens the chat (nothing is written).
    title = null;
    body = PARTY_ARRIVAL_COPY.alreadyIn;
    card = null;
    buttons = (
      <>
        <Button label={PARTY_ARRIVAL_COPY.openChat} loading={join.isPending} onPress={() => void handleJoin()} />
        <Button label={PARTY_ARRIVAL_COPY.notNow} variant="ghost" haptic="light" onPress={() => void onLeave()} />
      </>
    );
  } else {
    card = (
      <View style={{ gap: spacing.sm, alignSelf: "stretch" }}>
        {state.gameName ? (
          <Text style={[type.bodyStrong, { color: colors.text, textAlign: "center" }]}>{state.gameName}</Text>
        ) : null}
        {state.members.map((m) => (
          <View key={`${m.name}-${m.age ?? ""}`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="person" size={14} color={colors.voltDim} />
            {/* AGES STAY: "Sam, 24", as on every card in the app. */}
            <Name variant="body" numberOfLines={1} style={{ color: colors.text, flex: 1 }}>
              {partyMemberLine(m.name, m.age)}
            </Name>
          </View>
        ))}
      </View>
    );
    buttons = (
      <>
        <Button label={PARTY_ARRIVAL_COPY.join} loading={join.isPending} onPress={() => void handleJoin()} />
        <Button
          label={PARTY_ARRIVAL_COPY.notNow}
          variant="ghost"
          haptic="light"
          disabled={join.isPending}
          onPress={() => void onLeave()}
        />
      </>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <Animated.Text entering={fade(0)} style={[type.tick, { color: colors.voltDim }]}>
            {`[ ${PARTY_ARRIVAL_COPY.tick} ]`}
          </Animated.Text>
          {title ? (
            <Animated.View entering={fade(120)}>
              <Text style={[type.screenTitle, { color: colors.text, textAlign: "center" }]}>{title}</Text>
            </Animated.View>
          ) : null}
          <Animated.View entering={fade(240)}>
            <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{body}</Text>
          </Animated.View>
        </View>

        {card ? (
          // Under Reduce Motion a springified builder cuts its fade too, so it is a plain fade there.
          <Animated.View entering={stackSpringEntering(ZoomIn.delay(200), reduced)}>
            <Card luminous style={{ alignItems: "center", gap: spacing.sm }}>
              <Ionicons name="people" size={22} color={colors.volt} />
              {card}
            </Card>
          </Animated.View>
        ) : null}

        <Animated.View
          entering={reduced ? revealEntering() : FadeInUp.duration(400).delay(320)}
          style={{ gap: spacing.sm }}
        >
          {buttons}
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}
