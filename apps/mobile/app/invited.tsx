import { Alert, Text, View } from "react-native";
import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import Animated, { FadeIn, FadeInUp, ReduceMotion, useReducedMotion, ZoomIn } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Name } from "@/components/Name";
import { PlayerMark } from "@/components/PlayerMark";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useAcceptInvite } from "@/features/invite/useInvite";
import { matchParams } from "@/features/match/matchMoment";
import { useProfileCard } from "@/features/profile/useProfileCard";
import { cardPicture } from "@/features/swipe/cardChips";
import { useRequireSession } from "@/hooks/useRequireSession";
import { hapticError } from "@/lib/haptics";
import { inviteErrorMessage } from "@/lib/invite";
import { useInviteStore } from "@/store/invite-store";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { revealEntering, stackSpringEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

const AVATAR_SIZE = 96;

/**
 * The arrival. What somebody who came from an invite sees instead of the generic
 * "You're all set!" screen.
 *
 * WHY THIS SCREEN EXISTS. An invited person did not arrive because of an ad. A specific
 * friend asked them to come, and for the whole first minute of the app that is the only
 * thing they care about. Dropping them into an empty deck and hoping they find that person
 * by swiping would waste the one connection this install already has.
 *
 * WHY THE ACTION IS A REAL SWIPE AND NOT AN AUTOMATIC MATCH. `accept_invite` writes two
 * ordinary rows into `public.swipes` — the invitee's, here, and the inviter's, which their
 * link stood for. See D1 in 0065_invites.sql. The consequence for this screen is that
 * "matched" is not guaranteed: if the inviter had already passed on this person from their
 * own deck, that judgement stands and the tap becomes a duo request instead. Both outcomes
 * are handled below, and neither is presented as a failure.
 */
export default function InvitedScreen() {
  useRequireSession();
  const { colors, radius, spacing, type } = useTheme();
  const reduced = useReducedMotion();
  const arrival = useInviteStore((s) => s.arrival);
  const clearArrival = useInviteStore((s) => s.clearArrival);
  const accept = useAcceptInvite();
  const showToast = useToastStore((s) => s.showToast);
  const refreshProfile = useSessionStore((s) => s.refreshProfile);

  // Reached by a redirect that already checked this, and by a back-navigation that did not.
  // `useProfileCard` is called unconditionally below, so this cannot move above the hooks.
  const inviterId = arrival?.inviterId ?? "";
  const { data: card, isPending, isError } = useProfileCard(inviterId);
  const inviterPicture = card ? cardPicture(card) : null;

  if (!arrival) return <Redirect href="/(tabs)" />;

  // Both exits refresh the session profile first, for the same reason `welcome.tsx` does
  // it there rather than in the wizard: this screen can be the one that replaces the
  // welcome screen at the end of onboarding, and at that moment the session store still
  // holds `onboarding_completed: false`. Navigating to (tabs) without refreshing would be
  // bounced straight back into the wizard by its layout.
  async function leave() {
    clearArrival();
    await refreshProfile();
    router.replace("/(tabs)");
  }

  async function handleDuoUp() {
    if (!arrival) return;
    try {
      const result = await accept.mutateAsync();
      clearArrival();
      await refreshProfile();
      if (result.matched && result.match_id) {
        // Straight into the existing match celebration, which fires the one success haptic at
        // the lock. The invite flow deliberately owns no payoff screen of its own: this is a
        // match like any other, and it should look like one. (useProfileCard's
        // shared_games_count is a stand-in 0, not a fact, so no reason strip here.)
        router.replace({
          pathname: "/match/[matchId]",
          params: matchParams({
            matchId: result.match_id,
            name: arrival.inviterName,
            photo: inviterPicture,
            canDuo: false,
            sharedGames: null,
          }),
        });
      } else {
        showToast("Duo request sent");
        router.replace("/(tabs)");
      }
    } catch (err) {
      // Not `err.message`: `accept_invite` raises bare tokens like `inviter_unavailable`,
      // and the house `Alert.alert("Something went wrong", err.message)` would print one.
      // See `inviteErrorMessage`.
      hapticError();
      Alert.alert("Something went wrong", inviteErrorMessage(err));
    }
  }

  const name = arrival.inviterName;

  return (
    <ScreenContainer>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <Animated.Text entering={FadeIn.duration(400).reduceMotion(ReduceMotion.Never)} style={[type.tick, { color: colors.voltDim }]}>
            [ INVITED ]
          </Animated.Text>
          <Animated.View entering={FadeIn.duration(400).delay(120).reduceMotion(ReduceMotion.Never)}>
            <Text style={[type.screenTitle, { color: colors.text, textAlign: "center" }]}>
              {name} invited you
            </Text>
          </Animated.View>
          <Animated.View entering={FadeIn.duration(400).delay(240).reduceMotion(ReduceMotion.Never)}>
            <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>
              They asked you to come find duos here. Duo up and you already have one.
            </Text>
          </Animated.View>
        </View>

        {/* Under Reduce Motion a springified builder cuts its fade too and pops in, so it is a plain
            fade there (stackSpringEntering, theme/entering.ts). */}
        <Animated.View entering={stackSpringEntering(ZoomIn.delay(200), reduced)}>
          <Card luminous style={{ alignItems: "center", gap: spacing.sm }}>
            {isPending ? (
              <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={radius.round} />
            ) : inviterPicture ? (
              <Image
                source={{ uri: inviterPicture }}
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: radius.round }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <PlayerMark name={name} size={AVATAR_SIZE} />
            )}

            <Name variant="title" style={{ color: colors.text, textAlign: "center" }}>
              {name}
            </Name>

            {/* The profile may not load — they could have deactivated between sending the
                link and this screen rendering. The invite is still real and `accept_invite`
                does its own check, so the card degrades to the name rather than the screen
                becoming an error. */}
            {!isPending && !isError && card ? (
              <>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  {card.age}
                  {card.region ? ` · ${card.region.toUpperCase()}` : ""}
                </Text>
                {card.topGames.length > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      justifyContent: "center",
                      gap: spacing.xs,
                      marginTop: spacing.xs,
                    }}
                  >
                    {card.topGames.slice(0, 3).map((game) => (
                      <Chip key={game.name} label={game.name} />
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </Card>
        </Animated.View>

        <Animated.View entering={reduced ? revealEntering() : FadeInUp.duration(400).delay(320)} style={{ gap: spacing.sm }}>
          <Button
            label={`Duo with ${name}`}
            onPress={() => void handleDuoUp()}
            loading={accept.isPending}
          />
          <Button label="Not right now" variant="ghost" onPress={() => void leave()} />
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}
