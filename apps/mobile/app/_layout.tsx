import { useCallback, useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { Unbounded_600SemiBold, Unbounded_700Bold } from "@expo-google-fonts/unbounded";
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono";

import { useInviteRedemption } from "@/features/invite/useInvite";
import { LaunchIntro } from "@/features/launch/LaunchIntro";
import { endColdStart, isColdStart } from "@/features/launch/launchTiming";
import { useNotificationTapRouting } from "@/hooks/useNotificationTapRouting";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Toast } from "@/components/Toast";
import { configureNetworkAwareQueries } from "@/lib/network";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";
import { loadInviteState } from "@/store/invite-store";
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

// Keep the native splash up until the JS root has mounted and taken over rendering: on a cold
// start LaunchIntro hides it once it has laid out on the very same picture (the rings apart).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useSessionStore((s) => s.status);
  const initialize = useSessionStore((s) => s.initialize);
  const { colors, scheme } = useTheme();
  const [intro, setIntro] = useState(isColdStart);
  const endIntro = useCallback(() => {
    endColdStart();
    setIntro(false);
  }, []);
  // On a cold start the app mounts behind the intro only once its rings have locked (or its
  // backstop gave up waiting): mounting the whole tree is heavy UI-thread work, and done while the
  // rings moved it made them stutter. The session restore and the data loads below start at once
  // regardless; they are not rendering.
  const [introLocked, setIntroLocked] = useState(false);
  const markIntroLocked = useCallback(() => setIntroLocked(true), []);

  // The type system carries most of the visual identity, so the app is not mounted (the
  // splash, then the launch intro, stays over it) until the faces are in memory — swapping
  // them in mid-render would reflow every screen. `fontError` deliberately does not block: if
  // a face fails to load the OS font renders instead, and every size, line-height and
  // letter-spacing still applies.
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  const fontsReady = fontsLoaded || fontError != null;
  // The app below: after the fonts, and on a cold start after the intro's lock.
  const appMounted = fontsReady && (!intro || introLocked);

  // Here rather than in a screen, because a tap can be what launches the app: by the time any
  // screen has mounted, the response that opened it has already been delivered. It is told
  // whether the Stack itself is mounted (the same gates that hold back the app below), so it
  // holds a tap that arrives during the fonts or the launch intro instead of navigating a Stack
  // that does not exist yet.
  useNotificationTapRouting(appMounted && status !== "loading");

  // Here for the same reason as the line above: an invite can be redeemed the moment a
  // session exists, which is often before any screen that knows about invites has mounted.
  // Writing the attribution row as early as possible is the point -- see the hook.
  useInviteRedemption();

  useEffect(() => {
    void initialize();
    void loadThemePreference();
    void loadInviteState();
  }, [initialize]);

  // On a cold start LaunchIntro hides the splash. Otherwise (and as a backstop once the intro is
  // gone) the splash goes as soon as the faces are in.
  useEffect(() => {
    if (fontsReady && !intro) void SplashScreen.hideAsync();
  }, [fontsReady, intro]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Light over the intro's dark field whatever the theme; the theme's once it has gone. */}
      <StatusBar style={intro || scheme === "dark" ? "light" : "dark"} />
      {appMounted && (
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <OfflineBanner />
            {status === "loading" ? (
              // Only before the stored session is read, which is always under the intro.
              <View style={{ flex: 1, backgroundColor: colors.background }} />
            ) : (
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="welcome" />
                <Stack.Screen name="invited" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="chat/[matchId]" options={{ headerShown: true, title: "Chat" }} />
                <Stack.Screen name="filters" options={{ presentation: "modal" }} />
                <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
                <Stack.Screen name="admirers" options={{ presentation: "modal" }} />
                <Stack.Screen name="invite/index" options={{ presentation: "modal" }} />
                {/* Not a modal: this is where `duoqueue://invite/<code>` lands, and it can be
                    what launches the app. It stores the code and redirects immediately. */}
                <Stack.Screen name="invite/[code]" />
                <Stack.Screen name="online-now" options={{ presentation: "modal" }} />
                <Stack.Screen name="block-list" options={{ presentation: "modal" }} />
                <Stack.Screen name="hidden-words" options={{ presentation: "modal" }} />
                <Stack.Screen name="settings/appearance" />
                <Stack.Screen name="settings/notifications" />
                <Stack.Screen name="settings/privacy" />
                <Stack.Screen name="settings/connections" />
                <Stack.Screen name="settings/account" />
                <Stack.Screen name="safety/index" options={{ presentation: "modal" }} />
                <Stack.Screen name="safety/[topic]" />
                <Stack.Screen name="edit-prompts" options={{ presentation: "modal" }} />
                <Stack.Screen name="edit-details" options={{ presentation: "modal" }} />
                <Stack.Screen name="match/[matchId]" options={{ presentation: "modal" }} />
                <Stack.Screen name="profile/[profileId]" options={{ presentation: "modal" }} />
                <Stack.Screen name="party/[partyId]/index" options={{ headerShown: false }} />
                <Stack.Screen
                  name="party/[partyId]/chat"
                  options={{ headerShown: true, title: "Party chat", headerBackTitle: "Back" }}
                />
              </Stack>
            )}
            <Toast />
          </SafeAreaProvider>
        </QueryClientProvider>
      )}
      {/* Cold start only: over everything, on the native splash's picture, until the app is ready. */}
      {intro && (
        <LaunchIntro ready={fontsReady && status !== "loading"} onLocked={markIntroLocked} onDone={endIntro} />
      )}
    </GestureHandlerRootView>
  );
}
