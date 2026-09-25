import { Pressable, ScrollView, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { LEGAL_URLS } from "@/lib/legal";
import { useTheme } from "@/theme/useTheme";

import { PageHeading } from "./PageHeading";
import { CONTINUE_FREE, LEGAL_LINKS, PLANS_HEADING, PLANS_UNAVAILABLE } from "./paywallCopy";
import { PlanRow } from "./PlanRow";
import { PowerUpRow } from "./PowerUpRow";
import type { PlanCopy } from "./pricing";
import type { PowerUpState } from "./usePowerUp";

export interface PlansViewProps {
  state: "loading" | "unavailable" | "ready";
  rows: { id: string; copy: PlanCopy }[];
  selectedId: string | null;
  selectedCopy: PlanCopy | null;
  onSelect: (id: string) => void;
  subscribing: boolean;
  onSubscribe: () => void;
  restoring: boolean;
  onRestore: () => void;
  powerUp: PowerUpState;
  onContinueFree: () => void;
  bottomInset: number;
}

/** An 18pt caption line + 13 above and below = a 44pt target (Restore is a required control).
 * The 8 at each side reaches only across the 8pt gap to the dot between two links, so
 * neighbouring targets never overlap. */
const LINK_SLOP = { top: 13, bottom: 13, left: 8, right: 8 };

/** Restore is a button; Terms and Privacy are links (build 17 fix: they were bare text). */
function LegalLinks({ restoring, onRestore }: { restoring: boolean; onRestore: () => void }) {
  const { colors, spacing, type } = useTheme();
  const link = [type.caption, { color: colors.text, textDecorationLine: "underline" as const }];
  const dot = (
    <Text accessibilityElementsHidden importantForAccessibility="no" style={[type.caption, { color: colors.textMuted }]}>
      ·
    </Text>
  );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: spacing.sm }}>
      <Pressable accessibilityRole="button" accessibilityState={{ busy: restoring }} disabled={restoring} onPress={onRestore} hitSlop={LINK_SLOP}>
        <Text style={link}>{restoring ? LEGAL_LINKS.restoring : LEGAL_LINKS.restore}</Text>
      </Pressable>
      {dot}
      <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.termsOfService)} hitSlop={LINK_SLOP}>
        <Text style={link}>{LEGAL_LINKS.terms}</Text>
      </Pressable>
      {dot}
      <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.privacyPolicy)} hitSlop={LINK_SLOP}>
        <Text style={link}>{LEGAL_LINKS.privacy}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Page 3, the only page that asks for money, so every Guideline 3.1.2 / Schedule 2 line is here:
 * what DuoQueue+ gives (the heading), all four plans with the billed price largest, the button
 * naming plan and price, the renewal paragraph for the selected plan directly under it, Restore,
 * Terms and Privacy, the Power-Up ("not a subscription"), and Continue with Free.
 */
export function PlansView(props: PlansViewProps) {
  const { colors, radius, spacing, type } = useTheme();
  const { state, rows, selectedId, selectedCopy, onSelect, subscribing, onSubscribe, restoring, onRestore, powerUp } = props;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: props.bottomInset, gap: spacing.md }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeading copy={PLANS_HEADING} />
      {state === "loading" ? (
        <View style={{ gap: spacing.sm }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={64} borderRadius={radius.card} />
          ))}
        </View>
      ) : state === "unavailable" ? (
        <Text style={[type.body, { color: colors.textMuted }]}>{PLANS_UNAVAILABLE}</Text>
      ) : (
        <>
          <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
            {rows.map((row) => (
              <PlanRow key={row.id} copy={row.copy} selected={row.id === selectedId} onSelect={() => onSelect(row.id)} />
            ))}
          </View>
          {selectedCopy ? (
            <View style={{ gap: spacing.sm }}>
              <Button
                variant="premium"
                label={subscribing ? "Confirming" : selectedCopy.buttonLabel}
                onPress={onSubscribe}
                loading={subscribing}
              />
              {/* Guideline 3.1.2 and Schedule 2: the renewal terms of THIS plan, next to the
                  button that buys it, never behind a link. pricing.ts planCopy writes it. */}
              <Text style={[type.caption, { color: colors.textMuted }]}>{selectedCopy.renewalText}</Text>
            </View>
          ) : null}
        </>
      )}
      <LegalLinks restoring={restoring} onRestore={onRestore} />
      <PowerUpRow left={powerUp.left} price={powerUp.price} busy={powerUp.busy} onBuy={powerUp.buy} />
      {/* Required: the paywall never traps anyone. The X is on every page too. */}
      <Button label={CONTINUE_FREE} variant="ghost" onPress={props.onContinueFree} />
    </ScrollView>
  );
}
