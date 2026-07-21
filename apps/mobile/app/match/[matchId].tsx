import { Image, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useTheme } from "@/theme/useTheme";

export default function MatchCelebrationScreen() {
  const { colors, spacing } = useTheme();
  const { matchId, name, photo } = useLocalSearchParams<{ matchId: string; name?: string; photo?: string }>();

  return (
    <ScreenContainer>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
        <Text style={{ fontSize: 32, fontWeight: "800", color: colors.brand, textAlign: "center" }}>
          It&apos;s a match!
        </Text>

        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: 160, height: 160, borderRadius: 80, borderWidth: 4, borderColor: colors.brand }}
          />
        ) : null}

        <Text style={{ fontSize: 20, fontWeight: "600", color: colors.text, textAlign: "center" }}>
          You and {name ?? "your new match"} both swiped right.
        </Text>

        <View style={{ width: "100%", gap: spacing.sm }}>
          <Button
            label="Send a message"
            onPress={() => router.replace({ pathname: "/chat/[matchId]", params: { matchId } })}
          />
          <Button label="Keep swiping" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </ScreenContainer>
  );
}
