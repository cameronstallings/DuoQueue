import { useEffect, useState } from "react";
import { Keyboard, Platform, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { TextField } from "@/components/TextField";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

import { DISCORD_COPY, discordSaveErrorMessage, parseDiscordInput } from "./discordUsername";
import { useSaveDiscordUsername } from "./useDiscordUsername";

interface DiscordEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  /** "save": Settings > Connections (a toast confirms, and empty removes it). "save-and-share":
   * the chat's Add your Discord, where saving is the first half of sharing, so an empty field
   * cannot be saved and the caller shares in `onSaved`. */
  mode: "save" | "save-and-share";
  /** After a successful save (or an unchanged value), with the saved value. */
  onSaved?: (value: string | null) => void;
  /** Passed through to Sheet (iOS: runs once the sheet has finished leaving). */
  onDismiss?: () => void;
}

/**
 * Keeps the sheet's field and buttons above the keyboard.
 *
 * Sheet has no keyboard handling and sits at the bottom of its Modal, so the keyboard would cover
 * exactly the field being typed into. A KeyboardAvoidingView inside the panel cannot fix it: RN
 * 0.81's KAV compares its onLayout frame, which is relative to its PARENT (the panel), with the
 * keyboard's screen position, so inside a bottom sheet it computes no overlap and pads nothing.
 * Instead this spacer at the bottom of the content grows by the keyboard's height (less the
 * bottom inset the panel already pads), which lifts the bottom-anchored panel by exactly that
 * much, in step with the keyboard's own animation.
 */
function KeyboardSpacer({ active }: { active: boolean }) {
  const insets = useSafeAreaInsets();
  const keyboard = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    // The keyboard may already be up (the chat composer had focus when the chip was tapped).
    keyboard.value = Keyboard.metrics()?.height ?? 0;
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      keyboard.value = withTiming(e.endCoordinates.height, {
        duration: e.duration || 250,
        easing: Easing.out(Easing.cubic),
      });
    });
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", (e) => {
      keyboard.value = withTiming(0, { duration: e.duration || 250, easing: Easing.out(Easing.cubic) });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [active, keyboard]);

  const bottomInset = insets.bottom;
  const style = useAnimatedStyle(() => ({ height: Math.max(0, keyboard.value - bottomInset) }));
  return <Animated.View style={style} />;
}

/**
 * Add, change or remove the player's Discord username. Settings > Connections opens it in "save"
 * mode; the chat's Add your Discord chip and menu row open it in "save-and-share" mode.
 *
 * Not dismissable from the scrim: it carries typing, and a mis-tap must not throw it away
 * (Cancel and the hardware back still close it).
 */
export function DiscordEditorSheet({ visible, onClose, mode, onSaved, onDismiss }: DiscordEditorSheetProps) {
  const { colors, spacing, type } = useTheme();
  const saved = useSessionStore((s) => s.profile?.discord_username ?? null);
  const save = useSaveDiscordUsername();
  const showToast = useToastStore((s) => s.showToast);

  const [draft, setDraft] = useState(saved ?? "");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  // The draft starts from the saved name every time the sheet opens (React's "adjust state while
  // rendering" pattern, so the first frame already shows it).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(saved ?? "");
      setFieldError(undefined);
    }
  }

  const sharing = mode === "save-and-share";
  const empty = draft.trim() === "";

  async function handleSave() {
    if (save.isPending) return;
    const parsed = parseDiscordInput(draft);
    if (!parsed.ok) {
      hapticError();
      setFieldError(parsed.error);
      return;
    }
    if (sharing && parsed.value === null) return;

    const current = saved?.trim() || null;
    if (parsed.value === current) {
      onClose();
      onSaved?.(parsed.value);
      return;
    }

    try {
      await save.mutateAsync(parsed.value);
    } catch (err) {
      hapticError();
      setFieldError(discordSaveErrorMessage(err));
      return;
    }
    hapticSuccess();
    onClose();
    onSaved?.(parsed.value);
    if (!sharing) showToast(parsed.value ? DISCORD_COPY.saved : DISCORD_COPY.removed);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismiss={onDismiss}
      dismissable={false}
      title={sharing ? DISCORD_COPY.titleChat : DISCORD_COPY.titleSettings}
    >
      <View style={{ gap: spacing.md }}>
        <Text style={[type.caption, { color: colors.textMuted }]}>{DISCORD_COPY.body}</Text>
        <View style={{ gap: spacing.xs }}>
          <TextField
            label={DISCORD_COPY.fieldLabel}
            placeholder={DISCORD_COPY.placeholder}
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              if (fieldError) setFieldError(undefined);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            autoFocus
            maxLength={32}
            returnKeyType="done"
            onSubmitEditing={() => void handleSave()}
            error={fieldError}
          />
          {!sharing && <Text style={[type.caption, { color: colors.textMuted }]}>{DISCORD_COPY.removeHint}</Text>}
        </View>
        <Button
          label={sharing ? DISCORD_COPY.saveAndShare : DISCORD_COPY.save}
          onPress={() => void handleSave()}
          loading={save.isPending}
          disabled={sharing && empty}
        />
        <Button variant="ghost" label={DISCORD_COPY.cancel} onPress={onClose} />
      </View>
      <KeyboardSpacer active={visible} />
    </Sheet>
  );
}
