import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { formatTime } from "@/features/queue/QueueUpSheet";
import { quickExiting, revealEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { PARTY_LFG_COPY, partyLiveLine } from "./partyCopy";
import type { PartyLfg } from "./usePartyLfg";

/** One sm secondary Button's height (bodyStrong's 21pt line, 10pt of padding each side and the
 * 1px border), so the skeleton holds exactly the space the button will take. */
const SM_BUTTON_H = 43;

/** A plain text link in voltDim (audited on the background). */
function TextLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors, type } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} hitSlop={8}>
      {({ pressed }) => (
        <Text style={[type.caption, { color: colors.voltDim, opacity: pressed || disabled ? 0.7 : 1 }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/**
 * The party deck's LFG post row, under the deck caption, for a party of exactly two:
 *
 *   idle     one secondary sm "Share LFG post" (asks first, then shares the post)
 *   live     "Your LFG post works until 11:40 PM." (or "{name}'s ...") with "Stop post", then
 *            "Share again" (the sharer) or "Share post" (the other member, asked first) and
 *            "Copy post" ("Post copied" for 2 s)
 *   loading  a skeleton the height of one sm button, never a spinner, and only once 0089 is
 *            known to be there
 *   hidden   nothing: a full party, a party of one, a pair the server will not let post, 0089
 *            not live or not known to be yet, or the members could not be read (build 19's
 *            screen exactly)
 *
 * Each state fades in where the last was (keyed), so the deck below moves only by the row's own
 * height, once.
 */
export function PartyLfgRow({ lfg }: { lfg: PartyLfg }) {
  const { colors, spacing, type } = useTheme();
  const { view } = lfg;

  if (view.kind === "hidden") return null;

  if (view.kind === "loading") {
    return (
      <Animated.View key="loading" exiting={quickExiting()}>
        <Skeleton width={150} height={SM_BUTTON_H} />
      </Animated.View>
    );
  }

  if (view.kind === "idle") {
    return (
      <Animated.View key="idle" entering={revealEntering()} exiting={quickExiting()} style={{ alignItems: "flex-start" }}>
        <Button
          size="sm"
          variant="secondary"
          label={PARTY_LFG_COPY.share}
          loading={lfg.starting}
          onPress={lfg.share}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View key={`live-${view.code}`} entering={revealEntering()} exiting={quickExiting()} style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Text style={[type.caption, { color: colors.text, flex: 1 }]} numberOfLines={2}>
          {partyLiveLine({ mine: view.mine, sharerName: view.sharerName, time: formatTime(view.untilMs, false) })}
        </Text>
        <TextLink label={PARTY_LFG_COPY.stop} onPress={lfg.stop} disabled={lfg.stopping} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Button
          size="sm"
          variant="secondary"
          label={view.mine ? PARTY_LFG_COPY.shareAgain : PARTY_LFG_COPY.sharePost}
          onPress={lfg.share}
        />
        <Button size="sm" variant="ghost" label={lfg.copied ? PARTY_LFG_COPY.copied : PARTY_LFG_COPY.copy} onPress={lfg.copy} />
      </View>
    </Animated.View>
  );
}
