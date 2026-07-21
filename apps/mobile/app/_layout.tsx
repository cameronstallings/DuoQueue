import { useEffect } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Slot } from "expo-router";

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
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>{status === "loading" ? <LoadingScreen /> : <Slot />}</SafeAreaProvider>
    </QueryClientProvider>
  );
}
