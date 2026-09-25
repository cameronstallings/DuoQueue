import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { GrainOverlay } from "@/components/GrainOverlay";
import { GraticuleBackground } from "@/components/GraticuleBackground";
import { ScreenContainer, goBack } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useAdmirers, useAdmirersCount } from "@/features/matching/useAdmirers";
import { usePremiumStatus } from "@/features/matching/usePremiumStatus";
import { Pager, PagerPage } from "@/features/pager/Pager";
import { PagerDots } from "@/features/pager/PagerDots";
import { usePager } from "@/features/pager/usePager";
import { DeckPage } from "@/features/premium/paywall/DeckPage";
import { PaywallBar } from "@/features/premium/paywall/PaywallBar";
import { PeoplePage } from "@/features/premium/paywall/PeoplePage";
import { PlansPage } from "@/features/premium/paywall/PlansPage";
import { PowerUpRow } from "@/features/premium/paywall/PowerUpRow";
import {
  SUBSCRIBER_BODY,
  parsePaywallFrom,
  paywallPageOrder,
  paywallPageTitles,
  requestsTotal,
  type PaywallFrom,
} from "@/features/premium/paywall/paywallCopy";
import { usePowerUp } from "@/features/premium/paywall/usePowerUp";
import { FREE_DAILY_SWIPES } from "@/features/swipe/deckStripCopy";
import { useSwipeQuota } from "@/features/swipe/useSwipeQuota";
import { useRequireSession } from "@/hooks/useRequireSession";
import { useTheme } from "@/theme/useTheme";

/** The footer band that holds the dots, over the pages' bottom (page 3 scrolls under it). */
const FOOTER_BAND = 28;

function SubscriberPage() {
  const { colors, type } = useTheme();
  const powerUp = usePowerUp();
  return (
    <ScreenContainer title="You're on DuoQueue+" showClose>
      <Text style={[type.body, { color: colors.textMuted }]}>{SUBSCRIBER_BODY}</Text>
      <PowerUpRow left={powerUp.left} price={powerUp.price} busy={powerUp.busy} onBuy={powerUp.buy} />
      <Button label="Done" onPress={goBack} />
    </ScreenContainer>
  );
}

/**
 * Three pages, swiped, one job each (Previously's pattern in DuoQueue's look): page one is about
 * why the player came, page two who wants to duo, page three the plans. It always opens on page
 * one. No Continue buttons: dots, a one-time peek, and a chevron that turns the pager back.
 */
function PaywallPager({ from }: { from: PaywallFrom }) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const order = paywallPageOrder(from);
  const { data: quota } = useSwipeQuota();
  const { data: requests } = useAdmirersCount();
  // The same cached list page 2 reads, so the dots name page 2 with page 2's own number.
  const { data: admirers } = useAdmirers(true);
  // The peek waits for page one to have its real number on it.
  const pageOneReady = order[0] === "people" ? requests !== undefined : quota !== undefined;
  const pager = usePager(order.length, { peekReady: pageOneReady });
  const footer = FOOTER_BAND + insets.bottom;
  const pageBottom = footer + spacing.lg;
  const titles = paywallPageTitles(
    order,
    from,
    quota?.swipes_limit ?? FREE_DAILY_SWIPES,
    requestsTotal(requests, admirers?.length ?? 0),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GraticuleBackground />
      <GrainOverlay />
      <PaywallBar page={pager.page} onBack={() => pager.goTo(pager.page - 1, { focus: true })} />
      <Pager pager={pager}>
        {order.map((page, index) => (
          <PagerPage key={page} pager={pager} index={index}>
            {page === "deck" ? (
              <DeckPage from={from} bottomInset={pageBottom} />
            ) : page === "people" ? (
              <PeoplePage from={from} bottomInset={pageBottom} />
            ) : (
              <PlansPage bottomInset={pageBottom} />
            )}
          </PagerPage>
        ))}
      </Pager>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: footer,
          paddingBottom: insets.bottom,
          justifyContent: "center",
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <PagerDots pager={pager} label="Page" titles={titles} />
      </View>
    </View>
  );
}

export default function PaywallScreen() {
  useRequireSession();
  const { radius, spacing } = useTheme();
  const params = useLocalSearchParams<{ from?: string }>();
  const from = parsePaywallFrom(params.from);
  const { isPremium, isLoading } = usePremiumStatus();

  if (isLoading) {
    return (
      <ScreenContainer title="DuoQueue+" showClose>
        <View style={{ gap: spacing.sm }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={64} borderRadius={radius.card} />
          ))}
        </View>
      </ScreenContainer>
    );
  }

  // A subscriber gets one page, with no selling pager: what is on, the Power-Up, Done.
  if (isPremium) return <SubscriberPage />;

  return <PaywallPager from={from} />;
}
