import { Alert, View } from "react-native";
import { router } from "expo-router";
import { MIN_AGE } from "@duoqueue/shared-types";

import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { usePreferences } from "@/features/matching/usePreferences";
import { DuoPopsOptInCard } from "@/features/queue/DuoPopsOptInCard";
import { EMPTY_DECK_COPY } from "@/features/queue/queueCopy";
import { queueUpEmptyDeckLabel } from "@/features/queue/queueState";
import { useQueueUpSheetStore } from "@/features/queue/queueUpSheetStore";
import { useQueueState } from "@/features/queue/useQueueState";
import { useTheme } from "@/theme/useTheme";

import { filteredSubtitle } from "./emptyDeckDecisions";
import { useEmptyDeckReason } from "./useEmptyDeckReason";

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
  const { save } = usePreferences();
  const reason = useEmptyDeckReason(true);
  const queueState = useQueueState();

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
  // NOBODY NEW: QUEUE UP, THEN INVITE, THEN REFRESH.
  //
  // WHY QUEUE UP IS THE FILLED BUTTON. It is the only action on this screen that puts two
  // people online at once. Waiting for a ping and refreshing a pool the server has just
  // said is empty are both passive; inviting brings somebody, but tomorrow. Queue up tells
  // the player's matches they are free for the hour and, in North America with the ping
  // on, sends a Duo Pop to up to six players in their game who have not met them yet. Its
  // label counts down while they are queued ("Queued for 42 min"), and a second tap opens
  // the same sheet the deck header does, so it never queues twice.
  //
  // INVITE STAYS, UNDER IT. The argument that put the invite entry point here, and only
  // here, still holds: this is the one screen where the player's problem ("there is
  // nobody here") and the invite's promise ("bring somebody") are the same sentence, and
  // the person reading it is the most motivated inviter DuoQueue will ever have. When the
  // pool stops being empty this entry point disappears, deliberately. It is absent from
  // the "filtered" branch above for the same reason as before: somebody whose own filters
  // hide a full deck needs those two buttons, not a recruiting drive.
  //
  // "TURN ON THE PING" IS GONE FROM HERE. Notifications are now asked where they pay off:
  // the Duo Pops card above this (which asks iOS too), the deck's pre-ask after a like,
  // DUO LOCKED's, and Settings > Notifications. The subtitle still promises the new-player
  // ping only when it can actually reach them (`reason.canPing`).
  //
  // REFRESH STAYS, AS THE QUIET LINK. `useDeck` latches an "exhausted" flag once a refill
  // returns nobody new, and only its own refetch clears it, so without it a player sitting
  // here when their invited friend finishes signing up would have to restart the app to
  // see them, which is the moment this screen exists to serve.
  return (
    <View style={{ flex: 1 }}>
      <DuoPopsOptInCard surface="empty" />
      <EmptyState
        icon="game-controller"
        tick={EMPTY_DECK_COPY.tick}
        title={EMPTY_DECK_COPY.title}
        subtitle={EMPTY_DECK_COPY.subtitle(reason.canPing)}
        actionLabel={queueUpEmptyDeckLabel(queueState)}
        actionVariant="primary"
        onAction={useQueueUpSheetStore.getState().open}
        secondaryActionLabel={EMPTY_DECK_COPY.invite}
        onSecondaryAction={() => router.push("/invite")}
        tertiaryActionLabel={EMPTY_DECK_COPY.refresh}
        onTertiaryAction={onRefresh}
      />
    </View>
  );
}
