import { useLocalSearchParams } from "expo-router";

import { DuoLockedScreen } from "@/features/match/DuoLockedScreen";
import { exitMatchMoment } from "@/features/match/exitMatchMoment";
import { type MatchRouteParams, matchReason, parsePoppedSeconds } from "@/features/match/matchMoment";
import { PushPreAskCard } from "@/features/push/PushPreAskCard";
import { useDuoLockedReviewPrompt } from "@/features/rating/useReviewTriggers";
import { useRequireSession } from "@/hooks/useRequireSession";

/**
 * DUO LOCKED, opened over the Deck, Requests, Online now or Highlights when a like comes back, after
 * an invite, and for a Duo Pop's sender (with `popped`, the time it took to be answered). The whole
 * moment lives in DuoLockedScreen, which the Duo Pop card also ends on; this route only reads the
 * params the opener passed (matchParams in matchMoment.ts).
 */
export default function MatchCelebrationScreen() {
  useRequireSession();
  const params = useLocalSearchParams<MatchRouteParams>();
  // Counts this DUO LOCKED for the rating prompt; DuoLockedScreen calls it once, at the lock.
  const onLocked = useDuoLockedReviewPrompt(params.matchId);
  return (
    <DuoLockedScreen
      variant="match"
      theirName={params.name || "your new match"}
      theirPhoto={params.photo || null}
      reason={matchReason(params)}
      poppedInSeconds={parsePoppedSeconds(params.popped)}
      onExit={(exit) => exitMatchMoment(exit, params.matchId)}
      onLocked={onLocked}
      belowButtons={<PushPreAskCard surface="match" otherName={params.name || undefined} />}
    />
  );
}
