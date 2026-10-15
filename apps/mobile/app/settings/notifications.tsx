import { useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import Animated from "react-native-reanimated";

import { Card } from "@/components/Card";
import { EdgeCard } from "@/components/EdgeCard";
import { EmptyState } from "@/components/EmptyState";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { ToggleRow } from "@/components/ToggleRow";
import { askForPush } from "@/features/push/askForPush";
import { PUSH_ON_TOAST, settingsBannerCopy } from "@/features/push/pushAsk";
import { usePushPermission } from "@/features/push/usePushPermission";
import {
  NOTIFICATION_CATEGORIES,
  turningOnNeedsPermission,
  visibleCategories,
  type NotificationCategory,
} from "@/features/settings/notificationCategories";
import { useNotificationSettings } from "@/features/settings/useNotificationSettings";
import { useRequireSession } from "@/hooks/useRequireSession";
import { hapticSuccess } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { layoutTransition, quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

/**
 * How many rows the skeleton draws: as many as this screen last showed in this run, and every
 * category before that. A row shows only once its column exists (visibleCategories), so before a
 * migration lands the real list is shorter than the full one, and a skeleton of the full length
 * made the card's bottom edge snap up by a row when the switches arrived. The plan's rule is a
 * skeleton the size of the content.
 */
let lastRowCount = NOTIFICATION_CATEGORIES.length;

function RowSkeleton() {
  const { radius, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Skeleton width="45%" height={15} />
        <Skeleton width="70%" height={12} />
      </View>
      <Skeleton width={44} height={26} borderRadius={radius.chip} />
    </View>
  );
}

/**
 * Settings > Notifications: one switch per category the database actually has.
 *
 * The rows come from `visibleCategories` (notificationCategories.ts): a category shows only when
 * the fetched settings row has its column, so "Someone wants to duo with you" (0072), "News from
 * DuoQueue" (0081) and "Duo Pops" (the Queue Up migration) each appear the moment their column
 * is live, and never as a switch that saves nothing.
 *
 * Above the switches, when iOS has notifications off, a standing line says so: denied with no
 * prompt left gets Open Settings, never asked gets Turn on. No "Not now": the player opened this
 * screen, so it is a status, not an interruption. Back from the Settings app with notifications
 * on, the permission re-read (usePushPermission) removes the line, the list slides up into its
 * place, and the phone's push token is registered without a relaunch.
 *
 * Turning a switch on while iOS has never been asked asks it then: that is the player saying
 * they want the notification.
 */
export default function NotificationSettings() {
  useRequireSession();
  const { colors, spacing } = useTheme();
  const queryClient = useQueryClient();
  const profileId = useSessionStore((s) => s.session?.user.id);
  const showToast = useToastStore((s) => s.showToast);
  const { settings, isLoading, error, update, refetch } = useNotificationSettings();
  const { data: permission } = usePushPermission();
  const [asking, setAsking] = useState(false);
  // NO SNAP-BACK. React Native's Switch puts itself back to its `value` prop in the render that
  // follows a flip unless that prop has already changed (Switch.js's layout effect sends
  // setValue(old)). The optimistic cache write in useNotificationSettings cannot be in that
  // render: onMutate awaits cancelQueries, and react-query tells its observers on a setTimeout
  // 0, so the switch flicked back and then over again. This map is set in the same event as
  // the flip, so React renders both together and the switch never moves backwards. Each entry
  // is cleared once its save settles, by which time the cache holds the answer (or, after a
  // failure, the rolled-back row, and the switch slides back with the error toast).
  const [pending, setPending] = useState<Partial<Record<NotificationCategory, boolean>>>({});

  const banner =
    !permission || permission.status === "granted" ? null : permission.canAskAgain ? "undetermined" : "denied";

  function onToggle(category: NotificationCategory, next: boolean) {
    setPending((p) => ({ ...p, [category]: next }));
    const settle = () =>
      setPending((p) => {
        // A later flip of the same row owns the entry now; leave it for that save to clear.
        if (p[category] !== next) return p;
        const rest = { ...p };
        delete rest[category];
        return rest;
      });
    // The failure toast and the rollback live in the mutation (onError); this only lets go.
    void update.mutateAsync({ [category]: next }).then(settle, settle);
    if (turningOnNeedsPermission(next, permission)) void askForPush(profileId, queryClient);
  }

  async function handleBanner() {
    if (asking) return;
    setAsking(true);
    const outcome = await askForPush(profileId, queryClient);
    setAsking(false);
    if (outcome === "register-token") {
      hapticSuccess();
      showToast(PUSH_ON_TOAST);
    }
  }

  const rows = visibleCategories(settings);
  if (settings && rows.length > 0) lastRowCount = rows.length;
  const divider =<View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing.md }} />;

  return (
    <ScreenContainer title="Notifications" showBack>
      {error && !settings ? (
        <EmptyState
          icon="cloud-offline"
          title="Couldn't load your settings"
          subtitle="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void refetch()}
          tick="OFFLINE"
        />
      ) : (
        <>
          {banner && (
            <Animated.View key={banner} entering={revealEntering()} exiting={quickExiting()}>
              <EdgeCard {...settingsBannerCopy(banner)} onPrimary={() => void handleBanner()} primaryLoading={asking} />
            </Animated.View>
          )}
          <Animated.View layout={layoutTransition()}>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {isLoading || !settings ? (
                NOTIFICATION_CATEGORIES.slice(0, lastRowCount).map((c, i) => (
                  <View key={c.value}>
                    {i > 0 && divider}
                    <RowSkeleton />
                  </View>
                ))
              ) : (
                // The switches fade in over the skeleton's place instead of cutting in.
                <Animated.View entering={revealEntering()}>
                  {rows.map((c, i) => (
                    <View key={c.value}>
                      {i > 0 && divider}
                      <ToggleRow
                        label={c.label}
                        hint={c.hint}
                        value={pending[c.value] ?? (settings[c.value] === true)}
                        onValueChange={(next) => onToggle(c.value, next)}
                      />
                    </View>
                  ))}
                </Animated.View>
              )}
            </Card>
          </Animated.View>
        </>
      )}
    </ScreenContainer>
  );
}
