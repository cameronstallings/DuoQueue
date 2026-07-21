import { useEffect } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { OfflineBanner } from "@/components/OfflineBanner";
import { configureNetworkAwareQueries } from "@/lib/network";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

// Supabase's token auto-refresh timer only ticks while the JS runtime is active;
// pause/resume it with app foreground state so we don't refresh in the background
// and don't miss a refresh right when the user returns.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

configureNetworkAwareQueries();

function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}
    >
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}

export default function RootLayout() {
  const status = useSessionStore((s) => s.status);
  const initialize = useSessionStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <OfflineBanner />
          {status === "loading" ? (
            <LoadingScreen />
          ) : (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="chat/[matchId]" options={{ headerShown: true, title: "Chat" }} />
              <Stack.Screen name="filters" options={{ presentation: "modal" }} />
              <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
              <Stack.Screen name="admirers" options={{ presentation: "modal" }} />
              <Stack.Screen name="match/[matchId]" options={{ presentation: "modal" }} />
            </Stack>
          )}
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
