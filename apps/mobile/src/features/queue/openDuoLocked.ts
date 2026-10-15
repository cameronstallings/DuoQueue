import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { fetchMatches, MATCHES_QUERY_KEY, type MatchListItem } from "@/features/chat/useMatches";
import { matchParams } from "@/features/match/matchMoment";
import { queryClient } from "@/lib/query-client";

import { DUO_LOCKED_SEEN_KEY, parseCelebrated, rememberCelebrated, wasCelebrated } from "./duoLockedOnce";

/**
 * The SENDER's DUO LOCKED after someone grabbed their Duo Pop, played once per lock per phone.
 * (The recipient's moment plays in place on the Pop card; this is never their path.)
 *
 * Three things can bring the same lock here: the enriched new_match push landing while the app is
 * open (usePopPushes), a tap on that push (useNotificationTapRouting), and one status read on
 * resume for a sender without notification permission (usePopPushes). The celebrated list
 * (duoLockedOnce.ts) is what makes it once: it is marked at the start of `openDuoLocked`, in
 * memory first and on disk after, so a second path checking `isDuoLockedCelebrated` a moment
 * later already sees it.
 */

let celebrated: string[] = [];
let loading: Promise<void> | null = null;

function persist(): void {
  try {
    AsyncStorage.setItem(DUO_LOCKED_SEEN_KEY, JSON.stringify(celebrated)).catch(() => {});
  } catch {
    // A list that did not stick can only mean a moment plays once more on this phone.
  }
}

/** Reads the stored list once per launch. Anything marked before it finished is kept. */
export function loadCelebrated(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      let stored: string[] = [];
      try {
        stored = parseCelebrated(await AsyncStorage.getItem(DUO_LOCKED_SEEN_KEY));
      } catch {
        stored = [];
      }
      const markedSince = celebrated;
      let merged = stored;
      for (const id of [...markedSince].reverse()) merged = rememberCelebrated(merged, id);
      celebrated = merged;
      if (markedSince.length > 0) persist();
    })();
  }
  return loading;
}

export function isDuoLockedCelebrated(popId: string): boolean {
  return wasCelebrated(celebrated, popId);
}

/** The pops this phone has already played DUO LOCKED for, newest first (for celebrateOnResume). */
export function celebratedPops(): readonly string[] {
  return celebrated;
}

/** The moment the screen it opens takes over. "push" from a push or a resume (a sheet over the
 * deck or wherever the player is); "replace" when the caller is itself a screen to swap out. */
export interface OpenDuoLockedInput {
  matchId: string;
  popId: string;
  poppedInSeconds: number | null;
  canDuo: boolean;
  /** The partner's name when the caller already has it (the sheet's queue-up row). */
  nameHint?: string | null;
  mode: "push" | "replace";
}

/** How long DUO LOCKED waits for the match list (their name and picture) before opening with
 * what it has. The moment matters more than the photo. */
const MATCH_READ_MS = 1500;

export async function openDuoLocked(input: OpenDuoLockedInput): Promise<void> {
  celebrated = rememberCelebrated(celebrated, input.popId);
  persist();

  const row = await Promise.race<MatchListItem | null>([
    queryClient
      .fetchQuery({ queryKey: MATCHES_QUERY_KEY, queryFn: fetchMatches, staleTime: 0, retry: false })
      .then((matches) => matches.find((m) => m.match_id === input.matchId) ?? null)
      .catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), MATCH_READ_MS)),
  ]);

  const params = matchParams({
    matchId: input.matchId,
    name: row?.other_display_name ?? input.nameHint ?? "your duo",
    photo: row?.otherPhotoUrl ?? null,
    canDuo: input.canDuo,
    sharedGames: null,
    poppedInSeconds: input.poppedInSeconds,
  });
  router[input.mode]({ pathname: "/match/[matchId]", params });
}
