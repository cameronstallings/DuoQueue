import { useEffect, useState } from "react";
import type { TextStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";

import { usePartyInvites } from "@/features/party/useParty";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

import { badgeLabel, matchesBadgeCount, nextSeen, readSeen, withOpened, writeSeen } from "./matchesBadge";
import { useMatchesTabFocus } from "./matchesTabFocus";
import { MATCHES_QUERY_KEY, useMatches } from "./useMatches";

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * The Matches tab's badge: unread conversations, pending party invites, and matches not yet seen
 * on the tab (matchesBadge.ts has the maths and why).
 *
 * "New" means not yet SEEN ON THIS TAB, not "has unread messages": unread messages wait on
 * players who swipe on without ever opening the chat, so a match nobody has messaged yet would
 * otherwise never show up anywhere. Opening the tab marks every match on it as seen, and opening a
 * match's chat from anywhere marks that one (ChatScreen calls `markOpened`); the seen set
 * is per account, on this phone, and it seeds with the current matches the first time (an update
 * to 1.0.2 shows no stale "new" badge).
 *
 * It is on exactly when the tabs are on screen, i.e. when `sessionRoute` answers "app": signed in
 * with an onboarded profile held. So the two RPCs never run signed out or mid-signup, and a
 * failed profile re-read (profileStatus "error", which keeps the held profile and keeps routing
 * to the app; refreshProfile runs on every resume, Discord save and looking-now toggle) does not
 * blank the badge under tabs that are still showing. An authoritative "missing" clears the held
 * profile, which turns this off too. (Decided here rather than passed in by the tab layout,
 * whose own session reads move into `useSessionRoute` with Group A; once that hook is on this
 * branch, `useSessionRoute() === "app"` is the one-line replacement for the selector below.)
 * While on, a match or message push re-reads the list at once, so the badge moves when the push
 * lands rather than on the next 15-second poll.
 *
 * Returns the tab's `tabBarBadge` label and its `tabBarBadgeStyle`: volt with onVolt mono digits
 * (an audited pair), not iOS red, because the badge is good news.
 */
export function useMatchesBadge(): { label: string | undefined; style: TextStyle } {
  const queryClient = useQueryClient();
  const { colors, fonts } = useTheme();
  const enabled = useSessionStore((s) => s.status === "signed_in" && s.profile?.onboarding_completed === true);
  const profileId = useSessionStore((s) => s.session?.user.id);
  const { data: matches } = useMatches({ enabled });
  const { data: invites } = usePartyInvites({ enabled });
  const focused = useMatchesTabFocus((s) => s.focused);
  const opened = useMatchesTabFocus((s) => s.opened);

  // What the phone has stored for this account: undefined while it is being read, null when
  // nothing was (which seeds below).
  const [stored, setStored] = useState<{ profileId: string; seen: readonly string[] | null } | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !profileId) return;
    let cancelled = false;
    void readSeen(AsyncStorage, profileId).then((seen) => {
      if (!cancelled) setStored({ profileId, seen });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, profileId]);

  const seen = stored && stored.profileId === profileId ? stored.seen : undefined;

  // Seed (nothing stored yet) or, while the tab is in front, mark everything on it as seen; and
  // whatever the tab, mark every match whose chat has been opened once it is in the list.
  // Updated during render (React's "adjust state while rendering"), so the badge never shows a
  // stale count for a frame; `nextSeen` and `withOpened` are idempotent, so this settles in one
  // pass.
  if (profileId && matches && seen !== undefined) {
    const ids = matches.map((m) => m.match_id);
    const next = withOpened(seen === null || focused ? nextSeen(seen, ids) : seen, opened, ids);
    if (seen === null || !sameIds(seen, next)) setStored({ profileId, seen: next });
  }

  useEffect(() => {
    if (stored?.seen) void writeSeen(AsyncStorage, stored.profileId, stored.seen);
  }, [stored]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const category = notification.request.content.data?.category;
      if (category === "new_match" || category === "new_message") {
        void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
      }
    });
    return () => subscription.remove();
  }, [enabled, queryClient]);

  const style: TextStyle = {
    backgroundColor: colors.volt,
    color: colors.onVolt,
    fontFamily: fonts.monoSemibold,
    fontSize: 11,
  };
  const label = enabled
    ? badgeLabel(matchesBadgeCount({ matches, pendingPartyInvites: invites?.length ?? 0, seen }))
    : undefined;
  return { label, style };
}
