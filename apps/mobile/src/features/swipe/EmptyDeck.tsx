import { Alert, Linking } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { MIN_AGE } from "@duoqueue/shared-types";

import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { usePreferences } from "@/features/matching/usePreferences";
import { ensurePushPermission, registerForPushNotifications } from "@/lib/notifications";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

import { filteredSubtitle, firstPingStep, pingOutcome } from "./emptyDeckDecisions";
import { NOTIFICATION_PERMISSION_QUERY_KEY, useEmptyDeckReason } from "./useEmptyDeckReason";

/** Everything "Clear filters" writes. It clears the premium filters as well as the free ones
 * even for a user who is not premium, which is safe — `get_deck` already nulls those six
 * server-side for a non-premium viewer, so they are inert either way — and it stops a filter
 * set during a lapsed subscription from silently re-applying itself the day they resubscribe.
 *
 * Not `filter_recently_active: null`: the column is `not null default false`. */
const CLEARED_FILTERS = {
  min_age: MIN_AGE,
  max_age: 99,
  preferred_regions: null,
  required_language: null,
  filter_game_id: null,
  filter_platform: null,
  filter_skill_level: null,
  filter_playstyle: null,
  filter_show_id: null,
  filter_recently_active: false,
} as const;

/**
 * The deck's empty state, which now knows why it is empty.
 *
 * Rendered only when the deck has settled at zero cards, which is also what makes it safe for
 * this component to ask the server for the pool size: mounting IS the "the deck is empty"
 * signal, so `useEmptyDeckReason(true)` here needs no other gate.
 */
export function EmptyDeck({ onRefresh }: { onRefresh: () => void }) {
  const { radius } = useTheme();
  const queryClient = useQueryClient();
  const profileId = useSessionStore((s) => s.session?.user.id);
  const { save } = usePreferences();
  const reason = useEmptyDeckReason(true);

  async function handleClearFilters() {
    try {
      await save.mutateAsync(CLEARED_FILTERS);
      // `save` already invalidates ["deck"], but the deck hook latches an "exhausted" flag
      // when a refill comes back with nobody new in it, and only its own refetch clears that.
      // Going through it here is what lets the deck page again after the filters come off.
      onRefresh();
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function handleTurnOnPing() {
    if (reason.kind !== "new") return;

    const step = firstPingStep(reason);
    if (step === "nothing") return;
    if (step === "open-notification-settings") {
      router.push("/settings/notifications");
      return;
    }

    const result = await ensurePushPermission();
    switch (pingOutcome(result)) {
      case "register-token":
        // Permission is not a token. `push_tokens` is what the alert sweep joins against, so
        // skipping this would leave a user who has just agreed to a notification with no
        // address to send it to.
        if (profileId) await registerForPushNotifications(profileId);
        await queryClient.invalidateQueries({ queryKey: NOTIFICATION_PERMISSION_QUERY_KEY });
        break;
      case "open-os-settings":
        // Straight there, no intermediate alert: they tapped a button that says exactly what
        // it does, and iOS will never show the prompt again. Same reasoning the deck screen
        // uses for going straight to the paywall on the last swipe.
        await Linking.openSettings();
        break;
      case "nothing":
        // They just answered the prompt with "Don't Allow". Sending them to Settings a second
        // later would be asking again with extra steps.
        break;
    }
  }

  if (reason.kind === "resolving") {
    return <Skeleton style={{ flex: 1, borderRadius: radius.card }} />;
  }

  if (reason.kind === "filtered") {
    return (
      <EmptyState
        icon="options"
        tick="FILTERED"
        title="Your filters are hiding everyone"
        subtitle={filteredSubtitle(reason.poolSize)}
        actionLabel="Clear filters"
        onAction={() => void handleClearFilters()}
        secondaryActionLabel="Adjust filters"
        onSecondaryAction={() => router.push("/filters")}
      />
    );
  }

  // ------------------------------------------------------------------------------------
  // THE INVITE ENTRY POINT LIVES HERE, AND ONLY HERE.
  //
  // Not the profile tab, not settings, and not all three. The argument for an invite
  // button is the emptiness itself: this is the only screen in the app where the user's
  // problem ("there is nobody here") and the invite's promise ("bring somebody") are the
  // same sentence, and the person reading it is the most motivated inviter DuoQueue will
  // ever have. A share row in Settings is a share row nobody presses, because nobody has
  // ever opened Settings looking for a way to bring a friend; the profile tab is where you
  // go to edit yourself, and interrupting a maintenance task with a growth ask is how that
  // tab starts feeling like a billboard.
  //
  // The consequence, stated because it is deliberate and not an oversight: when the pool
  // stops being empty this entry point disappears. That is correct. The argument above is
  // an argument about a four-user app, and it expires exactly when the emptiness does. If
  // a permanent surface is wanted later the profile tab is the place for it, but shipping
  // one today would be shipping a growth surface with no argument behind it.
  //
  // It is also deliberately absent from the "filtered" branch above. Somebody whose own
  // filters are hiding a deck full of people does not need to recruit anybody; they need
  // the two buttons that screen already has.
  //
  // WHY IT IS THE PRIMARY ACTION IN BOTH BRANCHES. The alternatives are both passive --
  // wait for a ping, or refresh a pool that the server has just said is empty. Inviting is
  // the only thing on this screen that changes the situation.
  const invite = () => router.push("/invite");

  if (reason.canPing) {
    return (
      <EmptyState
        icon="game-controller"
        tick="YOU ARE EARLY"
        title="You are early"
        subtitle={
          "DuoQueue is brand new, so there is nobody left in your deck right now. We will send " +
          "you a ping the moment a player who shares your games signs up. Bringing somebody you " +
          "already play with is faster."
        }
        actionLabel="Invite your duo"
        onAction={invite}
        secondaryActionLabel="Refresh"
        onSecondaryAction={onRefresh}
      />
    );
  }

  // Three honest answers on this branch, so this is the one screen that uses EmptyState's
  // text-weight third action. Refresh cannot simply be dropped: `useDeck` latches an
  // "exhausted" flag once a refill returns nobody new, and only its own refetch clears it,
  // so without a button here a user sitting on this screen when their invited friend
  // finishes signing up would have to restart the app to see them. That is precisely the
  // moment this whole feature exists to serve.
  return (
    <EmptyState
      icon="game-controller"
      tick="YOU ARE EARLY"
      title="You are early"
      subtitle={
        "DuoQueue is brand new, so there is nobody left in your deck right now. Bring somebody " +
        "you already play with, or turn on notifications and we will ping you the moment a " +
        "player who shares your games signs up."
      }
      actionLabel="Invite your duo"
      onAction={invite}
      secondaryActionLabel="Turn on the ping"
      onSecondaryAction={() => void handleTurnOnPing()}
      tertiaryActionLabel="Refresh"
      onTertiaryAction={onRefresh}
    />
  );
}
