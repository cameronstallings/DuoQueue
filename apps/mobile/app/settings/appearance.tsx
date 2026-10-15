import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { APPEARANCE_OPTIONS, isAppearanceOptionSelected } from "@/lib/appearance";
import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ToggleRow } from "@/components/ToggleRow";
import { useRequireSession } from "@/hooks/useRequireSession";
import { hapticSelection } from "@/lib/haptics";
import { HAPTICS_COPY } from "@/lib/hapticsPreference";
import { useHapticsStore } from "@/store/haptics-store";
import { useThemeStore } from "@/store/theme-store";
import { useTheme } from "@/theme/useTheme";

/**
 * Two options. Light and Dark, and nothing else.
 *
 * "System" is still a real stored preference and `useTheme` still resolves it against the
 * phone exactly as before — nothing about the resolution changed. What changed is that it
 * is no longer NAMED. It is the invisible default, and Light and Dark are overrides.
 *
 * THE SELECTED ROW IS THE RESOLVED THEME, NOT THE STORED PREFERENCE. Somebody whose stored
 * preference is "system" on a dark phone sees Dark ticked, which is simply true: the app is
 * dark. They are not told a third state exists, and they never need to know. Tapping either
 * row pins it explicitly, which is the only thing that writes "light" or "dark" over
 * "system" — and it happens whether or not the row already looked selected, because for a
 * user on "system" the tick means "this is what you are seeing" and the tap means "and keep
 * it that way".
 *
 * NOBODY IS MIGRATED. A stored "system" stays "system" until its owner taps a row here, so
 * an existing user's phone keeps controlling the app for as long as they never open this
 * screen. Rewriting the value on mount would be a silent behaviour change, and the whole
 * point of this design is that it changes no behaviour at all.
 *
 * THE HINTS ARE GONE, and their absence is load-bearing. They used to read "Always dark,
 * whatever your phone is set to", which is a FALSE sentence to show a user on "system" whose
 * phone happens to be dark — the row they see ticked would be claiming to override something
 * it is not overriding. With System unnamed, two one-word rows need no explanation anyway.
 *
 * The rows and the tick rule live in `lib/appearance.ts`, typed on the RESOLVED scheme so
 * that handing them the stored preference is a compile error rather than a screen that
 * ticks nothing. See the header there.
 *
 * HAPTICS (1.0.2) lives here too, in its own card under the theme, because it is the same kind
 * of thing: how the app feels on this phone, not anything about your profile. It is per device
 * (`store/haptics-store.ts`, AsyncStorage) and defaults ON; iOS's own System Haptics switch
 * still applies on top of it. Its row passes `haptic={false}` and orders the tap itself so the
 * tap is felt either way: switching on, the store turns on first and then the tap plays (it would
 * be swallowed the other way round); switching off, the tap plays first and then the store goes
 * quiet. Every other haptic in the app checks this switch in `lib/haptics.ts`.
 */

export default function AppearanceSettings() {
  useRequireSession();
  const { colors, spacing, type, radius, hairline, scheme } = useTheme();
  const setPreference = useThemeStore((s) => s.setPreference);
  const hapticsEnabled = useHapticsStore((s) => s.enabled);
  const setHapticsEnabled = useHapticsStore((s) => s.setEnabled);

  return (
    <ScreenContainer title="Appearance" showBack>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {APPEARANCE_OPTIONS.map((option, i) => {
          const selected = isAppearanceOptionSelected(scheme, option.value);
          return (
            <View key={option.value}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing.md }} />}
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  hapticSelection();
                  setPreference(option.value);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  backgroundColor: pressed ? colors.surfaceAlt : "transparent",
                })}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: radius.chip,
                    borderWidth: hairline,
                    borderColor: selected ? colors.voltDim : colors.border,
                    backgroundColor: selected ? colors.volt : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && <Ionicons name="checkmark" size={14} color={colors.onVolt} />}
                </View>
                <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{option.label}</Text>
              </Pressable>
            </View>
          );
        })}
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <ToggleRow
          label={HAPTICS_COPY.label}
          hint={HAPTICS_COPY.hint}
          value={hapticsEnabled}
          haptic={false}
          onValueChange={(next) => {
            if (next) {
              setHapticsEnabled(true);
              hapticSelection();
            } else {
              hapticSelection();
              setHapticsEnabled(false);
            }
          }}
        />
      </Card>
    </ScreenContainer>
  );
}
