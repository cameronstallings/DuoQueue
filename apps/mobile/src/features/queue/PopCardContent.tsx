import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Name } from "@/components/Name";
import { useTheme } from "@/theme/useTheme";

import { InlineError } from "./InlineError";
import { POP_COPY, POP_RESULT_COPY, popEndedTitle, popSentence, popTakenTitle } from "./queueCopy";

/** A quiet text action under the buttons (Report, Block): caption, textMuted. */
function QuietLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      {({ pressed }) => <Text style={[type.caption, { color: colors.textMuted, opacity: pressed ? 0.7 : 1 }]}>{label}</Text>}
    </Pressable>
  );
}

interface PopCardContentProps {
  name: string;
  /** AGES STAY (Cameron's decision 2): "Kai, 27", as on every card in the app. */
  age: number | null;
  gameName: string | null;
  rankText: string | null;
  canDuo: boolean;
  /** I'm in is in flight: its label pulses (Button's busy state). */
  answering: boolean;
  /** Why the last I'm in failed (a dropped connection, the rate limit), under the buttons. The
   * card is a modal screen and the root Toast draws under it (InlineError). */
  answerError?: string | null;
  onImIn: () => void;
  onNotNow: () => void;
  onReport: () => void;
  onBlock: () => void;
}

/**
 * The Duo Pop card's content under the countdown ring, while it counts: who is queueing, the game
 * and their rank text, "Can duo (by rank)" only when Riot's table says so, one sentence, I'm in,
 * Not now, and Report and Block (App Store 1.2: a player shown to a stranger can be reported and
 * blocked from where they are shown).
 *
 * No photo, on purpose: a Duo Pop is about the game and the next ten minutes, and a face would
 * turn "who is free to play right now" into "who do I like the look of". The name and age are
 * there, as on every card.
 */
export function PopCardContent({
  name,
  age,
  gameName,
  rankText,
  canDuo,
  answering,
  answerError = null,
  onImIn,
  onNotNow,
  onReport,
  onBlock,
}: PopCardContentProps) {
  const { colors, spacing, type } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.md }}>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Name numberOfLines={1} style={{ color: colors.text, textAlign: "center" }}>
          {age !== null ? `${name}, ${age}` : name}
        </Name>
        {gameName ? <Text style={[type.bodyStrong, { color: colors.text }]}>{gameName}</Text> : null}
        {rankText ? <Text style={[type.cardMeta, { color: colors.textMuted }]}>{rankText}</Text> : null}
      </View>
      {canDuo && <Chip tone="volt" label={POP_COPY.canDuoChip} />}
      <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{popSentence(name, gameName)}</Text>
      <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
        <Button label={POP_COPY.imIn} loading={answering} onPress={onImIn} />
        <Button label={POP_COPY.notNow} variant="ghost" disabled={answering} onPress={onNotNow} />
        <InlineError message={answerError} />
      </View>
      <View style={{ flexDirection: "row", gap: spacing.lg }}>
        <QuietLink label={POP_COPY.report} onPress={onReport} />
        <QuietLink label={POP_COPY.block} onPress={onBlock} />
      </View>
    </View>
  );
}

/** Why the Pop card is over, as the card shows it. */
export type PopOverResult = "taken" | "expired" | "ended" | "already_matched" | "unavailable";

interface PopOverContentProps {
  result: PopOverResult;
  name: string;
  onQueueUp: () => void;
  onClose: () => void;
  onOpenChat: () => void;
}

/**
 * The Pop card once it is over. Someone else got there first, or the ten minutes ran out: say so,
 * and offer the one thing that turns it around (Queue up, so players in your game hear from you).
 * The sender isn't queued anymore (Stop, their hour, or a duo found another way): Close. Already
 * matched (crossed I'm in taps, which 0088 answers "already_matched" before "ended"): Open chat.
 * Gone for any other reason: Close.
 */
export function PopOverContent({ result, name, onQueueUp, onClose, onOpenChat }: PopOverContentProps) {
  const { colors, spacing, type } = useTheme();
  const title =
    result === "ended"
      ? popEndedTitle(name)
      : result === "taken"
        ? popTakenTitle(name)
        : result === "expired"
          ? POP_RESULT_COPY.expired.title
          : result === "already_matched"
            ? POP_RESULT_COPY.already_matched.title
            : POP_RESULT_COPY.unavailable.title;
  const body = result === "taken" ? POP_RESULT_COPY.taken.body : result === "expired" ? POP_RESULT_COPY.expired.body : null;
  const canQueue = result === "taken" || result === "expired";

  return (
    <View style={{ alignItems: "center", gap: spacing.md }}>
      <Text accessibilityRole="header" style={[type.title, { color: colors.text, textAlign: "center" }]}>
        {title}
      </Text>
      {body ? <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{body}</Text> : null}
      <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
        {canQueue && <Button label={POP_COPY.queueUp} haptic="light" onPress={onQueueUp} />}
        {result === "already_matched" ? (
          <Button label={POP_COPY.openChat} onPress={onOpenChat} />
        ) : (
          <Button label={POP_COPY.close} variant={canQueue ? "ghost" : "primary"} onPress={onClose} />
        )}
      </View>
    </View>
  );
}
