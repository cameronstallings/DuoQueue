import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PresenceAvatar } from "@/components/PresenceAvatar";
import { Skeleton } from "@/components/Skeleton";
import { type AdmirerListItem, useAdmirers, useAdmirersCount } from "@/features/matching/useAdmirers";
import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { useTheme } from "@/theme/useTheme";

import { PageHeading } from "./PageHeading";
import {
  FREE_REQUESTS_PER_DAY,
  PEOPLE_EXTRAS,
  REQUESTS_COPY,
  hiddenCountLabel,
  peoplePageHeading,
  peoplePanelOrder,
  requestLine,
  requestsIllustrationLabel,
  requestsState,
  type PaywallFrom,
  type PeoplePanel,
  type RequestGameRow,
} from "./paywallCopy";
import { useRequestGames } from "./useRequestGames";

/** Hidden requests are a count only: never a name, picture or initial (that would leak what
 * DuoQueue+ unlocks). At most this many locked rings. */
const LOCKED_RINGS = 5;

function WithPlusRule() {
  const { colors, spacing, type } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.voltDim }} />
      <Text style={[type.tick, { color: colors.voltDim }]}>{REQUESTS_COPY.withPlus}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.voltDim }} />
    </View>
  );
}

function LockedRing({ first }: { first: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        marginLeft: first ? 0 : -6,
        borderWidth: 1,
        borderColor: colors.cardEdge,
        backgroundColor: colors.cardPanel,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
    </View>
  );
}

function RequestsPanel({
  admirers,
  total,
  failed,
  games,
}: {
  admirers: AdmirerListItem[] | undefined;
  total: number | undefined;
  failed: boolean;
  games: { rows: RequestGameRow[]; leagueGameId: string | null } | undefined;
}) {
  const { colors, radius, spacing, type } = useTheme();
  const loading = !failed && (admirers === undefined || total === undefined);
  const shown = (admirers ?? []).slice(0, FREE_REQUESTS_PER_DAY);
  const state = requestsState(Math.max(total ?? 0, shown.length), shown.length);
  const summary = loading ? REQUESTS_COPY.loading : failed ? REQUESTS_COPY.unknown : requestsIllustrationLabel(state, shown.length);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[type.label, { color: colors.textMuted }]}>{REQUESTS_COPY.label}</Text>
        <Text style={[type.tick, { color: colors.textMuted }]}>{REQUESTS_COPY.today}</Text>
      </View>
      <View
        accessible
        accessibilityLabel={summary}
        style={{
          padding: spacing.md,
          gap: spacing.md,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.cardEdge,
          backgroundColor: colors.cardPanel,
        }}
      >
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={36} borderRadius={radius.card} />)
        ) : failed ? (
          <Text style={[type.body, { color: colors.textMuted }]}>{REQUESTS_COPY.unknown}</Text>
        ) : state.kind === "none" ? (
          <Text style={[type.body, { color: colors.textMuted }]}>{REQUESTS_COPY.none}</Text>
        ) : (
          <>
            {shown.map((admirer) => (
              <View key={admirer.profile_id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.tight }}>
                <PresenceAvatar uri={admirer.photoUrl} name={admirer.display_name} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                    {admirer.display_name}
                  </Text>
                  <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {requestLine(admirer.profile_id, games?.rows ?? [], games?.leagueGameId ?? null, REGION_LABELS[admirer.region])}
                  </Text>
                </View>
              </View>
            ))}
            <WithPlusRule />
            {state.kind === "hidden" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.tight }}>
                <View style={{ flexDirection: "row" }}>
                  {Array.from({ length: Math.min(state.hidden, LOCKED_RINGS) }, (_, i) => (
                    <LockedRing key={i} first={i === 0} />
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: colors.text }]}>{hiddenCountLabel(state.hidden)}</Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>{REQUESTS_COPY.hiddenLine}</Text>
                </View>
              </View>
            ) : (
              <View
                style={{
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: colors.cardEdge,
                  borderRadius: radius.md,
                  padding: spacing.tight,
                }}
              >
                <Text style={[type.caption, { color: colors.textMuted }]}>{REQUESTS_COPY.allShown}</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function ExtraPanel({ label, title, body, icon }: { label: string; title: string; body: string; icon: ReactNode }) {
  const { colors, radius, spacing, type } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[type.label, { color: colors.textMuted }]}>{label}</Text>
      <View
        accessible
        accessibilityLabel={`${title}. ${body}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.cardEdge,
          backgroundColor: colors.cardPanel,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.cardEdge,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

/** Page 2: who wants to duo (real counts, rank or main game, never ages), the daily Super Ping,
 * and unlimited active conversations. No price, no buy button. */
export function PeoplePage({ from, bottomInset }: { from: PaywallFrom; bottomInset: number }) {
  const { colors, spacing } = useTheme();
  const countQuery = useAdmirersCount();
  const admirersQuery = useAdmirers(true);
  const shown = (admirersQuery.data ?? []).slice(0, FREE_REQUESTS_PER_DAY);
  const { data: games } = useRequestGames(shown.map((a) => a.profile_id));
  const total = Math.max(countQuery.data ?? 0, shown.length);

  const panels: Record<PeoplePanel, ReactNode> = {
    requests: (
      <RequestsPanel
        key="requests"
        admirers={admirersQuery.data}
        total={countQuery.data}
        failed={countQuery.isError || admirersQuery.isError}
        games={games}
      />
    ),
    superPing: (
      <ExtraPanel
        key="superPing"
        label={PEOPLE_EXTRAS.superPingLabel}
        title={PEOPLE_EXTRAS.superPingTitle}
        body={PEOPLE_EXTRAS.superPingBody}
        icon={<Ionicons name="diamond" size={20} color={colors.success} />}
      />
    ),
    conversations: (
      <ExtraPanel
        key="conversations"
        label={PEOPLE_EXTRAS.conversationsLabel}
        title={PEOPLE_EXTRAS.conversationsTitle}
        body={PEOPLE_EXTRAS.conversationsBody}
        icon={<Ionicons name="chatbubbles" size={20} color={colors.voltDim} />}
      />
    ),
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: bottomInset, gap: spacing.lg }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeading copy={peoplePageHeading(from, total)} />
      {peoplePanelOrder(from).map((panel) => panels[panel])}
    </ScrollView>
  );
}
