import { useEffect } from "react";
import { AppState, View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Logo } from "@/components/Logo";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Toast } from "@/components/Toast";
import { configureNetworkAwareQueries } from "@/lib/network";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";
import { loadThemePreference } from "@/store/theme-store";
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

// Keep the native splash up until the JS root has mounted and taken over
// rendering (the LoadingScreen below shares the splash's background color,
// so the handoff reads as one continuous screen rather than a flash).
void SplashScreen.preventAutoHideAsync();

function LoadingScreen() {
  const { colors } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 700, easing: Easing.ease }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
      }}
    >
      <Animated.View style={animatedStyle}>
        <Logo width={100} />
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  const status = useSessionStore((s) => s.status);
  const initialize = useSessionStore((s) => s.initialize);
  const { colors, scheme } = useTheme();

  useEffect(() => {
    void initialize();
    void loadThemePreference();
    void SplashScreen.hideAsync();
  }, [initialize]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <OfflineBanner />
          {status === "loading" ? (
            <LoadingScreen />
          ) : (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="welcome" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="chat/[matchId]" options={{ headerShown: true, title: "Chat" }} />
              <Stack.Screen name="filters" options={{ presentation: "modal" }} />
              <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
              <Stack.Screen name="admirers" options={{ presentation: "modal" }} />
              <Stack.Screen name="online-now" options={{ presentation: "modal" }} />
              <Stack.Screen name="block-list" options={{ presentation: "modal" }} />
              <Stack.Screen name="hidden-words" options={{ presentation: "modal" }} />
              <Stack.Screen name="safety/index" options={{ presentation: "modal" }} />
              <Stack.Screen name="safety/[topic]" />
              <Stack.Screen name="edit-prompts" options={{ presentation: "modal" }} />
              <Stack.Screen name="edit-details" options={{ presentation: "modal" }} />
              <Stack.Screen name="match/[matchId]" options={{ presentation: "modal" }} />
              <Stack.Screen name="party/[partyId]/index" options={{ headerShown: false }} />
              <Stack.Screen name="party/[partyId]/chat" options={{ headerShown: true, title: "Party chat" }} />
            </Stack>
          )}
          <Toast />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
