import { useEffect, useState } from "react";
import { Alert, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";

import { fetchMatches, MATCHES_QUERY_KEY } from "@/features/chat/useMatches";
import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { useEditableProfileDetails } from "@/features/profile/useEditableProfileDetails";
import { partyLfgPost, lfgRankParts, lfgTags } from "@/features/queue/lfgPost";
import { formatTime } from "@/features/queue/QueueUpSheet";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { inviteUrl } from "@/lib/invite";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";

import { PARTY_CALL_TTL_MS, partyLfgView, partyPairCanPost, type PartyLfgView } from "./partyCall";
import { PARTY_LFG_COPY, partyConsent, partyLfgErrorMessage, partyLfgStartFailure } from "./partyCopy";
import { PARTY_POLL_MS, type PartyMembers } from "./useParty";
import { useEndPartyCall, usePartyCall, usePartyLfgAvailability, useStartPartyCall } from "./usePartyCall";

/** How long Copy post reads "Post copied" (as in the Queue Up sheet). */
const COPIED_MS = 2000;

/** The part of a live post the text is built from. */
interface PostFacts {
  code: string;
  gameId: string | null;
  gameName: string | null;
  untilMs: number;
}

export interface PartyLfg {
  view: PartyLfgView;
  /** Idle: ask, start the post, share it. Live: share it again (the member who did not start it is
   * asked first, once). */
  share: () => void;
  /** Live only: copy the same text (asked first, once, as share is). */
  copy: () => void;
  /** Live only: either member stops the post; its code stops working at once. */
  stop: () => void;
  starting: boolean;
  stopping: boolean;
  copied: boolean;
}

/**
 * The party LFG post's whole flow for one party screen: one read of the live post, and the
 * share, copy and stop actions the row (PartyLfgRow) and the empty deck both use.
 *
 * CONSENT. Nothing leaves the phone without the sharer's explicit yes: the first post is behind
 * an Alert that says who can take the seat, until when, that the other member will see a note in
 * the party chat (0089 writes it), and where to share. The member who did not start it is asked
 * too before their first share or copy, because their post carries their own rank under the
 * party's code. Share opens the iOS share sheet with message-only text (as the Queue Up sheet and
 * the invite screen do); the app never posts by itself.
 *
 * WHAT THE POST CARRIES is only the sharer's own data (partyLfgPost): the post's game, their rank
 * in it, their region and up to two playstyle tags, when the code stops working, the link and the
 * code. No age, and nothing about the other member.
 */
export function usePartyLfg(
  partyId: string | undefined,
  members: PartyMembers | undefined,
  /** The member list's read failed with nothing read before it: the row hides. */
  membersFailed: boolean,
): PartyLfg {
  const profile = useSessionStore((s) => s.profile);
  const myId = useSessionStore((s) => s.session?.user.id);
  const showToast = useToastStore((s) => s.showToast);

  const memberCount = members ? members.ids.length : null;
  const read = usePartyCall(partyId, memberCount === 2);
  const start = useStartPartyCall(partyId);
  const end = useEndPartyCall(partyId);
  // The sharer's own games and playstyles, for the rank and tags lines. Read only for a party that
  // can post at all; already cached when the player has opened their profile.
  const details = useEditableProfileDetails(memberCount === 2 ? profile?.id : undefined);
  // Whether the server has 0089 at all, known before this party's first read answers when the
  // probe is cached (Matches asks it), so a server without 0089 never shows a skeleton that then
  // goes away: the row and the deck caption stay build 19's.
  const probe = usePartyLfgAvailability();
  // The pair check (partyPairCanPost) reads the match list the Matches tab already polls. Its own
  // observer has no interval, so it adds no second poll; it refetches only when the cache is
  // older than the party screen's own cadence.
  const matches = useQuery({
    queryKey: MATCHES_QUERY_KEY,
    queryFn: fetchMatches,
    enabled: memberCount === 2,
    staleTime: PARTY_POLL_MS,
  });

  // A read answers for itself (PGRST202 or 42501: unavailable). A failed first read (offline)
  // hides the row rather than offering a post it cannot vouch for; the next poll brings it back.
  // Before any read has answered, the probe decides, and null (not known yet) draws nothing.
  const available = read.data ? read.data.available : read.isError ? false : probe;
  const pairCanPost = partyPairCanPost({
    myId,
    memberIds: members ? members.ids : null,
    visibleCount: members ? members.profiles.length : 0,
    matchedIds: matches.data ? matches.data.map((m) => m.other_profile_id) : null,
    matchesFailed: matches.isError,
  });
  const view = partyLfgView({
    available,
    pending: read.isPending,
    memberCount,
    membersFailed: membersFailed && !members,
    pairCanPost,
    call: read.data?.available ? read.data.call : null,
    nowMs: Date.now(),
  });

  const otherName =
    members?.profiles.find((m) => m.profile_id !== myId)?.display_name?.trim() || null;

  // The code this member has already said yes to sharing (their own new post, or the other
  // member's after the second-member ask), so the ask is not repeated on every tap.
  const [consentedCode, setConsentedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  function postText(facts: PostFacts): string | null {
    if (!profile) return null;
    const game = details.data?.games.find((g) => g.gameId === facts.gameId);
    const rankLabel = game
      ? lfgRankParts({ rankText: game.rankText, lolTier: game.lolTier, lolDivision: game.lolDivision }).rankLabel
      : null;
    return partyLfgPost({
      gameName: facts.gameName ?? game?.name ?? null,
      regionLabel: REGION_LABELS[profile.region] ?? null,
      rankLabel,
      tags: lfgTags(details.data?.playstyles ?? []),
      untilLabel: formatTime(facts.untilMs, true),
      url: inviteUrl(facts.code, process.env.EXPO_PUBLIC_SUPABASE_URL),
      code: facts.code,
    });
  }

  async function sendPost(facts: PostFacts) {
    const message = postText(facts);
    if (!message) return;
    try {
      // Message only: a separate url field makes some targets drop the text, and the link is
      // already inside the post.
      const result = await Share.share({ message });
      if (result.action === Share.sharedAction) hapticSuccess();
    } catch {
      // The share sheet failed to open or was torn down. Nothing was posted; nothing to say.
    }
  }

  async function copyPost(facts: PostFacts) {
    const message = postText(facts);
    if (!message) return;
    try {
      await Clipboard.setStringAsync(message);
      hapticSuccess();
      setCopied(true);
    } catch {
      // Clipboard unavailable. Share still works.
    }
  }

  function ask(consent: ReturnType<typeof partyConsent>, onYes: () => void) {
    Alert.alert(consent.title, consent.body, [
      { text: consent.cancel, style: "cancel", onPress: () => hapticLight() },
      { text: consent.confirm, onPress: onYes },
    ]);
  }

  async function startAndShare() {
    try {
      const row = await start.mutateAsync();
      setConsentedCode(row.code);
      const untilMs = Date.parse(row.expires_at);
      await sendPost({
        code: row.code,
        gameId: row.game_id,
        gameName: row.game_name,
        untilMs: Number.isFinite(untilMs) ? untilMs : Date.now() + PARTY_CALL_TTL_MS,
      });
    } catch (err) {
      const failure = partyLfgStartFailure(err);
      if (failure.kind === "step") {
        // "Ask {name} to open this party on the latest DuoQueue first": a step, not a failure.
        Alert.alert(failure.title, failure.message);
        return;
      }
      // The error toast buzzes by itself (toast-store), so no haptic here.
      showToast(failure.message, "error");
    }
  }

  /** Run `action` on the live post, asking the member who did not start it first, once. */
  function withLiveConsent(action: (facts: PostFacts) => Promise<void>) {
    if (view.kind !== "live") return;
    const facts = { code: view.code, gameId: view.gameId, gameName: view.gameName, untilMs: view.untilMs };
    if (view.mine || consentedCode === view.code) {
      void action(facts);
      return;
    }
    ask(partyConsent({ time: formatTime(view.untilMs, false), otherName: view.sharerName, firstPost: false }), () => {
      setConsentedCode(facts.code);
      void action(facts);
    });
  }

  function share() {
    if (start.isPending) return;
    if (view.kind === "idle") {
      // The time is read when they are asked: start_party_call stamps now() + 2 hours a moment
      // later, so it is the same minute.
      ask(
        partyConsent({ time: formatTime(Date.now() + PARTY_CALL_TTL_MS, false), otherName, firstPost: true }),
        () => void startAndShare(),
      );
      return;
    }
    withLiveConsent(sendPost);
  }

  function copy() {
    withLiveConsent(copyPost);
  }

  function stop() {
    if (end.isPending) return;
    hapticLight();
    end.mutate(undefined, {
      onSuccess: () => showToast(PARTY_LFG_COPY.stopped, "info"),
      onError: (err) => showToast(partyLfgErrorMessage(err, PARTY_LFG_COPY.stopFailed), "error"),
    });
  }

  return { view, share, copy, stop, starting: start.isPending, stopping: end.isPending, copied };
}
